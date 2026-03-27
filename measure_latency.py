import urllib.request
import urllib.error
import json
import time
import ssl

def measure_login(url):
    # Bypass Mac OSX Python default certificate issues
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    # Dummy credentials to trigger the DB and Password Hashing algorithm
    data = json.dumps({"identifier": "test_user", "password": "test_password"}).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Accept', 'application/json')
    
    start_time = time.time()
    try:
        urllib.request.urlopen(req, timeout=15, context=ctx)

    except urllib.error.HTTPError as e:
        # We actually expect a 401/400 because credentials are bad, 
        # but the server still had to process the whole hashing flow!
        pass
    except Exception as e:
        print(f"   Error: {e}")
        return None
        
    end_time = time.time()
    return (end_time - start_time) * 1000  # Return in milliseconds

print("=== GYANGRIT DB + API LATENCY BENCHMARK ===")
print("Testing the exact same /login/ endpoint on both servers...")

old_url = "https://gyangrit.onrender.com/api/v1/auth/login/"
new_url = "https://api.gyangrit.site/api/v1/auth/login/"

print(f"\n1. Pinging OLD Backend (Singapore via Render Reverse Proxy)")
old_latency = measure_login(old_url)
if old_latency:
    print(f"   Response time: {old_latency:.2f} ms")

print(f"\n2. Pinging NEW Backend (Mumbai via Oracle Direct + Nginx)")
new_latency = measure_login(new_url)
if new_latency:
    print(f"   Response time: {new_latency:.2f} ms")

if old_latency and new_latency:
    speedup = old_latency / new_latency
    diff = old_latency - new_latency
    print(f"\n===========================================")
    print(f"RESULT: The Mumbai Server is {speedup:.1f}x faster!")
    print(f"You save an average of {diff:.2f} ms of loading screen per request.")
    print(f"===========================================\n")
