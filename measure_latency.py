import urllib.request
import urllib.error
import json
import time
import ssl
import statistics
from dataclasses import dataclass
from typing import List, Optional

# =========================
# CONFIGURATION
# =========================

OLD_URL = "https://gyangrit.onrender.com/api/v1/auth/login/"
NEW_URL = "https://api.gyangrit.site/api/v1/auth/login/"

REQUESTS = 15       # number of measured requests
WARMUP = 3          # warmup requests (not measured)
TIMEOUT = 15        # seconds
SLEEP_BETWEEN = 0.5 # seconds between requests

PAYLOAD = {
    "identifier": "test_user",
    "password": "test_password"
}

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Connection": "keep-alive"
}


# =========================
# SSL CONTEXT
# =========================

def create_ssl_context():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


# =========================
# RESULT STRUCTURE
# =========================

@dataclass
class BenchmarkResult:
    latencies: List[float]
    errors: int

    @property
    def count(self):
        return len(self.latencies)

    @property
    def mean(self):
        return statistics.mean(self.latencies)

    @property
    def median(self):
        return statistics.median(self.latencies)

    @property
    def minimum(self):
        return min(self.latencies)

    @property
    def maximum(self):
        return max(self.latencies)

    @property
    def stdev(self):
        if len(self.latencies) > 1:
            return statistics.stdev(self.latencies)
        return 0

    @property
    def p95(self):
        if not self.latencies:
            return 0
        sorted_data = sorted(self.latencies)
        index = int(len(sorted_data) * 0.95) - 1
        return sorted_data[max(index, 0)]


# =========================
# SINGLE REQUEST
# =========================

def measure_once(url: str, ctx) -> Optional[float]:

    data = json.dumps(PAYLOAD).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers=HEADERS,
        method="POST"
    )

    start = time.perf_counter()

    try:
        urllib.request.urlopen(
            req,
            timeout=TIMEOUT,
            context=ctx
        )

    except urllib.error.HTTPError:
        # expected invalid login
        pass

    except Exception as e:
        print("Request error:", e)
        return None

    end = time.perf_counter()

    return (end - start) * 1000


# =========================
# BENCHMARK RUNNER
# =========================

def benchmark(url: str) -> BenchmarkResult:

    print("\n====================================")
    print("Benchmarking:", url)
    print("====================================")

    ctx = create_ssl_context()

    # Warmup
    print("\nWarmup phase...")
    for i in range(WARMUP):
        measure_once(url, ctx)
        print(f"Warmup {i+1}/{WARMUP}")

    print("\nMeasurement phase...")

    latencies = []
    errors = 0

    for i in range(REQUESTS):

        latency = measure_once(url, ctx)

        if latency is None:
            errors += 1
            print(f"Request {i+1}: FAILED")
        else:
            latencies.append(latency)
            print(f"Request {i+1}: {latency:.2f} ms")

        time.sleep(SLEEP_BETWEEN)

    return BenchmarkResult(
        latencies=latencies,
        errors=errors
    )


# =========================
# PRINT STATISTICS
# =========================

def print_stats(name: str, result: BenchmarkResult):

    if result.count == 0:
        print(f"\n{name}: NO VALID DATA")
        return

    print("\n------------------------------------")
    print(name)
    print("------------------------------------")

    print(f"Requests: {result.count}")
    print(f"Errors:   {result.errors}")

    print(f"Mean:     {result.mean:.2f} ms")
    print(f"Median:   {result.median:.2f} ms")
    print(f"P95:      {result.p95:.2f} ms")

    print(f"Min:      {result.minimum:.2f} ms")
    print(f"Max:      {result.maximum:.2f} ms")
    print(f"Std Dev:  {result.stdev:.2f} ms")


# =========================
# COMPARISON
# =========================

def compare(old: BenchmarkResult, new: BenchmarkResult):

    if old.count == 0 or new.count == 0:
        print("\nComparison not possible.")
        return

    print("\n====================================")
    print("FINAL COMPARISON")
    print("====================================")

    diff = old.mean - new.mean
    speed_ratio = old.mean / new.mean

    if speed_ratio > 1:
        print(f"New server is {speed_ratio:.2f}x faster")
    else:
        print(f"New server is {1/speed_ratio:.2f}x slower")

    print(f"Average latency difference: {diff:.2f} ms")

    print("\nReality check thresholds:")
    print("Excellent API latency:   < 200 ms")
    print("Acceptable API latency:  200–500 ms")
    print("Poor API latency:        > 1000 ms")


# =========================
# MAIN
# =========================

def main():

    print("=== API LATENCY BENCHMARK ===")
    print("Testing login endpoint performance")

    old_result = benchmark(OLD_URL)
    new_result = benchmark(NEW_URL)

    print_stats("OLD Backend", old_result)
    print_stats("NEW Backend", new_result)

    compare(old_result, new_result)


if __name__ == "__main__":
    main()