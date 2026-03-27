from http.server import HTTPServer, BaseHTTPRequestHandler
import threading, time

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        def _deliver():
            time.sleep(3)
            print("Delivery complete")
        
        t = threading.Thread(target=_deliver, daemon=True)
        t.start()
        
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        body = b'{"status": "ok"}'
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        print("Response finished")

server = HTTPServer(('localhost', 8080), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()

import urllib.request
print("Sending request...")
t0 = time.time()
req = urllib.request.Request('http://localhost:8080', method='POST')
urllib.request.urlopen(req)
print(f"Request done in {time.time()-t0:.2f}s")
time.sleep(4)
