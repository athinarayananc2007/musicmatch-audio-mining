/**
 * MusicMatch — Authentication & User Library Client Module
 * ========================================================
 * Provides client-side state management for JWT authentication,
 * persistent session libraries, and seamless session restoration.
 */

(function () {
  'use strict';

  // API Base URL resolution: respects window.API_BASE (set by main.js)
  const API_BASE = (function () {
    if (typeof window.API_BASE !== 'undefined') {
      const base = (window.API_BASE || '').replace(/\/+$/, '');
      return base ? `${base}/api` : '/api';
    }
    const loc = window.location;
    if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
      return 'http://' + loc.hostname + ':5000/api';
    }
    return '/api';
  })();

  const TOKEN_KEY = 'mm_jwt_token';
  const USER_KEY  = 'mm_user_profile';

  const Auth = {
    // Current in-memory state
    token: localStorage.getItem(TOKEN_KEY) || null,
    user: (function () {
      try {
        const u = localStorage.getItem(USER_KEY);
        return u ? JSON.parse(u) : null;
      } catch (e) {
        return null;
      }
    })(),

    isAuthenticated() {
      return Boolean(this.token && this.user);
    },

    getAuthHeaders() {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      return headers;
    },

    async register(username, email, password) {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.error || 'Registration failed.');
      }
      this.setSession(data.token, data.user);
      return data;
    },

    async login(username, password) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.error || 'Invalid credentials.');
      }
      this.setSession(data.token, data.user);
      return data;
    },

    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      this.dispatchChange();
    },

    setSession(token, user) {
      this.token = token;
      this.user = user;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      this.dispatchChange();
      // Auto-link current session cookie if present
      this.linkCurrentSession();
    },

    async fetchProfile() {
      if (!this.token) return null;
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: this.getAuthHeaders()
        });
        if (res.status === 401) {
          this.logout();
          return null;
        }
        const data = await res.json();
        if (data.status === 'success') {
          this.user = data.user;
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          this.dispatchChange();
          return data.user;
        }
      } catch (err) {
        console.warn('[Auth] Error fetching profile:', err);
      }
      return null;
    },

    async linkCurrentSession(sessionId) {
      if (!this.isAuthenticated()) return;
      try {
        await fetch(`${API_BASE}/auth/link-session`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ session_id: sessionId || undefined })
        });
      } catch (err) {
        console.warn('[Auth] Failed to link session:', err);
      }
    },

    async getSavedSessions() {
      if (!this.isAuthenticated()) return [];
      const res = await fetch(`${API_BASE}/user/sessions`, {
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.error || 'Failed to fetch sessions');
      }
      return data.sessions || [];
    },

    async restoreSession(sessionId) {
      if (!this.isAuthenticated()) throw new Error('Must be signed in to restore sessions.');
      const res = await fetch(`${API_BASE}/user/sessions/${sessionId}/restore`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.error || 'Failed to restore session');
      }
      // Broadcast event for demo.js to catch and populate UI
      window.dispatchEvent(new CustomEvent('musicmatch:sessionRestored', { detail: data }));
      return data;
    },

    async deleteSession(sessionId) {
      if (!this.isAuthenticated()) throw new Error('Must be signed in to delete sessions.');
      const res = await fetch(`${API_BASE}/user/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.error || 'Failed to delete session');
      }
      return data;
    },

    dispatchChange() {
      window.dispatchEvent(new CustomEvent('musicmatch:authChange', {
        detail: { isAuthenticated: this.isAuthenticated(), user: this.user }
      }));
    }
  };

  // Expose Auth globally
  window.MusicMatchAuth = Auth;

  // ─── UI Controller ────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initAuthUI();
    if (Auth.isAuthenticated()) {
      Auth.fetchProfile();
    }
  });

  function initAuthUI() {
    const navUserArea     = document.getElementById('nav-user-area');
    const authModal       = document.getElementById('auth-modal');
    const libraryModal    = document.getElementById('library-modal');
    const closeAuthBtn    = document.getElementById('close-auth-modal');
    const closeLibraryBtn = document.getElementById('close-library-modal');

    // Modals open/close helpers
    function openModal(modal) {
      if (modal) {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    }
    function closeModal(modal) {
      if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
      }
    }

    if (closeAuthBtn && authModal) {
      closeAuthBtn.addEventListener('click', () => closeModal(authModal));
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeModal(authModal);
      });
    }

    if (closeLibraryBtn && libraryModal) {
      closeLibraryBtn.addEventListener('click', () => closeModal(libraryModal));
      libraryModal.addEventListener('click', (e) => {
        if (e.target === libraryModal) closeModal(libraryModal);
      });
    }

    // Escape key closes modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal(authModal);
        closeModal(libraryModal);
      }
    });

    // Wire up tab switching in Auth Modal
    const tabBtns = document.querySelectorAll('.auth-tab-btn');
    const tabPanes = document.querySelectorAll('.auth-tab-pane');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const activePane = document.getElementById(`auth-pane-${target}`);
        if (activePane) activePane.classList.add('active');
        clearAuthAlerts();
      });
    });

    // Form handlers
    const loginForm = document.getElementById('auth-login-form');
    const registerForm = document.getElementById('auth-register-form');

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const origText = submitBtn.innerHTML;

        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="spinner-sm"></span> Signing In...';
          clearAuthAlerts();
          await Auth.login(username, password);
          showAuthAlert('success', `Welcome back, ${username}!`);
          setTimeout(() => {
            closeModal(authModal);
            loginForm.reset();
          }, 800);
        } catch (err) {
          showAuthAlert('error', err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
        }
      });
    }

    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const origText = submitBtn.innerHTML;

        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="spinner-sm"></span> Creating Account...';
          clearAuthAlerts();
          await Auth.register(username, email, password);
          showAuthAlert('success', `Account created! Welcome, ${username}!`);
          setTimeout(() => {
            closeModal(authModal);
            registerForm.reset();
          }, 800);
        } catch (err) {
          showAuthAlert('error', err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
        }
      });
    }

    // Navbar state sync
    function updateNavbar() {
      if (!navUserArea) return;
      if (Auth.isAuthenticated()) {
        const u = Auth.user;
        navUserArea.innerHTML = `
          <div class="user-pill-group">
            <div class="user-badge-dropdown">
              <button type="button" class="user-profile-btn" id="user-profile-btn">
                <span class="user-avatar-initial">${(u.username || 'U')[0].toUpperCase()}</span>
                <span class="user-name-text">${escapeHtml(u.username)}</span>
              </button>
              <div class="user-dropdown-menu" id="user-dropdown-menu">
                <div class="user-dropdown-header">
                  <strong>${escapeHtml(u.username)}</strong>
                  <small>${escapeHtml(u.email || '')}</small>
                </div>
                <button type="button" class="user-dropdown-item" id="dropdown-library-btn">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                  </svg>
                  <span>Saved Sessions</span>
                </button>
                <div class="user-dropdown-divider"></div>
                <button type="button" class="user-dropdown-item text-danger" id="logout-btn">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        `;

        // Wire dropdown toggle
        const profileBtn = document.getElementById('user-profile-btn');
        const dropdownMenu = document.getElementById('user-dropdown-menu');
        if (profileBtn && dropdownMenu) {
          profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
          });
          document.addEventListener('click', () => dropdownMenu.classList.remove('show'));
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', () => {
            Auth.logout();
          });
        }

        const openLibBtn = document.getElementById('open-library-btn');
        const dropLibBtn = document.getElementById('dropdown-library-btn');
        const handleOpenLibrary = () => {
          renderLibrarySessions();
          openModal(libraryModal);
        };
        if (openLibBtn) openLibBtn.addEventListener('click', handleOpenLibrary);
        if (dropLibBtn) dropLibBtn.addEventListener('click', handleOpenLibrary);

      } else {
        navUserArea.innerHTML = `
          <button type="button" class="nav-auth-pill" id="open-auth-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>Sign In</span>
          </button>
        `;
        const openAuthBtn = document.getElementById('open-auth-btn');
        if (openAuthBtn) {
          openAuthBtn.addEventListener('click', () => {
            clearAuthAlerts();
            openModal(authModal);
          });
        }
      }
    }

    // Populate Library Modal
    async function renderLibrarySessions() {
      const container = document.getElementById('library-sessions-list');
      if (!container) return;
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div class="spinner-sm" style="margin: 0 auto 12px auto;"></div>
          <p>Loading your saved sessions...</p>
        </div>
      `;

      try {
        const sessions = await Auth.getSavedSessions();
        if (!sessions || sessions.length === 0) {
          container.innerHTML = `
            <div class="library-empty-state">
              <div class="library-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              </div>
              <h3>No Saved Sessions Yet</h3>
              <p>Upload or record audio in the Demo Studio while signed in. Your acoustic clusters, PCA coordinates, and similarity scores will automatically be saved to your account!</p>
              <a href="demo.html" class="btn btn-primary btn-sm" style="margin-top: 16px;">Go to Demo Studio</a>
            </div>
          `;
          return;
        }

        container.innerHTML = sessions.map(s => {
          const dateStr = new Date(s.updated_at || s.created_at).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
          });
          const songPreviews = (s.preview_songs || []).map(name => `
            <span class="library-song-tag">🎵 ${escapeHtml(name)}</span>
          `).join('');

          return `
            <div class="library-session-card" data-session-id="${s.session_id}">
              <div class="library-card-header">
                <div>
                  <div class="library-card-title">
                    <span>Acoustic Session</span>
                    <span class="session-badge">${s.song_count} track${s.song_count > 1 ? 's' : ''}</span>
                    <span class="session-badge badge-cyan">${s.clusters_count} clusters</span>
                  </div>
                  <div class="library-card-date">Updated: ${dateStr}</div>
                </div>
                <div class="library-card-actions">
                  <button type="button" class="btn btn-primary btn-sm restore-session-btn" data-id="${s.session_id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    <span>Restore</span>
                  </button>
                  <button type="button" class="btn-icon delete-session-btn" data-id="${s.session_id}" title="Delete session">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="library-song-tags">
                ${songPreviews}
                ${s.song_count > (s.preview_songs || []).length ? `<span class="library-song-tag text-muted">+${s.song_count - s.preview_songs.length} more</span>` : ''}
              </div>
            </div>
          `;
        }).join('');

        // Wire up restore & delete buttons
        container.querySelectorAll('.restore-session-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const sid = btn.dataset.id;
            const origHTML = btn.innerHTML;
            try {
              btn.disabled = true;
              btn.innerHTML = '<span class="spinner-sm"></span> Restoring...';
              await Auth.restoreSession(sid);
              closeModal(libraryModal);
              // If not on demo page, navigate there
              if (!window.location.pathname.endsWith('demo.html')) {
                window.location.href = 'demo.html?restored=1';
              }
            } catch (err) {
              alert('Failed to restore session: ' + err.message);
            } finally {
              btn.disabled = false;
              btn.innerHTML = origHTML;
            }
          });
        });

        container.querySelectorAll('.delete-session-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const sid = btn.dataset.id;
            if (!confirm('Are you sure you want to delete this saved acoustic session?')) return;
            try {
              btn.disabled = true;
              await Auth.deleteSession(sid);
              renderLibrarySessions();
            } catch (err) {
              alert('Error deleting session: ' + err.message);
              btn.disabled = false;
            }
          });
        });

      } catch (err) {
        container.innerHTML = `
          <div style="color: var(--accent-pink); padding: 20px; text-align: center;">
            <p>Error loading sessions: ${escapeHtml(err.message)}</p>
          </div>
        `;
      }
    }

    function showAuthAlert(type, message) {
      const alertBox = document.getElementById('auth-modal-feedback');
      if (!alertBox) return;
      alertBox.className = `auth-alert auth-alert-${type}`;
      alertBox.textContent = message;
      alertBox.style.display = 'block';
    }

    function clearAuthAlerts() {
      const alertBox = document.getElementById('auth-modal-feedback');
      if (alertBox) {
        alertBox.style.display = 'none';
        alertBox.textContent = '';
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[m]);
    }

    // React to auth changes
    window.addEventListener('musicmatch:authChange', () => {
      updateNavbar();
    });

    // Initial render
    updateNavbar();
  }
})();
