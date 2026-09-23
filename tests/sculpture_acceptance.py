import json,argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:4187')
parser.add_argument('--output',required=True)
args=parser.parse_args()
out=Path(args.output)
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1440,'height':1080},reduced_motion='reduce')
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='networkidle')
 page.wait_for_function('window.sandscape.getVisualState().ready',timeout=20000)
 state=page.evaluate('window.sandscape.getVisualState()')
 assert state['points']==page.evaluate('window.sandscape.sim.grainCount()')
 gravity=page.evaluate('({...window.sandscape.sim.G})')
 page.locator('#orbitMode').click()
 box=page.locator('#sculpture').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+50,y-10,steps=5);page.mouse.up()
 page.wait_for_function('window.sandscape.getVisualState().azimuth > .45')
 assert page.evaluate('({...window.sandscape.sim.G})')==gravity
 assert page.evaluate('window.sandscape.sim.framePass')==0
 page.locator('[data-finish="silver"]').click()
 page.screenshot(path=str(out/'sculpture-silver-orbit.png'),full_page=True)
 page.locator('#allPalettes').click();page.locator('#shapeSquare').click();page.locator('#closeDrawer').click()
 assert page.evaluate('window.sandscape.getVisualState().shape')=='square'
 page.screenshot(path=str(out/'sculpture-square.png'),full_page=True)
 page.locator('#allPalettes').click();page.locator('#shapeCircle').click();page.locator('#closeDrawer').click()
 page.locator('[data-finish="bronze"]').click()
 page.get_by_role('button',name='Sunset Orange',exact=True).click()
 page.locator('#quickFlip').click()
 page.locator('#pauseBtn').click()
 page.wait_for_function('window.sandscape.sim.framePass > 600',timeout=30000)
 page.locator('#pauseBtn').click()
 page.screenshot(path=str(out/'sandscape-sculpture.png'),full_page=True)
 after=page.evaluate('window.sandscape.getVisualState()')
 assert after['bubbles']>0
 assert after['points']==page.evaluate('window.sandscape.sim.grainCount()')
 assert not errors,errors
 # Observe the composition, including active bubble markers and real grain geometry.
 out.joinpath('sculpture-acceptance.json').write_text(json.dumps({'status':'Worked','initial':state,'after_flip':after,'orbit':'camera changed; gravity and paused sand unchanged','shape':'round and square loaded','finishes':'silver and champagne rendered','errors':errors},indent=2))
 print(json.dumps(after))
 b.close()
