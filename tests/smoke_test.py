"""SandScape browser smoke test.

Serves ./www over a local HTTP server (ES modules require a real origin),
loads the app in headless Chromium, and asserts:
  - no console/page errors
  - the simulation booted (canvas sized, grains present, renderer active)
  - the in-app self-test suite passes

Requires:
    python -m pip install playwright
    playwright install chromium
"""
import threading
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "www"
PORT = 4199


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):  # keep CI output clean
        pass


def main() -> None:
    server = HTTPServer(("127.0.0.1", PORT), partial(QuietHandler, directory=str(WEB)))
    threading.Thread(target=server.serve_forever, daemon=True).start()

    errors: list[str] = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
            )
            page = browser.new_page(viewport={"width": 430, "height": 932})
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))

            page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="domcontentloaded")
            page.wait_for_function("window.sandscape !== undefined")
            page.wait_for_timeout(1500)

            grid = page.evaluate("window.sandscape.sim.N")
            grains = page.evaluate("window.sandscape.sim.grainCount()")
            canvas_w = page.evaluate("document.getElementById('sim').width")
            assert canvas_w > 0, "canvas has no size"
            assert grains > 1000, f"simulation not seeded (grains={grains})"

            selftests = page.evaluate("window.sandscape.runSelfTests(window.sandscape.sim.N)")
            browser.close()
    finally:
        server.shutdown()

    assert not errors, f"browser errors: {errors}"
    assert selftests["pass"] == selftests["total"], f"self-tests: {selftests}"
    print(f"SMOKE PASS — grid {grid}x{grid}, {grains} grains, "
          f"self-tests {selftests['pass']}/{selftests['total']}, no console errors")


if __name__ == "__main__":
    main()
