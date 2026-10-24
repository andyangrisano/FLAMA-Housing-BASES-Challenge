"""Local dev server for the house sim. Like `python3 -m http.server`, but tells the browser never to cache,
so every reload shows your latest edits to index.html, story.js, house.json and the robot files.

    python3 serve.py          # then open http://localhost:8000
"""
import http.server
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
print(f"Serving this folder at http://localhost:{port} (no caching). Ctrl+C to stop.")
http.server.ThreadingHTTPServer(("", port), NoCache).serve_forever()
