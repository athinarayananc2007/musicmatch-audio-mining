/**
 * MusicMatch - Dynamic Live Sound Analysis & Spotify Studio Controller
 * ===================================================================
 * 100% User-Driven Architecture:
 * - Dynamic Audio Ingestion: File upload (.mp3, .wav, .m4a, .ogg) or live Microphone recording
 * - Web Audio & MediaRecorder API for in-browser live recording studio
 * - Real-time acoustic analysis & harmonic playlist grouping
 * - Interactive Visual Sound Map on Canvas
 * - Real-time Spotify Web API Integration with Client Credentials OAuth flow
 * - Sound parameter mapping to Spotify tracks (BPM tempo, energy, and timbre)
 */

(function () {
  'use strict';

  const API_BASE = (typeof window.API_BASE !== 'undefined') ? window.API_BASE : 'http://localhost:5000';

  // Cluster Color Palette for visual clustering
  const CLUSTER_COLORS = [
    { fill: '#9d4edd', stroke: '#c77dff', glow: 'rgba(157, 78, 221, 0.45)', name: 'Purple Neon' },
    { fill: '#3a86ff', stroke: '#70a1ff', glow: 'rgba(58, 134, 255, 0.45)', name: 'Cyan Blue' },
    { fill: '#ff007f', stroke: '#ff4d94', glow: 'rgba(255, 0, 127, 0.45)', name: 'Hot Pink' },
    { fill: '#00f0ff', stroke: '#80f8ff', glow: 'rgba(0, 240, 255, 0.45)', name: 'Electric Cyan' },
    { fill: '#10b981', stroke: '#6ee7b7', glow: 'rgba(16, 185, 129, 0.45)', name: 'Emerald Wave' },
    { fill: '#f59e0b', stroke: '#fbbf24', glow: 'rgba(245, 158, 11, 0.45)', name: 'Amber Sunset' }
  ];

  // State Management
  const state = {
    files: [], // Array of File objects (uploaded or recorded)
    fileAudioUrls: {}, // filename -> object URL
    analyzedData: null, // response from /api/analyze
    selectedSongForRec: null,
    backendOnline: false,
    
    // Microphone Recording State
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    recordTimerInterval: null,
    recordSeconds: 0,
    recordingCount: 0,

    // Spotify API Credentials (stored in localStorage)
    spotifyClientId: localStorage.getItem('mm_spotify_client_id') || '',
    spotifyClientSecret: localStorage.getItem('mm_spotify_client_secret') || '',
    spotifyConnected: false
  };

  // DOM Elements
  let statusPill, statusDot, statusText;
  let tabUploadBtn, tabMicBtn, uploadPanel, micPanel;
  let dropzone, fileInput, fileListEl, queueCountEl, clearAllBtn;
  let recordToggleBtn, recordTimerEl, micStudioBox, micWavesEl, micStatusLabel;
  let clusterSlider, clusterValEl, clusterSliderContainer;
  let analyzeBtn, analyzeSpinner, statusAlertEl;
  let resultsSection, songsTableBody, clustersCountEl, songsCountEl;
  let pcaCanvas, pcaCtx, chartTooltip;
  let recSongSelect, recCountSlider, recCountValEl, recBtn, recCardsContainer, catalogSimBox;
  let spotifySettingsBtn, mobileSpotifyBtn, spotifyModal, closeSpotifyModalBtn;
  let spotifyKeysForm, spotifyClientIdInput, spotifyClientSecretInput, spotifyModalFeedback, spotifyClearBtn, spotifyBadgeText, spotifyActiveIndicator;
  let spotifySeedSongSelect, spotifyGenreSelect, spotifyRecommendBtn, spotifySpinner, spotifyCardsContainer;

  document.addEventListener('DOMContentLoaded', () => {
    initElements();
    checkBackendHealth();
    initSpotifyState();
    bindEvents();
    initCanvas();
  });

  function initElements() {
    statusPill = document.getElementById('backend-status-pill');
    statusDot = document.getElementById('status-dot');
    statusText = document.getElementById('status-text');

    tabUploadBtn = document.getElementById('tab-upload-btn');
    tabMicBtn = document.getElementById('tab-mic-btn');
    uploadPanel = document.getElementById('upload-panel');
    micPanel = document.getElementById('mic-panel');

    dropzone = document.getElementById('upload-dropzone');
    fileInput = document.getElementById('audio-file-input');
    fileListEl = document.getElementById('file-list');
    queueCountEl = document.getElementById('queue-count');
    clearAllBtn = document.getElementById('clear-all-btn');

    recordToggleBtn = document.getElementById('record-toggle-btn');
    recordTimerEl = document.getElementById('record-timer');
    micStudioBox = document.getElementById('mic-studio-box');
    micWavesEl = document.getElementById('mic-waves');
    micStatusLabel = document.getElementById('mic-status-label');

    clusterSlider = document.getElementById('clusters-slider');
    clusterValEl = document.getElementById('clusters-val');
    clusterSliderContainer = document.getElementById('cluster-slider-container');

    analyzeBtn = document.getElementById('analyze-btn');
    analyzeSpinner = document.getElementById('analyze-spinner');
    statusAlertEl = document.getElementById('status-alert');

    resultsSection = document.getElementById('results-section');
    songsTableBody = document.getElementById('songs-table-body');
    clustersCountEl = document.getElementById('clusters-count-badge');
    songsCountEl = document.getElementById('songs-count-badge');

    pcaCanvas = document.getElementById('pca-canvas');
    if (pcaCanvas) pcaCtx = pcaCanvas.getContext('2d');
    chartTooltip = document.getElementById('chart-tooltip');

    recSongSelect = document.getElementById('rec-song-select');
    recCountSlider = document.getElementById('rec-count-slider');
    recCountValEl = document.getElementById('rec-count-val');
    recBtn = document.getElementById('recommend-btn');
    recCardsContainer = document.getElementById('rec-cards-container');
    catalogSimBox = document.getElementById('catalog-similarity-box');

    // Spotify Integration Elements
    spotifySettingsBtn = document.getElementById('spotify-settings-btn');
    mobileSpotifyBtn = document.getElementById('mobile-spotify-btn');
    spotifyModal = document.getElementById('spotify-modal');
    closeSpotifyModalBtn = document.getElementById('close-spotify-modal');
    spotifyKeysForm = document.getElementById('spotify-keys-form');
    spotifyClientIdInput = document.getElementById('spotify-client-id');
    spotifyClientSecretInput = document.getElementById('spotify-client-secret');
    spotifyModalFeedback = document.getElementById('spotify-modal-feedback');
    spotifyClearBtn = document.getElementById('spotify-clear-btn');
    spotifyBadgeText = document.getElementById('spotify-badge-text');
    spotifyActiveIndicator = document.getElementById('spotify-active-indicator');

    spotifySeedSongSelect = document.getElementById('spotify-seed-song');
    spotifyGenreSelect = document.getElementById('spotify-genre-select');
    spotifyRecommendBtn = document.getElementById('spotify-recommend-btn');
    spotifySpinner = document.getElementById('spotify-spinner');
    spotifyCardsContainer = document.getElementById('spotify-cards-container');
  }

  /* -----------------------------------------------------------------
     1. Backend Health & Spotify Verification
     ----------------------------------------------------------------- */
  async function checkBackendHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`, { method: 'GET' });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        state.backendOnline = true;
        updateStatus(true, 'Audio Studio Online');
      } else {
        throw new Error('Invalid status');
      }
    } catch (err) {
      state.backendOnline = false;
      updateStatus(false, 'Audio Studio Offline');
    }
  }

  function updateStatus(isOnline, text) {
    if (!statusDot || !statusText) return;
    if (isOnline) {
      statusDot.className = 'status-dot online';
      statusText.textContent = text;
      if (statusPill) statusPill.title = 'Sound analysis engine is connected and ready';
    } else {
      statusDot.className = 'status-dot offline';
      statusText.textContent = text;
      if (statusPill) statusPill.title = 'Sound analysis engine is currently offline';
    }
  }

  function initSpotifyState() {
    if (state.spotifyClientId && state.spotifyClientSecret) {
      if (spotifyClientIdInput) spotifyClientIdInput.value = state.spotifyClientId;
      if (spotifyClientSecretInput) spotifyClientSecretInput.value = state.spotifyClientSecret;
      if (spotifyBadgeText) spotifyBadgeText.textContent = 'Spotify Connected 🟢';
      if (spotifyActiveIndicator) spotifyActiveIndicator.textContent = 'Live Spotify Connected 🟢';
      if (spotifyClearBtn) spotifyClearBtn.style.display = 'inline-block';
      state.spotifyConnected = true;
    } else {
      if (spotifyBadgeText) spotifyBadgeText.textContent = 'Connect Spotify ⚙️';
      if (spotifyActiveIndicator) spotifyActiveIndicator.textContent = 'Acoustic Matching Mode';
    }
  }

  /* -----------------------------------------------------------------
     2. Event Binding
     ----------------------------------------------------------------- */
  function bindEvents() {
    // Mode Tabs
    tabUploadBtn?.addEventListener('click', () => switchInputTab('upload'));
    tabMicBtn?.addEventListener('click', () => switchInputTab('mic'));

    // Dropzone Click
    dropzone?.addEventListener('click', () => fileInput?.click());

    // File Input change
    fileInput?.addEventListener('change', (e) => {
      handleFilesSelected(Array.from(e.target.files));
      fileInput.value = '';
    });

    // Drag & Drop
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone?.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone?.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone?.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer.files);
      handleFilesSelected(files);
    });

    // Microphone Recording
    recordToggleBtn?.addEventListener('click', toggleRecording);

    // Load Demo Tracks Button
    const loadSamplesBtn = document.getElementById('load-samples-btn');
    loadSamplesBtn?.addEventListener('click', async () => {
      loadSamplesBtn.disabled = true;
      loadSamplesBtn.textContent = 'Loading...';
      const sampleNames = [
        'acoustic_groove_110bpm.wav',
        'ambient_chill_80bpm.wav',
        'electronic_pulse_128bpm.wav',
        'lofi_vibes_86bpm.wav',
        'techno_drive_138bpm.wav'
      ];
      try {
        const loadedFiles = [];
        for (const name of sampleNames) {
          const res = await fetch(`samples/${name}`);
          const blob = await res.blob();
          loadedFiles.push(new File([blob], name, { type: 'audio/wav' }));
        }
        handleFilesSelected(loadedFiles);
        showAlert('success', 'Loaded 5 sample tracks! Click "Analyze Audio" below to discover your sound profile and mood playlists.');
      } catch (err) {
        showAlert('error', 'Could not load demo samples.');
      } finally {
        loadSamplesBtn.disabled = false;
        loadSamplesBtn.innerHTML = '<span>⚡ Load Sample Tracks</span>';
      }
    });

    // Clear All Files
    clearAllBtn?.addEventListener('click', clearAllAudio);

    // Cluster slider change
    clusterSlider?.addEventListener('input', (e) => {
      if (clusterValEl) clusterValEl.textContent = e.target.value;
    });

    // Recommendation count slider
    recCountSlider?.addEventListener('input', (e) => {
      if (recCountValEl) recCountValEl.textContent = e.target.value;
    });

    // Analyze Button
    analyzeBtn?.addEventListener('click', executeAnalyze);

    // Intra-catalog Recommend Button
    recBtn?.addEventListener('click', executeRecommend);

    // Spotify Recommend Button
    spotifyRecommendBtn?.addEventListener('click', executeSpotifyRecommend);

    // Target Song Selection dropdown change
    recSongSelect?.addEventListener('change', (e) => {
      state.selectedSongForRec = e.target.value;
      if (spotifySeedSongSelect) spotifySeedSongSelect.value = e.target.value;
      drawPcaChart();
    });

    spotifySeedSongSelect?.addEventListener('change', (e) => {
      state.selectedSongForRec = e.target.value;
      if (recSongSelect) recSongSelect.value = e.target.value;
      drawPcaChart();
    });

    // Spotify Modal
    spotifySettingsBtn?.addEventListener('click', openSpotifyModal);
    mobileSpotifyBtn?.addEventListener('click', openSpotifyModal);
    closeSpotifyModalBtn?.addEventListener('click', closeSpotifyModal);

    spotifyModal?.addEventListener('click', (e) => {
      if (e.target === spotifyModal) closeSpotifyModal();
    });

    spotifyKeysForm?.addEventListener('submit', handleSaveSpotifyKeys);
    spotifyClearBtn?.addEventListener('click', handleDisconnectSpotify);

    // Window Resize -> redraw canvas
    window.addEventListener('resize', () => {
      resizeCanvas();
      drawPcaChart();
    });
  }

  function switchInputTab(tab) {
    if (tab === 'upload') {
      uploadPanel.style.display = 'block';
      micPanel.style.display = 'none';
      tabUploadBtn.style.background = 'rgba(157, 78, 221, 0.2)';
      tabUploadBtn.style.borderColor = 'var(--accent-purple)';
      tabMicBtn.style.background = 'rgba(255, 255, 255, 0.06)';
      tabMicBtn.style.borderColor = 'var(--border-subtle)';
    } else {
      uploadPanel.style.display = 'none';
      micPanel.style.display = 'block';
      tabMicBtn.style.background = 'rgba(58, 134, 255, 0.2)';
      tabMicBtn.style.borderColor = 'var(--accent-blue)';
      tabUploadBtn.style.background = 'rgba(255, 255, 255, 0.06)';
      tabUploadBtn.style.borderColor = 'var(--border-subtle)';
    }
  }

  /* -----------------------------------------------------------------
     3. Live Microphone Audio Recording Studio (Web Audio API)
     ----------------------------------------------------------------- */
  async function toggleRecording() {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showAlert('error', 'Microphone access is not supported by your browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.audioChunks = [];
      
      // Determine optimal audio mimeType supported by browser
      const mimeTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/wav'];
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';

      state.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      state.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          state.audioChunks.push(e.data);
        }
      };

      state.mediaRecorder.onstop = () => {
        // Stop all audio tracks in stream
        stream.getTracks().forEach(track => track.stop());
        finalizeRecording();
      };

      state.mediaRecorder.start(250);
      state.isRecording = true;
      state.recordSeconds = 0;

      // Update UI for recording state
      micStudioBox.classList.add('recording');
      recordToggleBtn.classList.add('active');
      recordToggleBtn.title = 'Click to stop recording and process audio';
      micStatusLabel.textContent = '🔴 Recording Live Audio... (Max 30s)';
      micStatusLabel.style.color = 'var(--accent-rose)';

      // Animate wave bars
      micWavesEl.querySelectorAll('.mic-wave-bar').forEach((bar, idx) => {
        bar.classList.add('animated');
        bar.style.animationDelay = `${idx * 0.12}s`;
      });

      // Timer counter (Max 30 seconds)
      state.recordTimerInterval = setInterval(() => {
        state.recordSeconds++;
        const secs = state.recordSeconds;
        const formatted = `00:${secs < 10 ? '0' : ''}${secs} / 00:30`;
        recordTimerEl.textContent = formatted;

        if (secs >= 30) {
          stopRecording();
        }
      }, 1000);

    } catch (err) {
      console.error('Microphone access denied:', err);
      showAlert('error', 'Microphone permission denied or no audio input device found.');
    }
  }

  function stopRecording() {
    if (!state.isRecording) return;
    state.isRecording = false;

    clearInterval(state.recordTimerInterval);
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      state.mediaRecorder.stop();
    }

    // Reset UI
    micStudioBox.classList.remove('recording');
    recordToggleBtn.classList.remove('active');
    recordToggleBtn.title = 'Click to record another audio snippet';
    micStatusLabel.textContent = 'Processing Recording...';
    micStatusLabel.style.color = 'var(--accent-cyan)';

    micWavesEl.querySelectorAll('.mic-wave-bar').forEach(bar => {
      bar.classList.remove('animated');
    });
  }

  function finalizeRecording() {
    if (state.audioChunks.length === 0) return;

    state.recordingCount++;
    const mimeType = state.mediaRecorder?.mimeType || 'audio/wav';
    const ext = mimeType.includes('webm') ? '.webm' : (mimeType.includes('ogg') ? '.ogg' : '.wav');
    const filename = `live_recording_${state.recordingCount}${ext}`;

    const blob = new Blob(state.audioChunks, { type: mimeType });
    const recordedFile = new File([blob], filename, { type: mimeType, lastModified: Date.now() });

    state.files.push(recordedFile);
    state.fileAudioUrls[filename] = URL.createObjectURL(blob);

    micStatusLabel.textContent = `Recorded: ${filename} (${state.recordSeconds}s)`;
    recordTimerEl.textContent = '00:00 / 00:30';

    renderFileList();
    updateAnalyzeBtnState();
    showToast(`Microphone audio recorded successfully as "${filename}"! Ready to analyze.`, 'success');
  }

  /* -----------------------------------------------------------------
     4. File Handling & Dynamic Queue
     ----------------------------------------------------------------- */
  function handleFilesSelected(newFiles) {
    const validExts = [
      '.mpeg', '.mpg', '.mp2', '.mpga', '.mp3', '.wav', '.m4a',
      '.aac', '.opus', '.ogg', '.webm', '.flac', '.amr', '.wma', '.oga'
    ];
    let addedCount = 0;

    newFiles.forEach((f) => {
      const lowerName = f.name.toLowerCase();
      const dotIndex = lowerName.lastIndexOf('.');
      const ext = dotIndex !== -1 ? lowerName.substring(dotIndex) : '';

      const isRecognizedExt = ext && validExts.includes(ext);
      const isAudioMime = f.type.startsWith('audio/') || f.type === 'video/mpeg' || f.type === 'video/mp4' || f.type === 'video/webm';
      const isWhatsAppAudio = lowerName.includes('whatsapp audio') || lowerName.includes('ptt-');

      if (isRecognizedExt || isAudioMime || isWhatsAppAudio) {
        if (f.size > 4.5 * 1024 * 1024) {
          showAlert('error', `"${f.name}" is ${(f.size / (1024 * 1024)).toFixed(2)} MB. Cloud serverless functions have a 4.5 MB upload limit. Please use audio files under 4.5 MB or click "⚡ Load Sample Tracks".`);
          return;
        }
        if (!state.files.some((existing) => existing.name === f.name)) {
          state.files.push(f);
          state.fileAudioUrls[f.name] = URL.createObjectURL(f);
          addedCount++;
        }
      }
    });

    if (addedCount === 0 && newFiles.length > 0 && !document.querySelector('.alert-error')) {
      showAlert('error', 'Please upload valid audio files: MPEG (.mpeg, .mpg), WhatsApp Audio, MP3, WAV, M4A, AAC, or OPUS.');
    }

    renderFileList();
    updateAnalyzeBtnState();
  }

  function renderFileList() {
    if (!fileListEl) return;
    fileListEl.innerHTML = '';

    if (queueCountEl) queueCountEl.textContent = state.files.length;
    if (clearAllBtn) clearAllBtn.style.display = state.files.length > 0 ? 'inline-block' : 'none';

    if (state.files.length === 0) {
      fileListEl.innerHTML = '<p style="font-size:0.875rem; color:var(--text-dim); text-align:center; padding:12px;">No audio tracks added yet. Upload audio files (including WhatsApp Voice notes &amp; MPEG files) or record using your microphone.</p>';
      return;
    }

    state.files.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-item';

      const sizeKb = (file.size / 1024).toFixed(1);
      const sizeStr = file.size > 1048576 ? `${(file.size / 1048576).toFixed(2)} MB` : `${sizeKb} KB`;
      const isMic = file.name.startsWith('live_recording_');

      let badgeLabel = 'AUDIO';
      let badgeStyle = '';
      if (isMic) {
        badgeLabel = 'MIC REC';
        badgeStyle = 'background:rgba(244,63,94,0.15); color:#fda4af;';
      } else if (file.name.toLowerCase().includes('whatsapp audio')) {
        badgeLabel = 'WHATSAPP';
        badgeStyle = 'background:rgba(37,211,102,0.15); color:#25D366;';
      } else if (file.name.includes('.')) {
        badgeLabel = file.name.split('.').pop().toUpperCase();
        if (badgeLabel === 'MPEG' || badgeLabel === 'MPG') {
          badgeStyle = 'background:rgba(59,130,246,0.15); color:#60a5fa;';
        }
      }

      const audioSrc = state.fileAudioUrls[file.name] || '';

      item.innerHTML = `
        <div style="flex: 1; overflow: hidden;">
          <div class="file-info" style="margin-bottom: 6px;">
            <span class="file-badge" style="${badgeStyle}">
              ${badgeLabel}
            </span>
            <span title="${escapeHtml(file.name)}" style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; font-weight:600;">
              ${escapeHtml(file.name)}
            </span>
            <span style="color:var(--text-dim); font-size:0.8rem;">(${sizeStr})</span>
          </div>

          ${
            audioSrc
              ? `<audio controls preload="none" src="${audioSrc}" style="height: 30px;"></audio>`
              : ''
          }
        </div>

        <button type="button" class="file-remove-btn" title="Remove track" data-index="${index}" style="margin-left: 14px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

      item.querySelector('.file-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(index);
      });

      fileListEl.appendChild(item);
    });
  }

  function removeFile(index) {
    const removed = state.files.splice(index, 1)[0];
    if (removed && state.fileAudioUrls[removed.name]) {
      URL.revokeObjectURL(state.fileAudioUrls[removed.name]);
      delete state.fileAudioUrls[removed.name];
    }
    renderFileList();
    updateAnalyzeBtnState();
  }

  function clearAllAudio() {
    state.files.forEach(f => {
      if (state.fileAudioUrls[f.name]) URL.revokeObjectURL(state.fileAudioUrls[f.name]);
    });
    state.files = [];
    state.fileAudioUrls = {};
    renderFileList();
    updateAnalyzeBtnState();
  }

  function updateAnalyzeBtnState() {
    if (state.files.length >= 1) {
      analyzeBtn.disabled = false;
      analyzeBtn.classList.remove('btn-secondary');
      analyzeBtn.classList.add('btn-primary');
    }
  }

  /* -----------------------------------------------------------------
     5. Audio Analysis Action (POST /api/analyze)
     ----------------------------------------------------------------- */
  async function executeAnalyze() {
    if (state.files.length === 0) {
      showAlert('error', 'Please upload at least one audio file or record from your microphone.');
      return;
    }

    const totalBytes = state.files.reduce((acc, f) => acc + (f.size || 0), 0);
    if (totalBytes > 4.5 * 1024 * 1024) {
      showAlert('error', `Total audio size is ${(totalBytes / (1024 * 1024)).toFixed(2)} MB. Cloud serverless functions have a 4.5 MB request limit. Please remove large files or click "⚡ Load Demo Tracks".`);
      return;
    }

    clearAlert();
    analyzeBtn.disabled = true;
    analyzeSpinner.style.display = 'inline-block';
    analyzeBtn.querySelector('.btn-text').textContent = 'Analyzing Sound, Tempo & Tone...';

    const formData = new FormData();
    state.files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('clusters', clusterSlider ? clusterSlider.value : 3);

    try {
      const headers = {};
      if (window.MusicMatchAuth && window.MusicMatchAuth.token) {
        headers['Authorization'] = `Bearer ${window.MusicMatchAuth.token}`;
      }

      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error(response.status ? `Server responded with ${response.status} ${response.statusText}` : 'Could not parse server response');
      }

      if (!response.ok || data.status === 'error') {
        const errMsg = data.error || (data.skipped && data.skipped.length ? data.skipped[0].reason : 'Failed to analyze user audio.');
        showAlert('error', errMsg);
        return;
      }

      state.analyzedData = data;
      renderAnalysisResults(data);

      showAlert('success', `Sound analysis complete for ${data.total_analyzed} track(s)! Tempo, rhythm, and sonic textures successfully mapped.`);
      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Automatically trigger initial Spotify recommendations for the primary track!
      if (data.songs && data.songs.length > 0) {
        executeSpotifyRecommend();
      }

    } catch (err) {
      const targetUrl = API_BASE || window.location.origin;
      showAlert('error', `Audio analysis error: ${err.message || 'Server timeout or decoding issue'}. (Backend: ${targetUrl})`);
    } finally {
      analyzeBtn.disabled = false;
      analyzeSpinner.style.display = 'none';
      analyzeBtn.querySelector('.btn-text').textContent = 'Analyze Audio';
    }
  }

  /* -----------------------------------------------------------------
     6. Render Analysis Results (Table + 2D Scatter Plot)
     ----------------------------------------------------------------- */
  function renderAnalysisResults(data) {
    if (!resultsSection) return;
    resultsSection.style.display = 'block';

    const songs = data.songs || [];
    if (clustersCountEl) clustersCountEl.textContent = `${data.clusters_count} Playlist Group(s)`;
    if (songsCountEl) songsCountEl.textContent = `${songs.length} Track(s)`;

    // Populate Results Table
    if (songsTableBody) {
      songsTableBody.innerHTML = '';
      songs.forEach((song) => {
        const tr = document.createElement('tr');
        const color = getClusterColor(song.cluster);

        tr.innerHTML = `
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="cluster-dot" style="background:${color.fill}; box-shadow:0 0 8px ${color.fill}"></span>
              <strong style="color:#fff;">${escapeHtml(song.name)}</strong>
            </div>
          </td>
          <td>
            <span class="cluster-pill" style="background:${color.glow}; color:${color.stroke}; border:1px solid ${color.stroke};">
              Group #${song.cluster + 1}
            </span>
          </td>
          <td><strong>${song.tempo}</strong> BPM</td>
          <td>${song.spectral_centroid} Hz</td>
          <td><code style="color:var(--accent-cyan); font-size:0.8rem;">(${song.pca_x}, ${song.pca_y})</code></td>
        `;
        songsTableBody.appendChild(tr);
      });
    }

    // Populate Selectors
    [recSongSelect, spotifySeedSongSelect].forEach(selectEl => {
      if (!selectEl) return;
      selectEl.innerHTML = '';
      songs.forEach((song) => {
        const opt = document.createElement('option');
        opt.value = song.name;
        opt.textContent = `${song.name} (${song.tempo} BPM · Group #${song.cluster + 1})`;
        selectEl.appendChild(opt);
      });
    });

    state.selectedSongForRec = songs[0]?.name || null;

    // Show/hide intra-catalog similarity box based on track count
    if (catalogSimBox) {
      catalogSimBox.style.display = songs.length >= 2 ? 'block' : 'none';
    }

    // Draw 2D PCA Scatter Plot
    drawPcaChart();
  }

  function getClusterColor(clusterId) {
    return CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
  }

  /* -----------------------------------------------------------------
     7. Interactive 2D Scatter Plot Canvas ("Song Map")
     ----------------------------------------------------------------- */
  let chartPoints = [];

  function initCanvas() {
    if (!pcaCanvas) return;
    resizeCanvas();

    pcaCanvas.addEventListener('mousemove', (e) => {
      const rect = pcaCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let hovered = null;
      for (const pt of chartPoints) {
        const dx = pt.screenX - mouseX;
        const dy = pt.screenY - mouseY;
        if (Math.hypot(dx, dy) <= pt.radius + 4) {
          hovered = pt;
          break;
        }
      }

      if (hovered) {
        pcaCanvas.style.cursor = 'pointer';
        showChartTooltip(hovered, e.clientX, e.clientY);
      } else {
        pcaCanvas.style.cursor = 'default';
        hideChartTooltip();
      }
    });

    pcaCanvas.addEventListener('click', (e) => {
      const rect = pcaCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      for (const pt of chartPoints) {
        const dx = pt.screenX - mouseX;
        const dy = pt.screenY - mouseY;
        if (Math.hypot(dx, dy) <= pt.radius + 6) {
          state.selectedSongForRec = pt.song.name;
          if (recSongSelect) recSongSelect.value = pt.song.name;
          if (spotifySeedSongSelect) spotifySeedSongSelect.value = pt.song.name;
          drawPcaChart();
          showToast(`Selected "${pt.song.name}"! Fetching matching Spotify tracks...`, 'info');
          executeSpotifyRecommend();
          break;
        }
      }
    });

    pcaCanvas.addEventListener('mouseleave', hideChartTooltip);
  }

  function resizeCanvas() {
    if (!pcaCanvas) return;
    const rect = pcaCanvas.parentElement.getBoundingClientRect();
    pcaCanvas.width = rect.width;
    pcaCanvas.height = 440;
  }

  function drawPcaChart() {
    if (!pcaCanvas || !pcaCtx || !state.analyzedData) return;

    const songs = state.analyzedData.songs || [];
    if (songs.length === 0) return;

    resizeCanvas();
    const width = pcaCanvas.width;
    const height = pcaCanvas.height;

    pcaCtx.clearRect(0, 0, width, height);

    const pad = 60;
    const drawW = width - pad * 2;
    const drawH = height - pad * 2;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    songs.forEach((s) => {
      if (s.pca_x < minX) minX = s.pca_x;
      if (s.pca_x > maxX) maxX = s.pca_x;
      if (s.pca_y < minY) minY = s.pca_y;
      if (s.pca_y > maxY) maxY = s.pca_y;
    });

    if (minX === maxX) { minX -= 2; maxX += 2; }
    if (minY === maxY) { minY -= 2; maxY += 2; }

    const spanX = (maxX - minX) * 1.3 || 4;
    const spanY = (maxY - minY) * 1.3 || 4;
    const midX = (maxX + minX) / 2;
    const midY = (maxY + minY) / 2;

    const plotMinX = midX - spanX / 2;
    const plotMinY = midY - spanY / 2;

    const toScreenX = (val) => pad + ((val - plotMinX) / spanX) * drawW;
    const toScreenY = (val) => height - pad - ((val - plotMinY) / spanY) * drawH;

    // Grid lines
    pcaCtx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    pcaCtx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const gx = pad + (drawW / 6) * i;
      pcaCtx.beginPath();
      pcaCtx.moveTo(gx, pad);
      pcaCtx.lineTo(gx, height - pad);
      pcaCtx.stroke();

      const gy = pad + (drawH / 6) * i;
      pcaCtx.beginPath();
      pcaCtx.moveTo(pad, gy);
      pcaCtx.lineTo(width - pad, gy);
      pcaCtx.stroke();
    }

    // Axes Labels
    pcaCtx.fillStyle = '#9ba1b8';
    pcaCtx.font = '12px Plus Jakarta Sans, sans-serif';
    pcaCtx.textAlign = 'center';
    pcaCtx.fillText('Timbre & Harmonic Warmth (Sonic Texture)', width / 2, height - 18);

    pcaCtx.save();
    pcaCtx.translate(20, height / 2);
    pcaCtx.rotate(-Math.PI / 2);
    pcaCtx.fillText('Energy & Rhythmic Pace (Tempo / Brightness)', 0, 0);
    pcaCtx.restore();

    chartPoints = [];

    songs.forEach((song) => {
      const sx = toScreenX(song.pca_x);
      const sy = toScreenY(song.pca_y);
      const color = getClusterColor(song.cluster);
      const isSelected = state.selectedSongForRec === song.name;

      const radius = isSelected ? 12 : 8;

      const glow = pcaCtx.createRadialGradient(sx, sy, 0, sx, sy, radius * 2.8);
      glow.addColorStop(0, color.glow);
      glow.addColorStop(1, 'transparent');
      pcaCtx.fillStyle = glow;
      pcaCtx.beginPath();
      pcaCtx.arc(sx, sy, radius * 2.8, 0, Math.PI * 2);
      pcaCtx.fill();

      if (isSelected) {
        pcaCtx.strokeStyle = '#fff';
        pcaCtx.lineWidth = 3;
        pcaCtx.beginPath();
        pcaCtx.arc(sx, sy, radius + 4, 0, Math.PI * 2);
        pcaCtx.stroke();
      }

      pcaCtx.fillStyle = color.fill;
      pcaCtx.beginPath();
      pcaCtx.arc(sx, sy, radius, 0, Math.PI * 2);
      pcaCtx.fill();

      pcaCtx.strokeStyle = color.stroke;
      pcaCtx.lineWidth = 2;
      pcaCtx.stroke();

      pcaCtx.fillStyle = isSelected ? '#ffffff' : '#c7cad9';
      pcaCtx.font = isSelected ? 'bold 12px Outfit, sans-serif' : '11px Plus Jakarta Sans, sans-serif';
      pcaCtx.textAlign = 'center';
      pcaCtx.fillText(song.name, sx, sy - radius - 8);

      chartPoints.push({
        song: song,
        screenX: sx,
        screenY: sy,
        radius: radius,
        color: color
      });
    });
  }

  function showChartTooltip(pt, clientX, clientY) {
    if (!chartTooltip) return;
    const song = pt.song;
    chartTooltip.innerHTML = `
      <div style="font-weight:700; margin-bottom:4px; color:${pt.color.stroke};">${escapeHtml(song.name)}</div>
      <div>Playlist Group: <strong>#${song.cluster + 1}</strong> (${pt.color.name})</div>
      <div>Tempo: <strong>${song.tempo} BPM</strong></div>
      <div>Sonic Brightness: <strong>${song.spectral_centroid} Hz</strong></div>
      <div style="font-size:0.75rem; color:#1ed760; margin-top:4px;">Click to find matching songs on Spotify</div>
    `;

    chartTooltip.style.left = `${pt.screenX + 16}px`;
    chartTooltip.style.top = `${pt.screenY - 20}px`;
    chartTooltip.style.opacity = '1';
  }

  function hideChartTooltip() {
    if (chartTooltip) chartTooltip.style.opacity = '0';
  }

  /* -----------------------------------------------------------------
     8. Spotify Global Recommendations Integration
     ----------------------------------------------------------------- */
  async function executeSpotifyRecommend() {
    if (!state.analyzedData || !state.analyzedData.songs) {
      showAlert('error', 'Please analyze your audio first.');
      return;
    }

    const selectedName = spotifySeedSongSelect?.value || state.selectedSongForRec;
    const songObj = state.analyzedData.songs.find(s => s.name === selectedName) || state.analyzedData.songs[0];

    if (!songObj) return;

    spotifyRecommendBtn.disabled = true;
    spotifySpinner.style.display = 'inline-block';

    const payload = {
      tempo: songObj.tempo,
      spectral_centroid: songObj.spectral_centroid,
      genre: spotifyGenreSelect?.value || 'pop',
      limit: 6,
      spotify_client_id: state.spotifyClientId,
      spotify_client_secret: state.spotifyClientSecret
    };

    try {
      const response = await fetch(`${API_BASE}/api/spotify/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        showToast(data.error || 'Failed to fetch Spotify recommendations.', 'error');
        return;
      }

      renderSpotifyTracks(data.tracks || [], songObj);

      if (data.source === 'live_spotify_api') {
        showToast('Fetched live Spotify tracks matching your audio acoustic profile!', 'success');
      }

    } catch (err) {
      showToast('Could not reach Spotify recommendation endpoint on backend.', 'error');
    } finally {
      spotifyRecommendBtn.disabled = false;
      spotifySpinner.style.display = 'none';
    }
  }

  function renderSpotifyTracks(tracks, seedSong) {
    if (!spotifyCardsContainer) return;
    spotifyCardsContainer.innerHTML = '';

    if (tracks.length === 0) {
      spotifyCardsContainer.innerHTML = '<p style="color:var(--text-muted); padding:16px;">No matching tracks found for this acoustic profile.</p>';
      return;
    }

    tracks.forEach((track) => {
      const card = document.createElement('div');
      card.className = 'spotify-card';

      card.innerHTML = `
        <div class="spotify-card-header">
          <img src="${track.album_image}" alt="${escapeHtml(track.album_name)}" class="spotify-album-art" loading="lazy">
          <div class="spotify-meta">
            <span class="sim-score-badge" style="align-self: flex-start; margin-bottom: 4px;">
              ${track.similarity_percent}% Match
            </span>
            <div class="spotify-track-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</div>
            <div class="spotify-artist-name" title="${escapeHtml(track.artists)}">${escapeHtml(track.artists)}</div>
          </div>
        </div>

        <div style="font-size: 0.78rem; color: var(--text-dim); line-height: 1.4;">
          ${escapeHtml(track.match_reason || `Matched with ~${seedSong.tempo} BPM pace`)}
        </div>

        ${
          track.preview_url
            ? `<div style="margin-top: 4px;">
                 <label style="display:block; font-size:0.7rem; color:var(--text-dim); margin-bottom:2px;">30s Audio Preview:</label>
                 <audio controls preload="none" src="${track.preview_url}"></audio>
               </div>`
            : ''
        }

        <div class="spotify-actions">
          <span style="font-size: 0.75rem; color: #1ed760; font-weight: 600;">
            Spotify Catalog
          </span>
          <a href="${track.spotify_url}" target="_blank" rel="noopener" class="spotify-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            <span>Listen on Spotify</span>
          </a>
        </div>
      `;

      spotifyCardsContainer.appendChild(card);
    });
  }

  /* -----------------------------------------------------------------
     9. Spotify Modal Credentials Management
     ----------------------------------------------------------------- */
  function openSpotifyModal() {
    if (!spotifyModal) return;
    spotifyModal.classList.add('open');
    if (spotifyModalFeedback) spotifyModalFeedback.style.display = 'none';
  }

  function closeSpotifyModal() {
    if (!spotifyModal) return;
    spotifyModal.classList.remove('open');
  }

  async function handleSaveSpotifyKeys(e) {
    e.preventDefault();
    const cId = spotifyClientIdInput.value.trim();
    const cSec = spotifyClientSecretInput.value.trim();

    if (!cId || !cSec) {
      showModalFeedback('error', 'Please provide both Client ID and Client Secret.');
      return;
    }

    const submitBtn = spotifyKeysForm.querySelector('button[type="submit"]');
    const origText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" style="width:14px; height:14px;"></span> Verifying with Spotify...';

    try {
      const res = await fetch(`${API_BASE}/api/spotify/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: cId, client_secret: cSec })
      });

      const data = await res.json();

      if (res.ok && data.status === 'valid') {
        // Save in state & localStorage
        state.spotifyClientId = cId;
        state.spotifyClientSecret = cSec;
        localStorage.setItem('mm_spotify_client_id', cId);
        localStorage.setItem('mm_spotify_client_secret', cSec);

        initSpotifyState();
        showModalFeedback('success', 'Spotify API connected successfully! Live recommendations enabled.');
        showToast('Spotify credentials verified and saved!', 'success');

        setTimeout(closeSpotifyModal, 1500);

        // If we already have analyzed audio, refresh Spotify recommendations
        if (state.analyzedData) executeSpotifyRecommend();
      } else {
        showModalFeedback('error', data.error || 'Spotify authentication failed. Check your Client ID and Secret.');
      }
    } catch (err) {
      showModalFeedback('error', 'Could not reach backend to verify credentials.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origText;
    }
  }

  function handleDisconnectSpotify() {
    state.spotifyClientId = '';
    state.spotifyClientSecret = '';
    localStorage.removeItem('mm_spotify_client_id');
    localStorage.removeItem('mm_spotify_client_secret');
    if (spotifyClientIdInput) spotifyClientIdInput.value = '';
    if (spotifyClientSecretInput) spotifyClientSecretInput.value = '';
    if (spotifyClearBtn) spotifyClearBtn.style.display = 'none';
    initSpotifyState();
    showModalFeedback('info', 'Spotify credentials disconnected.');
    showToast('Spotify credentials cleared.', 'info');
  }

  function showModalFeedback(type, msg) {
    if (!spotifyModalFeedback) return;
    spotifyModalFeedback.className = `alert alert-${type}`;
    spotifyModalFeedback.innerHTML = `<span>${msg}</span>`;
    spotifyModalFeedback.style.display = 'flex';
  }

  /* -----------------------------------------------------------------
     10. Intra-Catalog Similarity Action (POST /api/recommend)
     ----------------------------------------------------------------- */
  async function executeRecommend() {
    const selectedSong = recSongSelect?.value;
    if (!selectedSong) {
      showAlert('error', 'Please select a song from the dropdown.');
      return;
    }

    const count = recCountSlider ? recCountSlider.value : 3;

    recBtn.disabled = true;
    const origHtml = recBtn.innerHTML;
    recBtn.innerHTML = '<span class="spinner"></span> Finding Similar Songs...';

    try {
      const response = await fetch(`${API_BASE}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: selectedSong, count: count })
      });

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        showAlert('error', data.error || 'Failed to generate recommendations.');
        return;
      }

      renderIntraRecommendations(data);
      showToast(`Generated top ${data.recommendations?.length || 0} intra-catalog matches!`, 'success');

    } catch (err) {
      showAlert('error', `Recommendation request failed. Check server status at ${API_BASE}.`);
    } finally {
      recBtn.disabled = false;
      recBtn.innerHTML = origHtml;
    }
  }

  function renderIntraRecommendations(data) {
    if (!recCardsContainer) return;
    recCardsContainer.innerHTML = '';

    const recs = data.recommendations || [];
    if (recs.length === 0) {
      recCardsContainer.innerHTML = '<p style="color:var(--text-muted); padding:16px;">No other songs in your library to compare. Upload or record more tracks to find sibling songs with matching vibes.</p>';
      return;
    }

    recs.forEach((rec, idx) => {
      const card = document.createElement('div');
      card.className = 'rec-card';

      const clusterColor = getClusterColor(rec.cluster);
      const isSameCluster = rec.same_cluster;
      const audioSrc = state.fileAudioUrls[rec.name] || '';

      card.innerHTML = `
        <div class="rec-card-header">
          <div>
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-dim); font-weight:700; margin-bottom:4px;">
              Match #${idx + 1}
            </div>
            <div class="rec-song-title">${escapeHtml(rec.name)}</div>
          </div>
          <div class="sim-score-badge">
            ${rec.similarity_percent}% Match
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; margin-top:4px;">
          <span class="cluster-pill" style="background:${clusterColor.glow}; color:${clusterColor.stroke}; border:1px solid ${clusterColor.stroke};">
            Group #${rec.cluster + 1}
          </span>
          <span style="font-size:0.8rem; color:${isSameCluster ? '#34d399' : '#94a3b8'};">
            ${isSameCluster ? '✓ Same Vibe Group' : '⟷ Harmonic Sibling'}
          </span>
        </div>

        <div style="font-size:0.85rem; color:var(--text-muted);">
          Tempo: <strong>${rec.tempo} BPM</strong> · Compatibility: <strong>${(parseFloat(rec.similarity) * 100).toFixed(0)}%</strong>
        </div>

        ${
          audioSrc
            ? `<div style="margin-top:6px;">
                 <label style="display:block; font-size:0.75rem; color:var(--text-dim); margin-bottom:4px;">Audio Preview:</label>
                 <audio controls preload="none" src="${audioSrc}"></audio>
               </div>`
            : ''
        }
      `;

      recCardsContainer.appendChild(card);
    });

    recCardsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* -----------------------------------------------------------------
     11. Alert Helpers
     ----------------------------------------------------------------- */
  function showAlert(type, message) {
    if (!statusAlertEl) return;
    statusAlertEl.className = `alert alert-${type}`;
    statusAlertEl.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${
          type === 'success'
            ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
            : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
        }
      </svg>
      <span>${message}</span>
    `;
    statusAlertEl.style.display = 'flex';
  }

  function clearAlert() {
    if (!statusAlertEl) return;
    statusAlertEl.style.display = 'none';
    statusAlertEl.innerHTML = '';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* -----------------------------------------------------------------
     12. Session Restoration Listener (MusicMatchAuth)
     ----------------------------------------------------------------- */
  window.addEventListener('musicmatch:sessionRestored', (e) => {
    const data = e.detail;
    if (!data || !data.songs) return;
    state.analyzedData = data;
    renderAnalysisResults(data);
    showAlert('success', `Restored saved session with ${data.total_analyzed} track(s) and ${data.clusters_count} mood clusters!`);
    resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (data.songs && data.songs.length > 0) {
      executeSpotifyRecommend();
    }
  });
})();
