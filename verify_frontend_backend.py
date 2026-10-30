import urllib.request
import urllib.parse
import json

base_fe = "http://localhost:8080"
# Fall back to 8000 if 8080 is not available
try:
    urllib.request.urlopen("http://localhost:8080/index.html", timeout=1)
except Exception:
    base_fe = "http://localhost:8000"

base_be = "http://localhost:5000"

urls_to_check = [
    # Pages
    f"{base_fe}/index.html",
    f"{base_fe}/features.html",
    f"{base_fe}/how-it-works.html",
    f"{base_fe}/demo.html",
    f"{base_fe}/about.html",
    f"{base_fe}/contact.html",
    # Assets
    f"{base_fe}/css/style.css",
    f"{base_fe}/js/main.js",
    f"{base_fe}/js/scene.js",
    f"{base_fe}/js/auth.js",
    f"{base_fe}/js/demo.js",
    # Samples
    f"{base_fe}/samples/electronic_pulse_128bpm.wav",
    f"{base_fe}/samples/ambient_chill_80bpm.wav",
    f"{base_fe}/samples/acoustic_groove_110bpm.wav",
    f"{base_fe}/samples/techno_drive_138bpm.wav",
    f"{base_fe}/samples/lofi_vibes_86bpm.wav"
]

print(f"=== 1. VERIFYING ALL STATIC ASSETS & HTML PAGES ({base_fe}) ===")
all_passed = True
for url in urls_to_check:
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req) as response:
            code = response.getcode()
            print(f"[OK {code}] {url}")
    except Exception as e:
        print(f"[FAIL] {url} -> {e}")
        all_passed = False

print("\n=== 2. VERIFYING BACKEND /api/health ===")
health_ok = False
try:
    with urllib.request.urlopen(f"{base_be}/api/health") as response:
        data = json.loads(response.read().decode())
        print(f"[OK] Health check response: {data}")
        health_ok = (data.get("status") == "ok")
except Exception as e:
    print(f"[FAIL] Backend health check: {e}")
    all_passed = False

if not health_ok:
    print("[FAIL] Backend health check status was not 'ok'")
    all_passed = False

if all_passed:
    print("\nSUCCESS: All 15 frontend URLs and backend endpoints responded perfectly!")
else:
    print("\nFAIL: One or more resources failed!")
