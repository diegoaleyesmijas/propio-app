#!/usr/bin/env python3
"""Local static preview with API proxy to production.

Serves files from the repo root and forwards API requests to the deployed
backend so admin.js/demo.js can keep using same-origin API URLs locally.
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import os


UPSTREAM = os.environ.get("PREVIEW_UPSTREAM", "https://codigodecaballeros.site").rstrip("/")
PORT = int(os.environ.get("PREVIEW_PORT", "5174"))

API_PREFIXES = (
    "/admin/",
    "/services",
    "/available-slots",
    "/book",
    "/manage/",
    "/docs",
    "/openapi.json",
)


class PreviewHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/":
            self.path = "/demo.html"
            return super().do_GET()
        if self._is_api_request():
            return self._proxy()
        return super().do_GET()

    def do_POST(self):
        return self._proxy()

    def do_PATCH(self):
        return self._proxy()

    def do_DELETE(self):
        return self._proxy()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization,Content-Type")
        self.end_headers()

    def _is_api_request(self):
        return any(self.path.startswith(prefix) for prefix in API_PREFIXES)

    def _proxy(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length) if length else None
        upstream_url = UPSTREAM + self.path

        headers = {}
        for name in ("Authorization", "Content-Type", "Accept"):
            value = self.headers.get(name)
            if value:
                headers[name] = value

        req = Request(upstream_url, data=body, headers=headers, method=self.command)
        try:
            with urlopen(req, timeout=20) as res:
                self._send_upstream_response(res.status, res.headers, res.read())
        except HTTPError as exc:
            self._send_upstream_response(exc.code, exc.headers, exc.read())
        except URLError as exc:
            msg = f"Proxy error: {exc.reason}".encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def _send_upstream_response(self, status, upstream_headers, data):
        self.send_response(status)
        for name, value in upstream_headers.items():
            lower = name.lower()
            if lower in {"connection", "transfer-encoding", "content-encoding"}:
                continue
            self.send_header(name, value)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), PreviewHandler)
    print(f"Local preview: http://127.0.0.1:{PORT}/admin.html")
    print(f"Public demo:   http://127.0.0.1:{PORT}/demo.html")
    print(f"Proxying API:  {UPSTREAM}")
    server.serve_forever()
