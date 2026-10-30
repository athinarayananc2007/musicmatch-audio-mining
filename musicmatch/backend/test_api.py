import requests
import os
import glob

BASE_URL = "http://localhost:5000"

print("1. Testing GET /api/health ...")
r = requests.get(f"{BASE_URL}/api/health")
print("Status:", r.status_code, "Body:", r.json())
assert r.status_code == 200
assert r.json().get("status") == "ok"

print("\n2. Testing POST /api/analyze with sample wav files ...")
sample_files = sorted(glob.glob("musicmatch/sample_tracks/*.wav"))[:3]
files_payload = [("files", (os.path.basename(f), open(f, "rb"), "audio/wav")) for f in sample_files]
r = requests.post(f"{BASE_URL}/api/analyze", files=files_payload, data={"clusters": 2})
print("Status:", r.status_code)
analyze_data = r.json()
print("Clusters:", analyze_data.get("clusters_count"), "Songs analyzed:", len(analyze_data.get("songs", [])))
for s in analyze_data.get("songs", []):
    print(f"  - {s['name']}: cluster {s['cluster']}, tempo {s['tempo']}, pca: ({s['pca_x']}, {s['pca_y']})")
assert r.status_code == 200
assert len(analyze_data.get("songs", [])) == 3

print("\n3. Testing POST /api/recommend ...")
target_song = analyze_data["songs"][0]["name"]
r = requests.post(f"{BASE_URL}/api/recommend", data={"song": target_song, "count": 2})
print("Status:", r.status_code)
rec_data = r.json()
print("Target:", rec_data.get("target_song", {}).get("name"))
print("Recommendations count:", len(rec_data.get("recommendations", [])))
for rec in rec_data.get("recommendations", []):
    print(f"  -> {rec['name']} (Sim: {rec['similarity_percent']}%, Same Cluster: {rec['same_cluster']})")
assert r.status_code == 200
assert len(rec_data.get("recommendations", [])) == 2

print("\n4. Testing POST /api/contact ...")
contact_payload = {
    "name": "Test User",
    "email": "test@musicmatch.ai",
    "message": "Testing the contact endpoint validation and storage."
}
r = requests.post(f"{BASE_URL}/api/contact", json=contact_payload)
print("Status:", r.status_code, "Body:", r.json())
assert r.status_code == 200
assert r.json().get("status") == "success"

print("\nALL API ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY!")
