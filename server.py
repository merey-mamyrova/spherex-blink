#!/usr/bin/env python3
"""SPHEREx Blink: local server.

Serves the site and forwards data requests to the NASA/IPAC archive (IRSA),
because the archive does not allow browsers to call it from another site.

Run:   python3 server.py
Open:  http://localhost:8765
No packages to install; standard library only.
"""
import json
import os
import re
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
IRSA = "https://irsa.ipac.caltech.edu/"
ALLOWED = ("TAP/", "ibe/")          # only the archive services the site needs
PORT = int(os.environ.get("PORT", "8765"))
CHUNK = 32768


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        if "/irsa/" not in str(args[0] if args else ""):
            sys.stderr.write("%s\n" % (fmt % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # ---- proxy to IRSA ----
    def do_GET(self):
        if not self.path.startswith("/irsa/"):
            return super().do_GET()
        rest = self.path[len("/irsa/"):]
        if not rest.startswith(ALLOWED) or ".." in rest:
            return self.send_error(403, "path not allowed")
        url = IRSA + rest
        try:
            self._via_urllib(url)
        except ssl.SSLError:
            self._via_curl(url)
        except urllib.error.URLError as e:
            if isinstance(getattr(e, "reason", None), ssl.SSLError):
                self._via_curl(url)
            else:
                self._fail(503, str(e))
        except (BrokenPipeError, ConnectionResetError):
            pass                      # the page stopped reading early: expected
        except Exception as e:        # noqa: BLE001
            self._fail(502, str(e))

    def _fail(self, code, msg):
        try:
            self.send_error(code, msg[:200])
        except Exception:             # noqa: BLE001
            pass

    def _via_urllib(self, url):
        req = urllib.request.Request(url, headers={"User-Agent": "spherex-blink/1.0"})
        try:
            up = urllib.request.urlopen(req, timeout=180)
        except urllib.error.HTTPError as e:
            return self._fail(e.code, e.reason or "upstream error")
        with up:
            self.send_response(200)
            self.send_header("Content-Type", up.headers.get("Content-Type", "application/octet-stream"))
            self.end_headers()
            while True:
                buf = up.read(CHUNK)
                if not buf:
                    break
                self.wfile.write(buf)

    def _via_curl(self, url):
        p = subprocess.Popen(["curl", "-sS", "-f", "-L", "--max-time", "180", url],
                             stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        first = p.stdout.read(CHUNK)
        if not first:
            p.wait()
            return self._fail(503, "upstream busy")
        try:
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.end_headers()
            self.wfile.write(first)
            while True:
                buf = p.stdout.read(CHUNK)
                if not buf:
                    break
                self.wfile.write(buf)
        finally:
            p.kill()

    # ---- save a processed field into data/ (used once to build the offline cache) ----
    def do_POST(self):
        m = re.fullmatch(r"/save/([a-z0-9_-]{1,40})\.json", self.path)
        if not m or self.client_address[0] not in ("127.0.0.1", "::1"):
            return self.send_error(403)
        n = int(self.headers.get("Content-Length", "0"))
        if n <= 0 or n > 40_000_000:
            return self.send_error(413)
        body = self.rfile.read(n)
        try:
            json.loads(body)
        except ValueError:
            return self.send_error(400, "not JSON")
        os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
        with open(os.path.join(ROOT, "data", m.group(1) + ".json"), "wb") as f:
            f.write(body)
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self._cors()
        self.end_headers()
        self.wfile.write(b"saved")

    def _cors(self):
        # lets a page opened on the archive's own site hand finished data to this server
        self.send_header("Access-Control-Allow-Origin", "https://irsa.ipac.caltech.edu")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    srv.daemon_threads = True
    print("SPHEREx Blink: http://localhost:%d   (Ctrl+C to stop)" % PORT)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
