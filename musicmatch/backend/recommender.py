"""
MusicMatch Recommender & Clustering Engine
==========================================
Data Mining Pipeline - Steps 3, 4 & 5: Scale, Cluster, Recommend & Project

This module performs statistical modeling and unsupervised learning:
- Step 3: Scale: Normalizes feature distributions using StandardScaler (z-score scaling).
- Step 4: Cluster: Unsupervised partitioning via K-Means (random_state=42, n_init=10).
- Step 5: Recommend: Calculates high-dimensional Cosine Similarity across songs.
- Dimension Reduction: Generates 2D coordinates using PCA for visual mapping.
- [NEW] Auto-K Selection: Elbow method (inertia) + Silhouette Score for optimal cluster count.
"""

from typing import Any
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.metrics import silhouette_score
from sklearn.decomposition import PCA


def find_optimal_k(scaled_features: np.ndarray, max_k: int = 10) -> dict[str, Any]:
    """
    Compute Elbow Method (inertia) and Silhouette Scores to suggest the optimal
    number of K-Means clusters for the given scaled feature matrix.

    Parameters:
        scaled_features (np.ndarray): Z-score scaled feature matrix, shape (N, D).
        max_k (int): Maximum number of clusters to evaluate (default: 10).

    Returns:
        dict with:
            - 'k_range': list of K values tested
            - 'inertia': list of within-cluster sum-of-squares (elbow curve)
            - 'silhouette': list of silhouette scores (-1 to 1; higher is better)
            - 'suggested_k': recommended K based on highest silhouette score
            - 'elbow_k': estimated elbow point using the knee/elbow detection heuristic
    """
    n_samples = scaled_features.shape[0]
    k_max = min(max_k, n_samples - 1)  # silhouette needs at least 2 clusters < n_samples
    k_min = 2

    if n_samples < 4:
        return {
            "k_range": [2],
            "inertia": [0.0],
            "silhouette": [0.0],
            "suggested_k": 2,
            "elbow_k": 2
        }

    k_range = list(range(k_min, k_max + 1))
    inertia_list = []
    silhouette_list = []

    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(scaled_features)
        inertia_list.append(float(km.inertia_))
        # silhouette_score requires at least 2 distinct labels
        if len(set(labels)) >= 2:
            sil = silhouette_score(scaled_features, labels)
            silhouette_list.append(float(sil))
        else:
            silhouette_list.append(0.0)

    # Best K by silhouette (highest score = most separated clusters)
    best_sil_idx = int(np.argmax(silhouette_list))
    suggested_k = k_range[best_sil_idx]

    # Elbow detection using the "knee" heuristic (max curvature via second derivative)
    if len(inertia_list) >= 3:
        inertia_arr = np.array(inertia_list)
        deltas = np.diff(inertia_arr)
        delta2 = np.diff(deltas)
        elbow_idx = int(np.argmax(np.abs(delta2))) + 1  # +1 offset for double-diff
        elbow_k = k_range[min(elbow_idx, len(k_range) - 1)]
    else:
        elbow_k = suggested_k

    return {
        "k_range": k_range,
        "inertia": inertia_list,
        "silhouette": silhouette_list,
        "suggested_k": suggested_k,
        "elbow_k": elbow_k
    }


