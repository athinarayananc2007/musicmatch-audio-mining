# MusicMatch 🎵 — 3D Audio Data Mining & Music Recommendation

MusicMatch is a full-stack audio data mining web application featuring an interactive 3D WebGL frontend built with **Three.js** and a scientific Python backend powered by **Flask**, **Librosa**, and **Scikit-learn**.

Unlike traditional recommendation engines that depend on collaborative user filtering or subjective genre tags, MusicMatch operates directly on raw audio waveforms (.mp3 & .wav). It extracts **15 acoustic features** (13 MFCC means, rhythm tempo BPM, and spectral centroid), normalizes the feature space with `StandardScaler`, clusters songs into mood playlists using unsupervised **K-Means**, computes **Cosine Similarity** for recommendations, and maps acoustic relationships onto an interactive **2D PCA Song Map**.

---

## 🏗️ Architecture & Tech Stack

- **Frontend:** Plain HTML5, CSS3, Vanilla JavaScript, and **Three.js** (loaded via CDN). No node build steps or frameworks required.
  - **Dynamic Audio Ingestion Studio:** Supports dragging and dropping user audio files of any format (**MPEG / .mpeg, WhatsApp Audio voice notes, MP3, WAV, M4A, AAC, OPUS, OGG, WebM, FLAC, AMR**) OR recording live audio directly from the user's microphone with real-time waveform bars and a 30s timer.
  - **Spotify API Integration Modal:** In-browser credentials manager to securely enter and verify Spotify Client ID and Client Secret, stored in `localStorage`.
  - **Interactive 3D Musical Scene:** Procedural 3D musical objects (studio headphones, vinyl records, audio speakers, glowing notes, dynamic equalizer bars) with weightless floating and mouse/scroll parallax.
  - **2D PCA Song Map:** Interactive HTML5 `<canvas>` visualizer with cluster-colored nodes, hover tooltips, and click-to-select interaction.
  - **In-Browser Audio Player:** Direct playback preview using `<audio controls>` for uploaded files, microphone recordings, and Spotify previews.
- **Backend:** Python 3 with **Flask**, **flask-cors**, **librosa**, **scikit-learn**, **imageio-ffmpeg**, **requests**, and **soundfile**.
  - **Universal Audio Decoder:** Decodes standard audio and automatically falls back to an embedded FFmpeg transcode pipeline for stubborn container formats like WhatsApp voice messages, MPEG (.mpeg/.mpg/.mp2), OPUS, and AAC streams.
  - `GET  /api/health`: Health status monitor and list of supported extensions.
  - `POST /api/analyze`: Dynamically ingests user audio files or microphone recordings, extracts 15 acoustic features (13 MFCCs, Tempo, Spectral Centroid), scales features, and calculates K-Means clusters and 2D PCA coordinates.
  - `POST /api/spotify/recommend`: Recommends worldwide Spotify tracks matching the extracted tempo, energy, and timbre profile.
  - `POST /api/spotify/verify`: Authenticates Spotify Client ID & Secret using the Client Credentials flow.
  - `POST /api/recommend`: Intra-catalog Cosine Similarity recommendation across user's uploaded songs.
  - `POST /api/contact`: Validates user messages and appends entries to `messages.json`.

---

## 📁 Project Structure

```text
musicmatch/
├── frontend/
│   ├── index.html            # Landing / Hero page with full 3D interactive scene
│   ├── features.html         # 6 core feature capabilities & comparison breakdown
│   ├── how-it-works.html     # Animated 4-step data mining pipeline timeline
│   ├── demo.html             # Live audio mining studio connected to backend API
│   ├── about.html            # Project story, tech stack badges, and team profiles
│   ├── contact.html          # Contact form posting to /api/contact
│   ├── samples/              # Synthesized sample audio tracks for 1-click testing
│   ├── css/
│   │   └── style.css         # Modern dark neon theme & responsive glassmorphism
│   └── js/
│       ├── main.js           # Sticky navbar, scroll reveals, and contact validation
│       ├── scene.js          # Three.js 3D floating scene with mouse & scroll parallax
│       └── demo.js           # API integration, file uploader, and PCA canvas scatter plot
├── backend/
│   ├── app.py                # Flask REST API server (CORS enabled on port 5000)
│   ├── audio_features.py     # Librosa feature extraction (13 MFCCs, Tempo, Centroid)
│   ├── recommender.py        # StandardScaler, K-Means, PCA, & Cosine Similarity
│   ├── generate_samples.py   # Multi-frequency audio synthesizer script
│   ├── test_pipeline.py      # End-to-end verification test suite
│   ├── uploads/              # Sandboxed temporary audio processing directory
│   ├── messages.json         # Contact inquiries store
│   └── requirements.txt      # Python dependencies
├── sample_tracks/            # Synthesized .wav sample files
└── README.md                 # Setup, usage, and algorithmic documentation
```

