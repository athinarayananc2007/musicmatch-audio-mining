import requests
import os
import glob

BASE_URL = "http://localhost:5000"

print("=== 1. TEST DYNAMIC SINGLE-TRACK USER INPUT (/api/analyze) ===")
sample_file = glob.glob("musicmatch/sample_tracks/*.wav")[0]
with open(sample_file, "rb") as f:
    r = requests.post(f"{BASE_URL}/api/analyze", files=[("files", ("my_user_audio.wav", f, "audio/wav"))])
print("Status:", r.status_code)
data = r.json()
print("Total analyzed:", data.get("total_analyzed"))
song = data.get("songs", [])[0]
print(f"Extracted: Tempo={song['tempo']} BPM, Spectral Centroid={song['spectral_centroid']} Hz, Cluster={song['cluster']}")
assert r.status_code == 200
assert data.get("total_analyzed") == 1

print("\n=== 2. TEST SPOTIFY RECOMMENDATIONS MATCHED TO EXTRACTED ACOUSTICS ===")
spot_payload = {
    "tempo": song["tempo"],
    "spectral_centroid": song["spectral_centroid"],
    "genre": "electronic",
    "limit": 4
}
r_spot = requests.post(f"{BASE_URL}/api/spotify/recommend", json=spot_payload)
print("Status:", r_spot.status_code)
spot_data = r_spot.json()
print("Source:", spot_data.get("source"))
print("Tracks returned:", len(spot_data.get("tracks", [])))
for t in spot_data.get("tracks", []):
    print(f"  [Track] {t['name']} by {t['artists']} | Match: {t['similarity_percent']}% | URL: {t['spotify_url']}")
assert r_spot.status_code == 200
assert len(spot_data.get("tracks", [])) > 0

print("\n=== 3. TEST SPOTIFY VERIFY ENDPOINT (INVALID CREDENTIALS TEST) ===")
r_ver = requests.post(f"{BASE_URL}/api/spotify/verify", json={"client_id": "test_dummy_id", "client_secret": "test_dummy_secret"})
print("Status:", r_ver.status_code, "Body:", r_ver.json())
assert r_ver.status_code == 401
assert r_ver.json().get("status") == "invalid"

print("\n=== 4. TEST MULTI-TRACK USER INPUT (K-MEANS & PCA) ===")
sample_files = sorted(glob.glob("musicmatch/sample_tracks/*.wav"))[:3]
files_payload = [("files", (f"user_song_{i}.wav", open(f, "rb"), "audio/wav")) for i, f in enumerate(sample_files)]
r_multi = requests.post(f"{BASE_URL}/api/analyze", files=files_payload, data={"clusters": 2})
print("Multi-track Status:", r_multi.status_code)
multi_data = r_multi.json()
print("Clusters formed:", multi_data.get("clusters_count"), "Songs:", len(multi_data.get("songs", [])))
assert r_multi.status_code == 200
assert len(multi_data.get("songs", [])) == 3

print("\n=== 5. TEST INTRA-CATALOG RECOMMENDATION ===")
r_rec = requests.post(f"{BASE_URL}/api/recommend", data={"song": "user_song_0.wav", "count": 2})
print("Rec status:", r_rec.status_code)
rec_data = r_rec.json()
print("Recommendations count:", len(rec_data.get("recommendations", [])))
assert r_rec.status_code == 200
assert len(rec_data.get("recommendations", [])) == 2

print("\nALL USER-DRIVEN DYNAMIC WORKFLOW TESTS PASSED PERFECTLY!")