def process_songs_data(
    songs_data: list[dict[str, Any]], 
    requested_clusters: int = 3
) -> tuple[list[dict[str, Any]], np.ndarray, np.ndarray]:
    """
    Takes extracted features for all songs, scales them, applies K-Means clustering,
    computes 2D PCA coordinates, and computes the pairwise cosine similarity matrix.

    Parameters:
        songs_data (list[dict]): List of dictionaries with 'name', 'features' (18 numbers),
                                 'tempo', and 'spectral_centroid'.
        requested_clusters (int): Desired number of clusters (capped at len(songs_data)).

    Returns:
        tuple:
            - enriched_songs (list[dict]): Songs with 'cluster', 'pca_x', and 'pca_y' added.
            - scaled_features (np.ndarray): Z-score scaled feature matrix.
            - similarity_matrix (np.ndarray): Pairwise cosine similarity matrix.
    """
    n_songs = len(songs_data)
    if n_songs < 3:
        raise ValueError(f"At least 3 songs are required for clustering analysis. Provided: {n_songs}")

    # Build raw feature matrix X: shape (N, D) — D may be 15 or 18 depending on version
    raw_features = np.array([song['features'] for song in songs_data], dtype=float)

    # --- DATA MINING STEP 3: SCALE FEATURES ---
    # StandardScaler transforms each feature to mean 0, variance 1.
    # This prevents high-magnitude features (such as tempo or spectral centroid)
    # from dominating lower-magnitude features (such as MFCC coefficients).
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(raw_features)

    # --- DATA MINING STEP 4: CLUSTER SONGS (K-MEANS) ---
    # Constrain clusters: 1 <= k <= n_songs
    k = max(1, min(int(requested_clusters), n_songs))
    
    # Initialize K-Means with deterministic random_state=42 and n_init=10
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    cluster_labels = kmeans.fit_predict(scaled_features)

    # --- DIMENSION REDUCTION: 2D PCA PROJECTION ---
    # Project N-dimensional scaled acoustic space down to 2 principal components
    # to facilitate 2D visual mapping and spatial comprehension.
    pca = PCA(n_components=2, random_state=42)
    pca_coords = pca.fit_transform(scaled_features)

    # --- DATA MINING STEP 5: CALCULATE COSINE SIMILARITY ---
    # Computes pairwise cosine similarity: dot(u, v) / (||u|| * ||v||)
    similarity_matrix = cosine_similarity(scaled_features)

    # Assemble enriched song objects for API response
    enriched_songs = []
    for idx, song in enumerate(songs_data):
        enriched_songs.append({
            "name": song["name"],
            "tempo": round(float(song.get("tempo", 0.0)), 1),
            "spectral_centroid": round(float(song.get("spectral_centroid", 0.0)), 1),
            "chroma_mean": round(float(song.get("chroma_mean", 0.0)), 4),
            "zcr_mean": round(float(song.get("zcr_mean", 0.0)), 6),
            "rms_mean": round(float(song.get("rms_mean", 0.0)), 6),
            "cluster": int(cluster_labels[idx]),
            "pca_x": round(float(pca_coords[idx, 0]), 4),
            "pca_y": round(float(pca_coords[idx, 1]), 4),
            "original_index": idx
        })

    return enriched_songs, scaled_features, similarity_matrix


def get_recommendations_for_song(
    target_song_name: str,
    enriched_songs: list[dict[str, Any]],
    similarity_matrix: np.ndarray,
    top_k: int = 3
) -> list[dict[str, Any]]:
    """
    Finds the most acoustically similar songs to the target song using cosine similarity.
    
    Parameters:
        target_song_name (str): Name of the reference song.
        enriched_songs (list[dict]): Processed songs containing cluster and metadata.
        similarity_matrix (np.ndarray): Pairwise similarity matrix.
        top_k (int): Number of recommendations to return (1 to 5).
        
    Returns:
        list[dict]: List of recommended songs with similarity score and same_cluster flag.
    """
    # Locate target song index
    names = [s["name"] for s in enriched_songs]
    if target_song_name not in names:
        raise ValueError(f"Song '{target_song_name}' not found in analyzed catalog.")
    
    target_idx = names.index(target_song_name)
    target_cluster = enriched_songs[target_idx]["cluster"]

    # Extract similarity row for the target song
    sim_scores = similarity_matrix[target_idx]

    # Rank other songs by descending cosine similarity (excluding the query song itself)
    candidates = []
    for i, s in enumerate(enriched_songs):
        if i == target_idx:
            continue
        sim = float(sim_scores[i])
        # Bound similarity between -1.0 and 1.0, convert to intuitive percentage (0% - 100%)
        sim_clamped = max(-1.0, min(1.0, sim))
        sim_percent = max(0.0, min(100.0, (sim_clamped + 1.0) / 2.0 * 100.0))

        candidates.append({
            "name": s["name"],
            "cluster": s["cluster"],
            "same_cluster": bool(s["cluster"] == target_cluster),
            "similarity": round(sim_clamped, 4),
            "similarity_percent": round(sim_percent, 1),
            "tempo": s["tempo"],
            "pca_x": s["pca_x"],
            "pca_y": s["pca_y"]
        })

    # Sort descending by similarity
    candidates.sort(key=lambda x: x["similarity"], reverse=True)
    
    # Return top_k
    k_clamped = max(1, min(int(top_k), len(candidates)))
    return candidates[:k_clamped]
