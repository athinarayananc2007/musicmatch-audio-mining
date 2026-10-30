/**
 * MusicMatch - Main UI Controller
 * =====================================
 * Handles:
 * - Navbar transparency & blur on scroll
 * - Mobile hamburger menu toggle
 * - Active page link highlighting
 * - IntersectionObserver scroll reveal animations
 * - Contact form client-side validation & API submission
 * - Notification toast alerts
 */

(function () {
  'use strict';

  // API Base Configuration
  // Supports local dev, Netlify proxy (empty string uses same origin /api/* rewrite),
  // or explicit override via window.CUSTOM_API_BASE or localStorage('MUSICMATCH_API_BASE').
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  window.API_BASE = window.CUSTOM_API_BASE 
    || localStorage.getItem('MUSICMATCH_API_BASE') 
    || (isLocal ? 'http://localhost:5000' : '');

  document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initScrollReveal();
    initContactForm();
  });

  /* -----------------------------------------------------------------
     1. Navbar & Mobile Menu Controller
     ----------------------------------------------------------------- */
  function initNavbar() {
    const navbar = document.querySelector('.navbar');
    const hamburger = document.querySelector('.hamburger');
    const mobileNav = document.querySelector('.mobile-nav');

    // Sticky background blur on scroll
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        navbar?.classList.add('scrolled');
      } else {
        navbar?.classList.remove('scrolled');
      }
    });

    // Mobile menu toggle
    if (hamburger && mobileNav) {
      hamburger.addEventListener('click', () => {
        const isOpen = mobileNav.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      // Close mobile menu on link click
      mobileNav.querySelectorAll('.nav-link').forEach((link) => {
        link.addEventListener('click', () => {
          mobileNav.classList.remove('open');
          hamburger.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // Active page highlighting
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach((link) => {
      const href = link.getAttribute('href');
      if (
        href === currentPath ||
        (currentPath === '' && href === 'index.html') ||
        (currentPath === 'index.html' && href === 'index.html')
      ) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  /* -----------------------------------------------------------------
     2. Scroll Reveal Animations (IntersectionObserver)
     ----------------------------------------------------------------- */
  function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal');
    if (!revealElements.length) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('active');
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
      );

      revealElements.forEach((el) => observer.observe(el));
    } else {
      // Fallback
      revealElements.forEach((el) => el.classList.add('active'));
    }
  }

  /* -----------------------------------------------------------------
     3. Contact Form Submission & Validation
     ----------------------------------------------------------------- */
  function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) return;

    const nameInput = document.getElementById('contact-name');
    const emailInput = document.getElementById('contact-email');
    const messageInput = document.getElementById('contact-message');
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const feedbackBox = document.getElementById('contact-feedback');

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Reset errors
      clearErrors();
      let isValid = true;

      // Validate Name
      if (!nameInput.value.trim()) {
        showError(nameInput, 'Please provide your full name.');
        isValid = false;
      }

      // Validate Email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailInput.value.trim()) {
        showError(emailInput, 'Email address is required.');
        isValid = false;
      } else if (!emailRegex.test(emailInput.value.trim())) {
        showError(emailInput, 'Please provide a valid email address.');
        isValid = false;
      }

      // Validate Message
      if (!messageInput.value.trim()) {
        showError(messageInput, 'Message cannot be empty.');
        isValid = false;
      } else if (messageInput.value.trim().length < 10) {
        showError(messageInput, 'Please provide at least 10 characters.');
        isValid = false;
      }

      if (!isValid) return;

      // Submit to backend /api/contact
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Sending Message...';

      try {
        const response = await fetch(`${window.API_BASE}/api/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            message: messageInput.value.trim()
          })
        });

        const data = await response.json();

        if (response.ok && data.status === 'success') {
          showFeedback('success', data.message || 'Thank you! Your message has been safely received.');
          contactForm.reset();
        } else {
          showFeedback('error', data.error || 'Failed to submit inquiry. Please check your inputs.');
        }
      } catch (err) {
        showFeedback(
          'error',
          'Could not connect to the MusicMatch API server. Please ensure the backend is running at http://localhost:5000.'
        );
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    });

    function showError(inputEl, msg) {
      const errEl = inputEl.parentElement.querySelector('.input-error');
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
      inputEl.style.borderColor = 'var(--accent-rose)';
    }

    function clearErrors() {
      contactForm.querySelectorAll('.input-error').forEach((el) => {
        el.textContent = '';
        el.style.display = 'none';
      });
      contactForm.querySelectorAll('.form-input, .form-textarea').forEach((el) => {
        el.style.borderColor = 'var(--border-subtle)';
      });
      if (feedbackBox) {
        feedbackBox.innerHTML = '';
        feedbackBox.style.display = 'none';
      }
    }

    function showFeedback(type, message) {
      if (!feedbackBox) return;
      feedbackBox.className = `alert alert-${type}`;
      feedbackBox.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${
            type === 'success'
              ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
              : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
          }
        </svg>
        <span>${message}</span>
      `;
      feedbackBox.style.display = 'flex';
      feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Global helper for toast messages
  window.showToast = function (message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type}`;
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.7)';
    toast.style.maxWidth = '360px';
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  };
})();