---

## 🚀 Quick Start Guide

### Step 1: Set Up & Start the Backend

1. Open your terminal and navigate to the backend directory:
   ```bash
   cd musicmatch/backend
   ```

2. (Recommended) Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell):
   python -m venv .venv
   .venv\Scripts\activate

   # macOS / Linux:
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the Flask server:
   ```bash
   python app.py
   ```
   The backend will run on `http://localhost:5000` with CORS enabled.

5. Test the server health endpoint in your browser or terminal:
   ```bash
   curl http://localhost:5000/api/health
   # Returns: {"status": "ok"}
   ```

---

### Step 2: Open the Frontend

You can open `frontend/index.html` directly in any modern browser, or serve it with Python's lightweight static server:

```bash
# From the project root or frontend directory:
cd musicmatch/frontend
python -m http.server 8000
```

Now open:
👉 **`http://localhost:8000`** (or open `frontend/index.html` directly).

---

## 🎧 How to Test the Live Dynamic User Workflow
 
 1. Navigate to the **Demo** page (`demo.html`) in your browser.
 2. Verify that **Backend Online (Port 5000)** is shown with a green dot.
 3. **Input Your Own Audio (100% Dynamic):**
    - **Option A (Microphone):** Click the **"Record from Mic"** tab. Click the glowing microphone button to capture up to 30 seconds of live singing, acoustic instruments, or background music. Click stop when done; your recording is automatically added to the queue with an instant playback preview!
    - **Option B (File Upload):** Drag and drop your own `.mp3`, `.wav`, `.m4a`, or `.ogg` audio files from your device.
 4. **Connect Spotify API (Optional but Recommended):**
    - Click the **"Spotify API"** badge in the navbar.
    - Enter your **Client ID** and **Client Secret** from [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
    - Click **"Test & Save Credentials"**. The system validates your credentials and stores them securely in your browser's `localStorage`.
 5. Click **"Analyze Audio"**:
    - The Librosa pipeline extracts 15 acoustic features (13 MFCCs, Tempo BPM, and Spectral Centroid) directly from your audio.
 6. **Spotify Global Music Recommendations:**
    - In the Spotify Recommendations studio, choose any seed genre (Pop, Electronic, Rock, Indie, Hip-Hop, Ambient, etc.).
    - Click **"Find on Spotify"**.
    - MusicMatch queries the Spotify Web API using your extracted audio tempo and energy to return matching worldwide tracks complete with high-resolution album artwork, artist names, match percentages, and direct "Listen on Spotify" links!
 7. **2D PCA Song Map & Intra-Catalog Clustering (for multiple tracks):**
    - Explore your tracks mapped on the interactive 2D canvas, colored by K-Means clusters with hover tooltips and cosine similarity scores.

---

## 🔬 Mathematical Data Mining Details

1. **Feature Extraction (`audio_features.py`):**
   - **13 MFCCs:** Discrete Cosine Transform (DCT) applied to log-power Mel spectrograms, capturing timbral character.
   - **Tempo (BPM):** Autocorrelation of onset strength envelopes detecting periodic beat intervals.
   - **Spectral Centroid:** Frequency-weighted center of gravity: $\mu = \frac{\sum f \cdot S(f)}{\sum S(f)}$, measuring sonic sharpness.

2. **Feature Scaling (`recommender.py`):**
   - `StandardScaler` standardizes each feature column: $z = \frac{x - \mu}{\sigma}$. Prevents features with high numerical magnitude (e.g. Spectral Centroid in thousands of Hz) from dominating features with smaller scales (e.g. MFCC coefficients).

3. **Unsupervised K-Means (`recommender.py`):**
   - Partitions $N$ audio feature vectors into $K$ disjoint clusters by minimizing within-cluster sum-of-squares (inertia):
     $$\arg\min_S \sum_{i=1}^{k} \sum_{x \in S_i} \|x - \mu_i\|^2$$

4. **Dimensionality Reduction (PCA):**
   - Transforms the 15-dimensional scaled space onto the top 2 eigenvectors with highest eigenvalue variance, enabling intuitive 2D spatial visualization.

5. **Cosine Similarity Recommendation:**
   - Measures the angle between normalized song vectors:
     $$\text{CosineSim}(u, v) = \frac{u \cdot v}{\|u\|_2 \|v\|_2}$$
   - Values range from -1.0 to 1.0, converted to intuitive match percentages ($0\% - 100\%$).

---

## 🛡️ Security & Privacy Features

- Uploaded audio files are stored in a sandboxed `uploads/` directory, processed in memory, and immediately deleted upon completion.
- Maximum payload limit strictly enforced at **50 MB** (`MAX_CONTENT_LENGTH`).
- Robust error handling skips unreadable files gracefully with diagnostic JSON responses instead of crashing the server.
