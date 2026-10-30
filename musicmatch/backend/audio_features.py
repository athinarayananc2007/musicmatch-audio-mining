"""
MusicMatch Audio Feature Extractor
==================================
Data Mining Pipeline - Step 1 & 2: Collect & Extract Features

This module handles acoustic signal processing using Librosa and FFmpeg:
1. Universal Audio Ingestion:
   - Supports .mp3, .wav, .mpeg (WhatsApp Audio), .m4a, .aac, .opus, .ogg, .webm, .flac, .amr
   - Automatic FFmpeg transcoding fallback if soundfile cannot decode raw container format.
2. 18-Dimensional Feature Vector Extraction:
   - 13 Mel-Frequency Cepstral Coefficients (MFCC means): Captures timbral texture and spectral envelope.
   - 1  Tempo feature (Beats Per Minute): Captures rhythmic pace and periodicity.
   - 1  Spectral Centroid mean: Measures spectral 'brightness' (center of mass of spectrum).
   - 1  Chroma mean: Captures harmonic/pitch class content (mean of 12 chroma bands).
   - 1  Zero Crossing Rate (ZCR) mean: Counts signal sign changes per frame; high for noise, low for tonal.
   - 1  RMS Energy mean: Root-mean-square amplitude; proxy for perceived loudness.
"""

import os
import subprocess
import tempfile
import numpy as np
import librosa

# Feature vector size constant
FEATURE_DIM = 18

# Attempt to locate ffmpeg executable via imageio-ffmpeg for universal format support
try:
    import imageio_ffmpeg
    FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG_PATH = "ffmpeg"


def load_audio_universally(file_path: str, duration: float = 30.0, target_sr: int = 22050) -> tuple[np.ndarray, int]:
    """
    Universally decode any audio format (including MPEG, WhatsApp Audio, Opus, AAC, AMR, MP3, WAV)
    using Librosa with an automatic FFmpeg transcoding fallback.
    """
    # Attempt 1: Standard Librosa/soundfile loader
    try:
        y, sr = librosa.load(file_path, duration=duration, mono=True, sr=target_sr)
        if len(y) > 0:
            return y, sr
    except Exception:
        pass

    # Attempt 2: Universal FFmpeg Transcode to PCM WAV
    # Handles WhatsApp Audio files, MPEG, AAC, OPUS, and container files without standard headers
    tmp_wav_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
            tmp_wav_path = tmp_file.name

        cmd = [
            FFMPEG_PATH,
            "-y",
            "-i", file_path,
            "-t", str(duration),
            "-vn",              # Ignore video if present in mpeg
            "-ac", "1",         # Force mono
            "-ar", str(target_sr), # Standardized sample rate
            "-f", "wav",
            tmp_wav_path
        ]

        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        y, sr = librosa.load(tmp_wav_path, mono=True, sr=target_sr)
        return y, sr
    except Exception as e:
        raise ValueError(f"Failed to decode audio file '{os.path.basename(file_path)}' (Format: MPEG/Audio): {str(e)}")
    finally:
        if tmp_wav_path and os.path.exists(tmp_wav_path):
            try:
                os.remove(tmp_wav_path)
            except Exception:
                pass


def extract_features(file_path: str, duration: float = 30.0) -> list[float]:
    """
    Load the first 30 seconds of an audio file and extract 18 acoustic features.
    
    Parameters:
        file_path (str): Path to the audio file (MPEG, MP3, WAV, WhatsApp Audio, etc.).
        duration (float): Maximum duration in seconds to analyze (default: 30.0).
        
    Returns:
        list[float]: A list of 18 floating-point numbers:
                     [mfcc_0..mfcc_12, tempo, spectral_centroid, chroma_mean, zcr_mean, rms_mean]
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Audio file not found: {file_path}")
        
    # --- DATA MINING STEP 1: UNIVERSAL AUDIO INGESTION ---
    y, sr = load_audio_universally(file_path, duration=duration, target_sr=22050)

    if len(y) == 0:
        raise ValueError(f"Audio file '{os.path.basename(file_path)}' contains no playable audio data.")

    # --- DATA MINING STEP 2: EXTRACT ACOUSTIC FEATURES ---
    
    # 2a. Mel-Frequency Cepstral Coefficients (MFCCs)
    # Extracts 13 cepstral coefficients representing the timbral shape of sound
    mfcc_matrix = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_means = np.mean(mfcc_matrix, axis=1)  # Length: 13
    
    # 2b. Rhythm & Pace: Tempo (BPM)
    # Uses beat tracking autocorrelation to determine rhythmic tempo
    try:
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        tempo_val = float(np.atleast_1d(tempo)[0])
        if np.isnan(tempo_val) or tempo_val <= 0:
            tempo_val = 120.0
    except Exception:
        tempo_val = 120.0
        
    # 2c. Timbral Brightness: Spectral Centroid
    # Computes the center of mass of the frequency spectrum over time frames
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    centroid_mean = float(np.mean(spectral_centroid))
    if np.isnan(centroid_mean):
        centroid_mean = 0.0

    # 2d. [NEW] Harmonic Content: Chroma Mean
    # Chroma captures pitch class (C, C#, D, ...) energy distribution — 12 bins, take mean
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    chroma_mean = float(np.mean(chroma))
    if np.isnan(chroma_mean):
        chroma_mean = 0.0

    # 2e. [NEW] Noisiness / Percussiveness: Zero Crossing Rate (ZCR)
    # High ZCR = noisy/percussive signal; low ZCR = tonal/harmonic signal
    zcr = librosa.feature.zero_crossing_rate(y)
    zcr_mean = float(np.mean(zcr))
    if np.isnan(zcr_mean):
        zcr_mean = 0.0

    # 2f. [NEW] Loudness: RMS Energy
    # Root-mean-square amplitude per frame; proxy for perceived loudness/dynamics
    rms = librosa.feature.rms(y=y)
    rms_mean = float(np.mean(rms))
    if np.isnan(rms_mean):
        rms_mean = 0.0

    # Combine into precisely 18 numerical values:
    # [13 MFCCs] + [tempo] + [centroid] + [chroma] + [zcr] + [rms]
    feature_vector = (
        [float(val) for val in mfcc_means]
        + [float(tempo_val), float(centroid_mean), float(chroma_mean), float(zcr_mean), float(rms_mean)]
    )
    
    if len(feature_vector) != FEATURE_DIM:
        raise ValueError(f"Expected {FEATURE_DIM} features, got {len(feature_vector)}")
        
    return feature_vector
