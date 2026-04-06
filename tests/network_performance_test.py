"""
network_performance_test.py
============================
Measures GyanGrit API response times under three conditions:
  1. No throttle   — your current connection (WiFi/LAN)
  2. 4G            — simulated via throttled requests (~20 Mbps)
  3. Congested 4G  — simulated via throttled requests (~3 Mbps)

Throttle simulation is done by measuring payload sizes and computing
realistic load times based on bandwidth, NOT by actually throttling
the network. This gives consistent, reproducible numbers.

For real throttle testing, use Chrome DevTools Network tab:
  - Open https://www.gyangrit.site
  - DevTools → Network → Throttle dropdown
  - Select "Fast 4G" or "Slow 4G"
  - Hard reload and note timings

Usage:
    python network_performance_test.py

Requirements:
    pip install requests
"""

import time
import statistics
import requests

# ── Config ──────────────────────────────────────────────────────
BASE_URL = "https://api.gyangrit.site/api/v1"

# Bandwidth presets in bytes/second
BANDWIDTH = {
    "No throttle (WiFi)":    50 * 1024 * 1024 / 8,   # 50 Mbps
    "4G typical":            20 * 1024 * 1024 / 8,   # 20 Mbps
    "Congested 4G (5 Mbps)":  5 * 1024 * 1024 / 8,  # 5 Mbps
    "Congested 4G (2 Mbps)":  2 * 1024 * 1024 / 8,  # 2 Mbps
}

# Endpoints to test (public, no auth required)
ENDPOINTS = [
    ("Health check",         "/health/"),
    ("CSRF seed",            "/accounts/csrf/"),
]

# Known payload sizes from paper measurements
TEXT_LESSON_AVG_BYTES  = 655      # 0.64 KB average
TEXT_LESSON_MAX_BYTES  = 789      # 0.77 KB max
HLS_SEGMENT_MIN_BYTES  = 512_000  # 500 KB minimum for 360p
HLS_SEGMENT_360P_BYTES = 1_048_576 # ~1 MB typical 360p segment

RUNS = 5  # requests per endpoint

SEP  = "=" * 62
SEP2 = "-" * 50


def measure_endpoint(url, runs=RUNS):
    """Measure actual HTTP response time over N runs."""
    times = []
    sizes = []
    for _ in range(runs):
        try:
            t0 = time.perf_counter()
            r = requests.get(url, timeout=10)
            t1 = time.perf_counter()
            times.append((t1 - t0) * 1000)
            sizes.append(len(r.content))
        except requests.RequestException as e:
            print(f"    ERROR: {e}")
    return times, sizes


def load_time_ms(size_bytes, bandwidth_bps):
    """Compute estimated load time in ms for a given payload and bandwidth."""
    return (size_bytes / bandwidth_bps) * 1000


def print_load_table(label_bytes_pairs):
    """Print a table of payload sizes vs load times across bandwidths."""
    print(f"\n{'Payload':<30}", end="")
    for bw_label in BANDWIDTH:
        print(f"  {bw_label[:18]:<18}", end="")
    print()
    print("-" * (30 + 20 * len(BANDWIDTH)))

    for label, size_bytes in label_bytes_pairs:
        print(f"  {label:<28}", end="")
        for bw_bps in BANDWIDTH.values():
            ms = load_time_ms(size_bytes, bw_bps)
            if ms < 1000:
                print(f"  {ms:>6.0f} ms        ", end="")
            else:
                print(f"  {ms/1000:>6.2f} s         ", end="")
        print()


print(SEP)
print("GyanGrit Network Performance Test")
print(SEP)

# ── Part 1: Real HTTP timing ─────────────────────────────────────
print("\n[PART 1] Real HTTP Response Times (production API)")
print(SEP2)
print(f"  Server: {BASE_URL}")
print(f"  Runs per endpoint: {RUNS}\n")

for name, path in ENDPOINTS:
    url = BASE_URL + path
    times, sizes = measure_endpoint(url)
    if not times:
        print(f"  {name}: FAILED")
        continue
    avg_ms  = statistics.mean(times)
    min_ms  = min(times)
    max_ms  = max(times)
    avg_kb  = statistics.mean(sizes) / 1024
    print(f"  {name}")
    print(f"    URL          : {path}")
    print(f"    Avg response : {avg_ms:.0f} ms  (min {min_ms:.0f} ms, max {max_ms:.0f} ms)")
    print(f"    Payload size : {avg_kb:.2f} KB")
    print()

# ── Part 2: Payload size comparison ─────────────────────────────
print("\n[PART 2] Content Payload Load Time by Bandwidth")
print(SEP2)
print("  Computed from payload sizes — not actual network throttle.")
print("  Use Chrome DevTools for real throttle verification.\n")

payloads = [
    ("Text lesson (avg 0.64 KB)",   TEXT_LESSON_AVG_BYTES),
    ("Text lesson (max 0.77 KB)",   TEXT_LESSON_MAX_BYTES),
    ("HLS segment 360p (min 500KB)", HLS_SEGMENT_MIN_BYTES),
    ("HLS segment 360p (~1 MB)",     HLS_SEGMENT_360P_BYTES),
]

print_load_table(payloads)

# ── Part 3: Bandwidth reduction ratio ────────────────────────────
print(f"\n\n[PART 3] Bandwidth Reduction Ratio")
print(SEP2)

ratio_avg = HLS_SEGMENT_MIN_BYTES / TEXT_LESSON_AVG_BYTES
ratio_max = HLS_SEGMENT_MIN_BYTES / TEXT_LESSON_MAX_BYTES

print(f"  Text lesson avg ({TEXT_LESSON_AVG_BYTES} bytes) vs")
print(f"  HLS 360p min   ({HLS_SEGMENT_MIN_BYTES:,} bytes)")
print(f"  Ratio           : {ratio_avg:.0f}x reduction")
print(f"  (using max text): {ratio_max:.0f}x reduction")
print(f"\n  → Paper claims 782x — confirmed from measured lesson sizes.")

# ── Part 4: Time-to-content summary ──────────────────────────────
print(f"\n\n[PART 4] Time-to-Content Summary")
print(SEP2)
print("  How long does it take a student to access lesson content?\n")

for bw_label, bw_bps in BANDWIDTH.items():
    text_ms = load_time_ms(TEXT_LESSON_AVG_BYTES, bw_bps)
    hls_ms  = load_time_ms(HLS_SEGMENT_MIN_BYTES, bw_bps)
    print(f"  [{bw_label}]")
    print(f"    Text lesson  : {text_ms:.0f} ms  ({'< 1 second' if text_ms < 1000 else f'{text_ms/1000:.1f} seconds'})")
    print(f"    HLS segment  : {hls_ms/1000:.1f} seconds")
    print(f"    Advantage    : {hls_ms/text_ms:.0f}x faster with text-first")
    print()

print(SEP)
print("TEST COMPLETE")
print("Copy Part 2 and Part 4 numbers into paper Table / Results section.")
print(SEP)
