"""
Generate 5 diverse, high-quality synthesized .wav sample tracks for testing
and demonstrating the MusicMatch audio data mining recommendation system.
"""

import os
import numpy as np
import soundfile as sf

def generate_samples():
    output_dir = os.path.join(os.path.dirname(__file__), "..", "sample_tracks")
    frontend_samples_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "samples")
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(frontend_samples_dir, exist_ok=True)

    sr = 22050
    rng = np.random.default_rng(42)
    duration = 6.0  # 6 seconds is fast to load and analyze, rich in features
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)

    tracks = {}

    # 1. Electronic Pulse (128 BPM - 4 beats per sec = 2.133 beats/sec, kick every 0.46875 s)
    beat_interval = 60.0 / 128.0
    y_elec = np.zeros_like(t)
    for i in range(int(duration / beat_interval)):
        t_kick = t - i * beat_interval
        mask = (t_kick >= 0) & (t_kick < 0.25)
        # exponential pitch decay kick drum (150Hz -> 45Hz)
        pitch = 45 + 105 * np.exp(-t_kick[mask] * 25)
        y_elec[mask] += 0.7 * np.sin(2 * np.pi * pitch * t_kick[mask]) * np.exp(-t_kick[mask] * 12)
        # hi-hat burst
        t_hat = t - (i + 0.5) * beat_interval
        mask_hat = (t_hat >= 0) & (t_hat < 0.05)
        noise = rng.uniform(-1, 1, np.sum(mask_hat))
        y_elec[mask_hat] += 0.25 * noise * np.exp(-t_hat[mask_hat] * 70)
    # Bass synth
    y_elec += 0.2 * np.sin(2 * np.pi * 110 * t) + 0.15 * np.sin(2 * np.pi * 220 * t)
    tracks["electronic_pulse_128bpm.wav"] = y_elec

    # 2. Ambient Chill (80 BPM, warm low spectral centroid, slow pads)
    y_amb = np.zeros_like(t)
    freqs = [130.81, 164.81, 196.00, 246.94]  # C3 major7 chord
    for f in freqs:
        lfo = 1.0 + 0.15 * np.sin(2 * np.pi * 0.4 * t)
        y_amb += 0.2 * np.sin(2 * np.pi * f * t * lfo)
    # Slow gentle swells
    envelope = 0.5 * (1 + np.sin(2 * np.pi * 0.2 * t))
    y_amb = y_amb * envelope
    tracks["ambient_chill_80bpm.wav"] = y_amb

    # 3. Acoustic Groove (110 BPM, plucked harmonics)
    y_acoust = np.zeros_like(t)
    beat_interval = 60.0 / 110.0
    notes = [196.0, 220.0, 261.63, 329.63, 392.0]  # G3, A3, C4, E4, G4
    for i in range(int(duration / (beat_interval / 2))):
        t_pluck = t - i * (beat_interval / 2)
        mask = (t_pluck >= 0) & (t_pluck < 0.6)
        freq = notes[i % len(notes)]
        # damped pluck with harmonics
        decay = np.exp(-t_pluck[mask] * 6)
        y_acoust[mask] += 0.35 * (
            np.sin(2 * np.pi * freq * t_pluck[mask]) +
            0.5 * np.sin(2 * np.pi * 2 * freq * t_pluck[mask]) +
            0.2 * np.sin(2 * np.pi * 3 * freq * t_pluck[mask])
        ) * decay
    tracks["acoustic_groove_110bpm.wav"] = y_acoust

    # 4. Techno Drive (138 BPM, aggressive saw waves, high centroid, driving kick)
    y_techno = np.zeros_like(t)
    beat_interval = 60.0 / 138.0
    for i in range(int(duration / beat_interval)):
        t_kick = t - i * beat_interval
        mask = (t_kick >= 0) & (t_kick < 0.3)
        pitch = 50 + 130 * np.exp(-t_kick[mask] * 35)
        y_techno[mask] += 0.8 * np.sin(2 * np.pi * pitch * t_kick[mask]) * np.exp(-t_kick[mask] * 15)
    # Bright sawtooth bassline
    saw = 2 * (t * 140 - np.floor(0.5 + t * 140))
    saw_bright = 2 * (t * 280 - np.floor(0.5 + t * 280))
    y_techno += 0.2 * saw + 0.15 * saw_bright
    tracks["techno_drive_138bpm.wav"] = y_techno

    # 5. Lo-Fi Beats (86 BPM, jazzy Rhodes chords, relaxed swing)
    y_lofi = np.zeros_like(t)
    beat_interval = 60.0 / 86.0
    for i in range(int(duration / beat_interval)):
        t_snare = t - (i + 0.5) * beat_interval
        mask_snare = (t_snare >= 0) & (t_snare < 0.12)
        noise = rng.uniform(-0.5, 0.5, np.sum(mask_snare))
        y_lofi[mask_snare] += 0.3 * noise * np.exp(-t_snare[mask_snare] * 30)
    # Warm chords (Dm9)
    d_m9 = [146.83, 174.61, 220.00, 261.63, 329.63]
    for f in d_m9:
        vibrato = 1.0 + 0.008 * np.sin(2 * np.pi * 4.5 * t)
        y_lofi += 0.12 * np.sin(2 * np.pi * f * t * vibrato) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.5 * t))
    tracks["lofi_vibes_86bpm.wav"] = y_lofi

    # Normalize & save to both directories
    for filename, wave in tracks.items():
        # normalize to peak 0.95
        max_val = np.max(np.abs(wave))
        if max_val > 0:
            wave = (wave / max_val) * 0.92
        wave = wave.astype(np.float32)

        path1 = os.path.join(output_dir, filename)
        path2 = os.path.join(frontend_samples_dir, filename)
        sf.write(path1, wave, sr)
        sf.write(path2, wave, sr)
        print(f"Generated sample track: {path1}")

if __name__ == "__main__":
    generate_samples()
