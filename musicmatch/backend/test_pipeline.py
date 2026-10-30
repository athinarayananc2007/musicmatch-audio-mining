import os
import glob
from audio_features import extract_features
from recommender import process_songs_data, get_recommendations_for_song

sample_dir = os.path.join(os.path.dirname(__file__), "..", "sample_tracks")
files = sorted(glob.glob(os.path.join(sample_dir, "*.wav")))
print(f"Testing pipeline with {len(files)} sample files...")

songs_data = []
for f in files:
    feats = extract_features(f)
    print(f"Extracted {os.path.basename(f)}: 18 features, tempo={feats[13]:.1f}, centroid={feats[14]:.1f}")
    assert len(feats) == 18, f"Expected 18 features, got {len(feats)}!"
    songs_data.append({
        "name": os.path.basename(f),
        "features": feats,
        "tempo": feats[13],
        "spectral_centroid": feats[14]
    })

enriched, scaled, sim_matrix = process_songs_data(songs_data, requested_clusters=3)
print(f"Clusters created: {len(set(s['cluster'] for s in enriched))}")
for s in enriched:
    print(f"  {s['name']}: Cluster {s['cluster']} | PCA=({s['pca_x']:.2f}, {s['pca_y']:.2f}) | Tempo={s['tempo']}")

target = enriched[0]["name"]
recs = get_recommendations_for_song(target, enriched, sim_matrix, top_k=3)
print(f"Recommendations for '{target}':")
for r in recs:
    print(f"  -> {r['name']} (Sim: {r['similarity_percent']}%, Same Cluster: {r['same_cluster']})")

print("PIPELINE TEST PASSED SUCCESSFULLY!")
