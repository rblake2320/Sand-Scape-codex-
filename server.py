"""Loopback-only SandScape studio + local Laya inference. No paid APIs."""
import argparse
import json
import os
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

os.environ.setdefault('USE_TF', '0')
ROOT = Path(__file__).resolve().parent
QUESTIONS = {
    'palette': {'type': 'choice', 'instructions': 'Select the color palette closest to the requested scene.', 'criteria': {
        'ocean': 'blue sea, ocean, water, deep blue',
        'turquoise': 'green forest, tropical lagoon, turquoise',
        'sunset': 'orange sunset, warm desert, red canyon',
        'arctic': 'white snow, ice, silver, monochrome',
        'volcanic': 'dark red volcano, lava, ash'}},
    'flow': {'type': 'choice', 'instructions': 'Select the requested motion speed. Use normal if no speed is requested.', 'criteria': {
        'slow': 'slow, calm, gentle, peaceful, meditative',
        'normal': 'normal speed, no speed preference',
        'fast': 'fast, energetic, rapid, lively'}}
}
PALETTES = {'ocean': 0, 'turquoise': 1, 'sunset': 2, 'arctic': 3, 'volcanic': 4}
SPEEDS = {'slow': 0.5, 'normal': 1, 'fast': 2}

class Director:
    def __init__(self, device='cpu'):
        self.device = device
        self.agent = None
        self.error = None
        self.lock = threading.Lock()

    def load(self):
        try:
            import torch
            import laya
            torch.set_num_threads(min(4, os.cpu_count() or 1))
            self.agent = laya.load('convaiinnovations/laya', device=self.device)
        except Exception as exc:
            self.error = type(exc).__name__
            print(f'Laya load failed: {exc}', flush=True)

    def suggest(self, prompt):
        if not self.agent:
            raise RuntimeError('Laya is unavailable' if self.error else 'Laya is still loading')
        if not self.lock.acquire(blocking=False):
            raise RuntimeError('Laya is busy; try again shortly')
        try:
            start = time.perf_counter()
            result = self.agent.predict(prompt, QUESTIONS)
            answers = result['answers']
            palette = answers['palette']['choice']
            flow = answers['flow']['choice']
            if palette not in PALETTES or flow not in SPEEDS:
                raise ValueError('Model returned an unsupported setting')
            return {'provider': 'laya', 'model': 'convaiinnovations/laya',
                    'settings': {'group': 'Exotic', 'i': PALETTES[palette], 'speed': SPEEDS[flow]},
                    'choices': {'palette': palette, 'flow': flow},
                    'elapsed_ms': round((time.perf_counter() - start) * 1000),
                    'review_required': True}
        finally:
            self.lock.release()

class Handler(SimpleHTTPRequestHandler):
    def json(self, status, data):
        raw = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    def allowed(self):
        hosts = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        return self.headers.get('Host') in hosts and self.headers.get('Origin') in (
            None, *(f'http://{host}' for host in hosts))

    def do_GET(self):
        if not self.allowed():
            return self.json(403, {'error': 'Local requests only'})
        if self.path == '/api/health':
            d = self.server.director
            return self.json(200, {'status': 'error' if d.error else 'ready' if d.agent else 'loading',
                                   'model': 'convaiinnovations/laya', 'device': d.device})
        if self.path.startswith('/api/'):
            return self.json(404, {'error': 'Unknown endpoint'})
        if urlsplit(self.path).path in ('/', '/index.html'):
            html = (ROOT / 'www' / 'index.html').read_text(encoding='utf-8')
            html = html.replace('<script type="module"', '<script>window.SANDSCAPE_LOCAL_LAYA=true;</script><script type="module"', 1)
            raw = html.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(raw)
            return
        return super().do_GET()

    def do_POST(self):
        if not self.allowed():
            return self.json(403, {'error': 'Local requests only'})
        if self.path != '/api/suggest':
            return self.json(404, {'error': 'Unknown endpoint'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 4096:
                return self.json(413, {'error': 'Request too large or empty'})
            if self.headers.get_content_type() != 'application/json':
                return self.json(415, {'error': 'JSON required'})
            body = json.loads(self.rfile.read(size))
            prompt = body.get('prompt') if isinstance(body, dict) else None
            if not isinstance(prompt, str) or not 3 <= len(prompt.strip()) <= 240:
                return self.json(400, {'error': 'Enter a scene description of 3–240 characters'})
            # Root checkpoint is English; make its scope explicit rather than silently mistranslating.
            if any(ord(c) > 127 and c.isalpha() for c in prompt):
                return self.json(400, {'error': 'This local checkpoint supports English descriptions; use the palette controls for other languages'})
            return self.json(200, self.server.director.suggest(prompt.strip()))
        except (ValueError, UnicodeDecodeError):
            return self.json(400, {'error': 'Invalid request or model result'})
        except RuntimeError as exc:
            return self.json(503, {'error': str(exc)})
        except Exception as exc:
            print(f'Inference failed: {type(exc).__name__}: {exc}', flush=True)
            return self.json(500, {'error': 'Laya inference failed; manual controls remain available'})

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4187)
    parser.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT / 'www')))
    server.director = Director(args.device)
    threading.Thread(target=server.director.load, daemon=True).start()
    print(f'SandScape: http://127.0.0.1:{args.port}', flush=True)
    server.serve_forever()

if __name__ == '__main__':
    main()
