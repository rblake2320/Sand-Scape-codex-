"""Live browser/API acceptance. Start server.py first; outputs are real captures."""
import argparse
import base64
import json
import urllib.error
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:4187')
    parser.add_argument('--output', required=True)
    parser.add_argument('--resume', action='store_true', help='Resume after already-passed PNG checks')
    args = parser.parse_args()
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    checks = json.loads((out / 'studio-acceptance.json').read_text()) if args.resume else []

    def passed(name, detail):
        checks.append({'scenario': name, 'status': 'Worked', 'detail': detail})
        (out / 'studio-acceptance.json').write_text(json.dumps(checks, indent=2))
        print(name, 'PASS', flush=True)

    def api(payload, expected, headers=None):
        req = urllib.request.Request(args.url + '/api/suggest', data=payload,
                                     headers={'Content-Type': 'application/json', **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                code, body = response.status, json.load(response)
        except urllib.error.HTTPError as exc:
            code, body = exc.code, json.load(exc)
        assert code == expected, (code, body)
        return body

    if not args.resume:
        for name, payload, code, headers in [
            ('empty prompt', b'{"prompt":""}', 400, {}),
            ('malformed JSON', b'{', 400, {}),
            ('wrong payload type', b'[]', 400, {}),
            ('oversized input', json.dumps({'prompt': 'x' * 5000}).encode(), 413, {}),
            ('foreign origin', b'{"prompt":"blue ocean"}', 403, {'Origin': 'https://example.com'}),
            ('foreign host', b'{"prompt":"blue ocean"}', 403, {'Host': 'example.com'}),
            ('non-English script', json.dumps({'prompt': '\u9752\u3044\u6d77'}).encode(), 400, {}),
        ]:
            result = api(payload, code, headers)
            passed(name, result)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(args.url, wait_until='networkidle')
        page.wait_for_function('window.sandscape && window.sandscape.sim.grainCount()>1000')
        if not args.resume:
            assert page.locator('#modelStatus').inner_text() == 'Laya · on this computer'
            passed('browser boot with real local model', page.evaluate('window.sandscape.getSettings()'))
            # Pause freezes physics and typing does not accidentally invoke keyboard shortcuts.
            page.locator('#pauseBtn').click()
            frame = page.evaluate('window.sandscape.sim.framePass')
            pixels = page.locator('#sim').evaluate('(c)=>c.toDataURL()')
            page.locator('#scenePrompt').fill('')
            page.locator('#scenePrompt').press_sequentially('A warm orange desert sunset, slow and peaceful')
            assert page.evaluate('window.sandscape.sim.framePass') == frame
            assert page.locator('#sim').evaluate('(c)=>c.toDataURL()') == pixels
            passed('pause and typing shortcut isolation', {'framePass': frame})
            before = page.evaluate('window.sandscape.getSettings()')
            page.locator('#suggestBtn').click()
            page.locator('#suggestion').wait_for(state='visible', timeout=45000)
            assert page.evaluate('window.sandscape.getSettings()') == before
            assert 'Sunset Orange' in page.locator('#suggestionText').inner_text()
            page.locator('#applySuggestion').click()
            state = page.evaluate('window.sandscape.getSettings()')
            assert state['i'] == 2 and state['speed'] == 0.5
            passed('real Laya suggestion reviewed and applied', state)
            page.locator('#pauseBtn').click()
            mass = page.evaluate('window.sandscape.sim.grainCount()')
            page.locator('#quickFlip').click()
            page.wait_for_function('window.sandscape.sim.framePass > 20')
            assert page.evaluate('window.sandscape.sim.grainCount()') == mass
            passed('flip preserves sand', {'grains': mass})
            page.locator('#allPalettes').click()
            page.locator('#shapeSquare').click()
            assert page.evaluate('window.sandscape.getSettings().shape') == 'square'
            page.locator('#shapeCircle').click()
            page.locator('#closeDrawer').click()
            assert page.locator('#drawer').evaluate('(e)=>e.inert')
            page.locator('#allPalettes').click()
            page.keyboard.press('Escape')
            assert page.locator('#allPalettes').evaluate('(e)=>e===document.activeElement')
            passed('drawer shape controls and keyboard close', 'Circle/square; Escape restores focus; hidden controls inert')
            with page.expect_download() as download:
                page.locator('#quickCapture').click()
            download.value.save_as(out / 'sandscape-art.png')
            assert (out / 'sandscape-art.png').stat().st_size > 10000
            passed('PNG export', {'bytes': (out / 'sandscape-art.png').stat().st_size})
        else:
            page.get_by_role('button', name='Sunset Orange', exact=True).click()
            page.locator('#studioSpeed').fill('0.5')
            page.locator('#studioSpeed').dispatch_event('input')
        page.locator('#quickFlip').click()
        page.locator('#recordBtn').click()
        page.wait_for_timeout(3200)  # record actual progressing simulation frames
        with page.expect_download() as download:
            page.locator('#recordBtn').click()
        clip = out / download.value.suggested_filename
        download.value.save_as(clip)
        assert clip.stat().st_size > 10000
        # Play downloaded bytes directly: service workers can intercept synthetic test URLs.
        clip_data = base64.b64encode(clip.read_bytes()).decode()
        video = page.evaluate('''async (data) => {
          const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
          const url=URL.createObjectURL(new Blob([bytes],{type:'video/webm'}));
          const v=document.createElement('video'); v.muted=true; v.src=url; document.body.append(v);
          await new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=reject;});
          await v.play(); await new Promise(resolve=>setTimeout(resolve,500));
          const result={width:v.videoWidth,height:v.videoHeight,time:v.currentTime}; v.remove(); URL.revokeObjectURL(url); return result;
        }''', clip_data)
        assert video['width'] > 0 and video['time'] > 0
        passed('recorded clip downloads and plays', {**video, 'file': clip.name, 'bytes': clip.stat().st_size})
        page.locator('#pauseBtn').click()
        page.screenshot(path=str(out / 'sandscape-desktop.png'), full_page=True)
        page.reload(wait_until='networkidle')
        state = page.evaluate('window.sandscape.getSettings()')
        assert state['i'] == 2 and state['speed'] == 0.5
        passed('settings persist across reload', state)
        # Simulate a genuinely unreachable model endpoint; verify manual recovery.
        page.route('**/api/suggest', lambda route: route.abort())
        page.locator('#suggestBtn').click()
        page.locator('#directorError').wait_for(state='visible')
        page.get_by_role('button', name='Summer Turquoise', exact=True).click()
        assert page.evaluate('window.sandscape.getSettings().i') == 1
        passed('model connection failure retains manual controls', page.locator('#directorError').inner_text())
        # Cached studio must boot offline; live model endpoints must never be cached.
        page.evaluate('navigator.serviceWorker.ready')
        context.set_offline(True)
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('window.sandscape !== undefined')
        page.get_by_role('button', name='Arctic Glacier', exact=True).click()
        assert page.evaluate('window.sandscape.getSettings().i') == 3
        passed('offline PWA manual palette', 'Booted offline and selected Arctic Glacier')
        context.set_offline(False)
        assert not errors, errors
        passed('desktop JavaScript errors', errors)
        mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True,
                                     reduced_motion='reduce')
        m = mobile.new_page()
        m.goto(args.url, wait_until='networkidle')
        assert m.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert m.evaluate('window.sandscape.getSettings().paused')
        m.locator('#allPalettes').scroll_into_view_if_needed()
        m.locator('#allPalettes').click()
        m.locator('#closeDrawer').click()
        m.screenshot(path=str(out / 'sandscape-mobile.png'), full_page=True)
        passed('mobile viewport and reduced motion', '390x844; no horizontal overflow; starts paused; controls usable')
        browser.close()


if __name__ == '__main__':
    main()
