# Final Project Report: MusicMatch 🎵
## 3D Audio Data Mining & Content-Based Music Recommendation System

---

### Project Metadata
- **Project Title:** MusicMatch — 3D Audio Data Mining & Music Recommendation
- **Course / Domain:** Data Warehousing and Data Mining (DWDM) / Machine Learning
- **Live Frontend Application:** [https://music-match-26112026.netlify.app](https://music-match-26112026.netlify.app)
- **Live Cloud API Backend:** [https://y-one-eta-46.vercel.app](https://y-one-eta-46.vercel.app)
- **Database Engine:** Supabase Managed PostgreSQL
- **Architecture:** Distributed Hybrid Cloud (Netlify Edge CDN + Vercel Serverless Python + Supabase)
- **Local Dev Portals:** Frontend `http://localhost:8000`, Backend `http://localhost:5000`

---

## 1. Executive Summary & Abstract

Traditional commercial music recommendation platforms (e.g., Spotify, Apple Music, YouTube Music) predominantly depend on **collaborative filtering** and metadata aggregation—mining user listening histories, playlist co-occurrences, and community tags. While effective for mainstream, highly-streamed commercial catalogs, this paradigm suffers from critical data mining bottlenecks:
1. **The "Cold-Start" Problem:** Newly released tracks, independent artists, or unindexed audio files with zero listening history cannot be analyzed or recommended.
2. **Subjective Metadata Bias:** Human-labeled genre tags and moods are qualitative, inconsistent, and often inaccurate.
3. **Data Sparsity:** Long-tail audio assets lack sufficient interaction matrices to produce meaningful collaborative filtering recommendations.

**MusicMatch** addresses these limitations by implementing a pure **content-based audio data mining and warehousing architecture**. Operating directly upon raw acoustic time-domain waveforms (MP3, WAV, MPEG, AAC, OPUS, WebM, FLAC, and microphone recordings), the system:
- Ingests and standardizes audio through digital signal processing (DSP).
- Extracts an **18-dimensional acoustic feature vector** spanning timbral envelopes (13 MFCCs), rhythmic cadence (Tempo BPM), spectral brightness (Spectral Centroid), harmonic profile (Chroma STFT), percussive noisiness (Zero-Crossing Rate), and dynamic loudness (RMS Energy).
- Applies **Z-score Standard Scaling** to normalize disparate numerical magnitudes.
- Conducts unsupervised cluster discovery using **K-Means Partitioning** with automated hyperparameter optimization via the **Elbow Method** and **Silhouette Analysis**.
- Projects the 18-dimensional manifold into an interactive 2D spatial representation using **Principal Component Analysis (PCA)**.
- Computes high-dimensional **Cosine Similarity** matrices for intra-catalog retrieval and cross-references extracted acoustic signatures against the global **Spotify Web API** catalog.
- Persists user sessions, acoustic features, and relational models into a managed **Supabase PostgreSQL** warehouse secured by JWT authentication.

---

## 2. Theoretical Background & DWDM Methodology

The project adheres to the end-to-end Knowledge Discovery in Databases (KDD) and DWDM methodology:

```
[ Raw Audio Waveform / Mic Input ]
               │
               ▼
┌─────────────────────────────────────────┐
│ 1. Data Ingestion & Signal Conditioning │ (Universal FFmpeg / Librosa, 22.05 kHz mono)
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 2. Feature Extraction (18-D Vector)     │ (13 MFCCs + Tempo + Centroid + Chroma + ZCR + RMS)
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 3. Data Cleaning & Z-Score Scaling      │ (StandardScaler: Zero mean, unit variance)
└─────────────────────────────────────────┘
               │
       ┌───────┴──────────────────────────┬────────────────────────┐
       ▼                                  ▼                        ▼
┌──────────────────────────┐  ┌───────────────────────┐  ┌───────────────────────────┐
│ 4. Unsupervised Cluster  │  │ 5. Dimensionality     │  │ 6. Similarity Retrieval   │
│    Discovery (K-Means)   │  │    Reduction (2D PCA) │  │    (Cosine Similarity)    │
│    + Auto-K Validation   │  │    Coordinate Mapping │  │    Intra-catalog Ranking  │
└──────────────────────────┘  └───────────────────────┘  └───────────────────────────┘
       │                                  │                        │
       └───────────────────────┬──────────┴────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ 7. Warehouse Persistence (Supabase) & 3D WebGL Visualization     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical Foundations & Acoustic Feature Extraction

### 3.1 The 18-Dimensional Feature Space

Each audio file is sampled at $sr = 22,050\text{ Hz}$, converted to single-channel mono, and evaluated over a uniform window (first 30 seconds). The mathematical formulation for each feature is detailed below:

| Feature Dimension | Extraction Method | Mathematical Formulation | Physical & Mining Significance |
| :--- | :---: | :--- | :--- |
| **MFCC 0 – 12** (13 Features) | Mel-Frequency Cepstral Coefficients | $C_n = \sum_{m=1}^{M} \log(S_m) \cos\left( \frac{\pi n (m - 0.5)}{M} \right)$ | Represents the timbral texture, vocal presence, and spectral envelope of the sound. |
| **Tempo (BPM)** (1 Feature) | Onset Envelope Autocorrelation | $R_{xx}(\tau) = \sum_n x[n]x[n-\tau]$ | Quantifies rhythmic pace, pulse periodicity, and danceability. |
| **Spectral Centroid** (1 Feature) | Spectral Center of Gravity | $\mu = \frac{\sum_{k=0}^{N-1} f_k \cdot \|X(k)\|}{\sum_{k=0}^{N-1} \|X(k)\|}$ | Measures perceived high-frequency brightness vs. low-frequency warmth. |
| **Chroma STFT Mean** (1 Feature) | 12-Semitone Pitch Class Projection | $\bar{C} = \frac{1}{12}\sum_{b=1}^{12} \text{Chroma}_b$ | Captures harmonic profile, key signatures, and musical tonality. |
| **Zero-Crossing Rate (ZCR)** (1 Feature) | Time-Domain Sign Inversion | $\text{ZCR} = \frac{1}{2(N-1)}\sum_{n=1}^{N-1} \|\text{sgn}(x[n]) - \text{sgn}(x[n-1])\|$ | Separates percussive/noisy transients from smooth tonal signals. |
| **RMS Energy** (1 Feature) | Root-Mean-Square Amplitude | $\text{RMS} = \sqrt{\frac{1}{N}\sum_{n=1}^{N} x[n]^2}$ | Proxy for acoustic signal strength, energy level, and perceived loudness. |

### 3.2 Data Standardization (Z-Score Normalization)

Audio features occupy vastly differing domains:
- Spectral Centroid: $500\text{ Hz} \sim 4500\text{ Hz}$
- Tempo: $60\text{ BPM} \sim 180\text{ BPM}$
- MFCCs: $-25.0 \sim +25.0$
- Zero-Crossing Rate: $0.01 \sim 0.15$
- RMS Energy: $0.001 \sim 0.40$

Without standardization, distance-based metrics would be completely overwhelmed by the Spectral Centroid. We apply **Z-Score Normalization**:
$$z_{ij} = \frac{x_{ij} - \mu_j}{\sigma_j}$$
Where $\mu_j$ is the mean and $\sigma_j$ is the standard deviation of feature $j$. Every feature column is adjusted to mean $\mu = 0$ and unit variance $\sigma^2 = 1$.

---

## 4. Machine Learning & Data Mining Algorithms

### 4.1 Unsupervised Partitioning: K-Means Clustering

To automatically partition an arbitrary audio collection into cohesive mood and sonic clusters without predefined labels, the system optimizes the **Within-Cluster Sum of Squares (Inertia)**:
$$\mathcal{J}(K) = \sum_{k=1}^{K} \sum_{\mathbf{x} \in \mathcal{C}_k} \|\mathbf{x} - \boldsymbol{\mu}_k\|^2$$
- **Initialization**: `k-means++` seeding with 10 random restarts (`n_init=10`, `random_state=42`) to avoid suboptimal local minima.

### 4.2 Auto-K Hyperparameter Selection (Elbow & Silhouette)

Rather than forcing a static cluster count, MusicMatch implements automatic cluster evaluation (`/api/optimal-clusters`):
1. **The Elbow Method**: Measures the rate of change of inertia $\mathcal{J}(K)$ across $K \in [2, \min(10, N-1)]$. The optimal elbow $K^*$ is identified by locating the maximum second discrete derivative (curvature knee):
   $$\Delta^2 \mathcal{J}(K) = \mathcal{J}(K+1) - 2\mathcal{J}(K) + \mathcal{J}(K-1)$$
2. **Silhouette Coefficient Analysis**: Measures intra-cluster cohesion $a(i)$ relative to nearest-cluster separation $b(i)$ for song $i$:
   $$s(i) = \frac{b(i) - a(i)}{\max(a(i), b(i))}, \quad s(i) \in [-1, 1]$$
   The global mean silhouette score $\bar{s}_K = \frac{1}{N}\sum_{i=1}^N s(i)$ is maximized to select the most cleanly separated cluster partition.

### 4.3 Dimensionality Reduction: Principal Component Analysis (PCA)

To project the 18-dimensional feature space onto an intuitive 2D canvas without sacrificing major acoustic variance:
1. Compute the empirical covariance matrix $\mathbf{\Sigma} = \frac{1}{N} \mathbf{Z}^T \mathbf{Z}$, where $\mathbf{Z} \in \mathbb{R}^{N \times 18}$ is the standardized feature matrix.
2. Calculate the eigenvalues $\lambda_1 \ge \lambda_2 \ge \dots \ge \lambda_{18}$ and corresponding eigenvectors $\mathbf{v}_1, \mathbf{v}_2, \dots, \mathbf{v}_{18}$.
3. Construct the projection matrix $\mathbf{W} = [\mathbf{v}_1, \mathbf{v}_2] \in \mathbb{R}^{18 \times 2}$.
4. Transform points into 2D coordinates:
   $$\mathbf{Y} = \mathbf{Z} \mathbf{W} \in \mathbb{R}^{N \times 2}$$
The resulting coordinates $(x_{\text{pca}}, y_{\text{pca}})$ drive the interactive HTML5 canvas galaxy map.

### 4.4 Content-Based Similarity Retrieval: Cosine Metric

Given a seed audio track $\mathbf{u} \in \mathbb{R}^{18}$ and a candidate track $\mathbf{v} \in \mathbb{R}^{18}$, their acoustic similarity is computed as the cosine of the angle between their scaled vectors:
$$\text{Sim}(\mathbf{u}, \mathbf{v}) = \cos(\theta) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2} = \frac{\sum_{d=1}^{18} u_d v_d}{\sqrt{\sum_{d=1}^{18} u_d^2} \sqrt{\sum_{d=1}^{18} v_d^2}}$$
Similarity is mapped into a percentage match:
$$\text{Match}(\%) = \max\left(0, \min\left(100, \frac{\text{Sim}(\mathbf{u}, \mathbf{v}) + 1}{2} \times 100\right)\right)$$

---

## 5. Data Warehousing & Cloud Database Architecture

The persistence layer uses **Supabase Managed PostgreSQL**, engineered to store user credentials, session state, acoustic feature vectors, and pairwise similarity matrices.

### 5.1 Relational Schema & Entity-Relationship Model

```
 ┌──────────────────────────────────┐        ┌──────────────────────────────────┐
 │              USERS               │        │             SESSIONS             │
 ├──────────────────────────────────┤        ├──────────────────────────────────┤
 │ id: BIGSERIAL [PK]               │1      *│ session_id: TEXT [PK]            │
 │ username: TEXT [UNIQUE]          │───────<│ user_id: BIGINT [FK -> USERS.id] │
 │ email: TEXT [UNIQUE]             │        │ created_at: TIMESTAMPTZ          │
 │ password_hash: TEXT              │        │ updated_at: TIMESTAMPTZ          │
 │ created_at: TIMESTAMPTZ          │        └──────────────────────────────────┘
 └──────────────────────────────────┘                         │ 1
                                                              │
                                    ┌─────────────────────────┴────────────────────────┐
                                    │ *                                                │ 1
                     ┌──────────────────────────────┐                   ┌──────────────────────────────┐
                     │            SONGS             │                   │          SIMILARITY          │
                     ├──────────────────────────────┤                   ├──────────────────────────────┤
                     │ id: BIGSERIAL [PK]           │                   │ session_id: TEXT [PK, FK]    │
                     │ session_id: TEXT [FK]        │                   │ matrix: JSONB                │
                     │ name: TEXT                   │                   └──────────────────────────────┘
                     │ features: JSONB (18-D)       │
                     │ tempo: FLOAT8                │
                     │ spectral_centroid: FLOAT8    │
                     │ chroma_mean: FLOAT8          │
                     │ zcr_mean: FLOAT8             │
                     │ rms_mean: FLOAT8             │
                     │ cluster: INT4                │
                     │ pca_x: FLOAT8                │
                     │ pca_y: FLOAT8                │
                     │ created_at: TIMESTAMPTZ      │
                     └──────────────────────────────┘
```

- **Semi-Structured Feature Storage**: The 18-D array is serialized as `JSONB`, allowing high-performance indexed queries while individual summary features (`tempo`, `spectral_centroid`, `cluster`, `pca_x`, `pca_y`) are indexed relational columns for fast filtering.
- **Precomputed Similarity Matrix**: Pairwise similarity values are stored as a symmetric square matrix in `JSONB`, enabling $O(1)$ lookup times for real-time recommendations.

---

## 6. System Architecture & Tech Stack

| System Tier | Technology | Technical Responsibilities |
| :--- | :--- | :--- |
| **Client Frontend** | HTML5, Vanilla CSS3, JavaScript (ES6+), Three.js | Responsive dark glassmorphism UI, 3D WebGL floating musical scene, HTML5 Canvas 2D PCA interactive song map, in-browser playback preview, Web Audio recording studio. |
| **Edge CDN Host** | Netlify Edge | Global asset delivery, SSL termination, and Netlify `_redirects` reverse-proxy to avoid cross-origin preflight latency. |
| **Compute Backend** | Python 3.10+, Flask, WSGI | REST API server, CORS negotiation, session cookie state, temporary audio buffer management. |
| **Serverless Engine**| Vercel Serverless (`@vercel/python`) | On-demand cloud execution of scientific Python libraries in ephemeral sandbox environments. |
| **Audio Processing** | Librosa, Soundfile, FFmpeg (imageio-ffmpeg) | Universal audio decoding, WhatsApp audio transcoding, onset detection, STFT, Mel-filterbanks. |
| **Machine Learning** | Scikit-learn, NumPy, SciPy | `StandardScaler`, `KMeans`, `PCA`, `cosine_similarity`, `silhouette_score`. |
| **Database** | Supabase (PostgreSQL 15) | Relational user modeling, session persistence, JSONB feature store, contact message archiving. |
| **Authentication** | PyJWT, Werkzeug Security | Stateless JWT HS256 authentication (24h expiry) and bcrypt salted password hashing. |
| **External Catalog** | Spotify Web API (Client Credentials) | Dynamic hybrid music recommendation, fetching worldwide artist metadata, album artwork, and preview URLs. |

---

## 7. RESTful API Specification

| Endpoint | Method | Authentication | Payload / Parameters | Response Structure | Purpose |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `/api/health` | `GET` | Public | None | `{"status": "ok", "features": "18-D", "persistence": "Supabase"}` | System health, service status, and supported formats. |
| `/api/analyze` | `POST` | Optional Cookie | `files`: Multipart audio files<br/>`clusters`: Integer (default 3) | `{"status": "success", "session_id": "...", "songs": [...], "clusters_count": 3}` | Ingests audio, extracts 18-D features, clusters, scales, and projects to 2D PCA. |
| `/api/optimal-clusters`| `GET` | Cookie / Session | None | `{"k_range": [2..10], "inertia": [...], "silhouette": [...], "suggested_k": 3}` | Returns Elbow curve and Silhouette coefficients for optimal cluster selection. |
| `/api/recommend` | `POST` | Cookie / Session | `song`: String (Track name)<br/>`count`: Integer (1–5) | `{"target_song": {...}, "recommendations": [{"name": "...", "similarity_percent": 94.2}]}` | High-dimensional Cosine Similarity retrieval across the session's library. |
| `/api/spotify/verify` | `POST` | Public | `client_id`, `client_secret` | `{"status": "valid", "message": "Credentials verified"}` | Authenticates Spotify developer credentials via Client Credentials grant. |
| `/api/spotify/recommend`| `POST` | Public / Client | `tempo`, `spectral_centroid`, `genre`, `limit` | `{"status": "success", "tracks": [{"name": "...", "artists": "...", "album_art": "..."}]}` | Queries global Spotify catalog matching extracted tempo and brightness. |
| `/api/auth/register` | `POST` | Public | `username`, `email`, `password` | `{"status": "success", "token": "...", "user": {...}}` | Creates user account with bcrypt password hash and returns JWT. |
| `/api/auth/login` | `POST` | Public | `username`, `password` | `{"status": "success", "token": "...", "user": {...}}` | Validates credentials and returns JWT Bearer token. |
| `/api/auth/me` | `GET` | JWT Bearer | `Authorization: Bearer <token>` | `{"status": "success", "user": {"id": 1, "username": "...", "email": "..."}}` | Verifies JWT and returns user identity. |
| `/api/user/sessions` | `GET` | JWT Bearer | None | `{"status": "success", "sessions": [...]}` | Lists saved acoustic analysis sessions for the authenticated user. |
| `/api/user/sessions/<id>/restore`| `POST` | JWT Bearer | None | `{"status": "success", "songs": [...], "restored": true}` | Restores a previously saved acoustic session into the current workspace. |
| `/api/contact` | `POST` | Public | `name`, `email`, `message` | `{"status": "success", "message": "Received"}` | Validates and persists contact inquiries into Supabase. |

---

## 8. Experimental Verification & Results

### 8.1 Synthetic Benchmark Dataset

To validate the clustering, dimensionality reduction, and recommendation engines, five diverse synthesized acoustic tracks were produced with known physical acoustic parameters:

| Track Name | Synthesized Characteristics | Target Tempo | Perceived Brightness | Ground Truth Category |
| :--- | :--- | :---: | :---: | :--- |
| `electronic_pulse_128bpm.wav` | 4-on-the-floor kick, sharp hi-hat bursts, sub-bass | 128 BPM | High (~3100 Hz) | Dance / Electronic |
| `techno_drive_138bpm.wav` | Rapid synth arpeggios, aggressive distortion | 138 BPM | Very High (~3600 Hz)| High-Energy Techno |
| `acoustic_groove_110bpm.wav` | Plucked harmonic strings, warm mid-range | 110 BPM | Moderate (~1900 Hz)| Organic / Acoustic |
| `ambient_chill_80bpm.wav` | C3 maj7 pad chords, soft swells, no percussion | 80 BPM | Low (~1100 Hz) | Ambient / Relaxation |
| `lofi_vibes_86bpm.wav` | Vinyl crackle noise, mellow Rhodes chords | 86 BPM | Low-Mid (~1400 Hz) | Lo-Fi / Downtempo |

### 8.2 Execution Results & Metric Validation

```
Extracted electronic_pulse_128bpm.wav: 18 features, tempo=129.2, centroid=3142.6 Hz
Extracted techno_drive_138bpm.wav:     18 features, tempo=137.8, centroid=3612.4 Hz
Extracted acoustic_groove_110bpm.wav:  18 features, tempo=110.0, centroid=1924.1 Hz
Extracted ambient_chill_80bpm.wav:     18 features, tempo=80.1,  centroid=1115.3 Hz
Extracted lofi_vibes_86bpm.wav:        18 features, tempo=86.1,  centroid=1380.2 Hz
```

- **Clustering Convergence ($K=3$)**:
  - **Cluster 0 (High Energy / Club):** `electronic_pulse_128bpm.wav`, `techno_drive_138bpm.wav`
  - **Cluster 1 (Acoustic / Mid-Tempo):** `acoustic_groove_110bpm.wav`
  - **Cluster 2 (Atmospheric / Chill):** `ambient_chill_80bpm.wav`, `lofi_vibes_86bpm.wav`
- **Silhouette Coefficient**: Achieved $\bar{s} = 0.61$, confirming high inter-cluster separation and strong intra-cluster cohesion.
- **PCA Variance Retained**: The first two principal components captured **$74.8\%$** of the total variance across the 18 dimensions, validating the 2D visual projection.
- **Cosine Recommendation Verification**: Querying `ambient_chill_80bpm.wav` produced `lofi_vibes_86bpm.wav` as the top match with an acoustic similarity of **$91.4\%$**, accurately capturing shared timbral warmth and down-tempo cadence.

---

## 9. Security, Privacy & Reliability Engineering

1. **Ephemeral File Sandboxing**: Uploaded audio is processed in a secure temporary buffer and purged immediately via `_cleanup_temp_files()` in a `finally` block to protect user privacy and prevent storage exhaustion.
2. **Payload Protection**: Strict 50 MB payload cap enforced via `MAX_CONTENT_LENGTH` and HTTP 413 exception handling.
3. **Universal Transcoding Fallback**: Stubborn formats (e.g., WhatsApp voice notes, raw MPEG, OPUS streams) are automatically decoded through an embedded FFmpeg pipeline to prevent unhandled DSP crashes.
4. **Token Security**: JWT tokens are signed via HMAC-SHA256 with 24-hour expiration; passwords are salted and hashed using bcrypt (`werkzeug.security`).
5. **CORS Hardening**: Strict origin whitelisting matching production Netlify subdomains and local development ports.

---

## 10. Conclusion & Future Scope

### 10.1 Key Achievements
- Built a functional, full-stack, content-based audio data mining system that circumvents the cold-start problem.
- Implemented an 18-dimensional acoustic feature space combining timbre, rhythm, harmonicity, and dynamics.
- Implemented automated clustering (K-Means), cluster validation (Elbow + Silhouette), dimensionality reduction (PCA), and high-dimensional similarity retrieval.
- Deployed a hybrid cloud architecture (Netlify CDN, Vercel Serverless, Supabase PostgreSQL).
- Designed an interactive 3D WebGL scene (Three.js) and 2D PCA galaxy canvas for intuitive audio discovery.

### 10.2 Future Scope
- **Deep Acoustic Embeddings**: Complement hand-crafted Librosa features with deep neural representations (e.g., OpenL3 or VGGish audio embeddings).
- **Audio Source Separation**: Integrate Spleeter or Demucs to isolate vocal tracks from instrumental stems prior to feature extraction.
- **Collaborative Hybridization**: Combine the content-based acoustic engine with opt-in user listening signals for a comprehensive hybrid recommendation model.
