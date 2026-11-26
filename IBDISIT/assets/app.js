/* ==========================================================================
   SIDBI Grade A/B (IT Stream) 2026 — Core Portal Engine (Vanilla JS)
   Modules: Theme, Mobile Nav, TOC Scroll-Spy, Countdown, Syllabus Tracker,
            Reusable Objective MCQ Engine, Descriptive Typing & AI Eval Lab
   ========================================================================== */

(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    theme: 'sidbi2026_theme',
    progress: 'sidbi2026_syllabus_progress_v1',
    descDrafts: 'sidbi2026_desc_drafts_v1'
  };

  // Safe localStorage helpers
  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Storage unavailable (e.g., private mode / sandbox)
    }
  }

  // Toast helper
  let toastTimer = null;
  function showToast(message) {
    let el = document.getElementById('portal-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'portal-toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // Copy to clipboard with fallback
  function copyText(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast(successMsg || 'Copied to clipboard!'),
        () => fallbackCopy(text, successMsg)
      );
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(successMsg || 'Copied to clipboard!');
    } catch (e) {
      showToast('Copy failed — please select and copy manually.');
    }
    document.body.removeChild(ta);
  }

  // ========================================================================
  // 1. Theme (Light / Dark) & Mobile Navigation
  // ========================================================================
  function initTheme() {
    const saved = readStore(STORAGE_KEYS.theme, null);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        writeStore(STORAGE_KEYS.theme, next);
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? '&#9728; Light' : '&#9790; Dark';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  function initMobileNav() {
    const toggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');
    if (!toggle || !navLinks) return;
    toggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // ========================================================================
  // 2. Sticky Sidebar TOC Scroll-Spy
  // ========================================================================
  function initTOCSpy() {
    const links = Array.from(document.querySelectorAll('.toc-list a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    const sections = links
      .map(link => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + id));
          }
        });
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0.05 }
    );

    sections.forEach(sec => observer.observe(sec));
  }

  // ========================================================================
  // 3. Live Countdown to 27 December 2026 (09:00 AM IST)
  // ========================================================================
  function initCountdown(targetISO) {
    const dEl = document.getElementById('cd-days');
    const hEl = document.getElementById('cd-hours');
    const mEl = document.getElementById('cd-mins');
    const sEl = document.getElementById('cd-secs');
    const statusEl = document.getElementById('cd-status');
    if (!dEl || !hEl || !mEl || !sEl) return;

    const targetMs = new Date(targetISO || '2026-12-27T09:00:00+05:30').getTime();

    function tick() {
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        dEl.textContent = '00';
        hEl.textContent = '00';
        mEl.textContent = '00';
        sEl.textContent = '00';
        if (statusEl) statusEl.textContent = 'Exam Day Reached!';
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      dEl.textContent = String(days).padStart(2, '0');
      hEl.textContent = String(hours).padStart(2, '0');
      mEl.textContent = String(mins).padStart(2, '0');
      sEl.textContent = String(secs).padStart(2, '0');
    }

    tick();
    setInterval(tick, 1000);
  }

  // ========================================================================
  // 4. Syllabus Progress Tracker (localStorage)
  // ========================================================================
  const OFFICIAL_SYLLABUS = [
    // Cluster 1: Core CS & Programming (7)
    { id: 'it-01', num: 1, cluster: 'cluster1', clusterLabel: 'Cluster 1: Core CS & Programming', title: 'Introduction to Software', href: 'notes/cluster1-ch01-intro-software.html', ready: true },
    { id: 'it-02', num: 2, cluster: 'cluster1', clusterLabel: 'Cluster 1: Core CS & Programming', title: 'Computer Fundamentals', href: 'notes/cluster1-ch02-computer-fundamentals.html', ready: true },
    { id: 'it-03', num: 3, cluster: 'cluster1', clusterLabel: 'Cluster 1: Core CS & Programming', title: 'Data Structures & File Structures', href: 'notes/cluster1-ch03-data-structures.html', ready: true },
    { id: 'it-04', num: 4, cluster: 'cluster1', clusterLabel: 'Cluster 1: Core CS & Programming', title: 'Programming in C, C++, Java, Python', href: 'notes/cluster1-ch04-programming-languages.html', ready: true },
    { id: 'it-05', num: 5, cluster: 'cluster1', clusterLabel: 'Cluster 1: Core CS & Programming', title: 'Object-Oriented Systems', href: 'notes/cluster1-ch05-oops.html', ready: true },
    { id: 'it-06', num: 6, cluster: 'cluster1', clusterLabel: 'Cluster 1: Core CS & Programming', title: 'Design & Analysis of Algorithms (DAA)', href: 'notes/cluster1-ch06-daa.html', ready: true },
    { id: 'it-07', num: 7, cluster: 'cluster1', clusterLabel: 'Cluster 1: Core CS & Programming', title: 'Operating Systems (OS)', href: 'notes/cluster1-ch07-operating-systems.html', ready: true },

    // Cluster 2: Databases, Networks & Security (4)
    { id: 'it-08', num: 8, cluster: 'cluster2', clusterLabel: 'Cluster 2: Databases, Networks & Security', title: 'DBMS & RDBMS', href: 'notes/cluster2-ch08-dbms-rdbms.html', ready: true },
    { id: 'it-09', num: 9, cluster: 'cluster2', clusterLabel: 'Cluster 2: Databases, Networks & Security', title: 'Data Communication & Networks', href: 'notes/cluster2-ch09-networking.html', ready: true },
    { id: 'it-10', num: 10, cluster: 'cluster2', clusterLabel: 'Cluster 2: Databases, Networks & Security', title: 'Computer & Network Architecture', href: 'notes/cluster2-ch10-architecture.html', ready: true },
    { id: 'it-11', num: 11, cluster: 'cluster2', clusterLabel: 'Cluster 2: Databases, Networks & Security', title: 'Cyber / IT Security', href: 'notes/cluster2-ch11-cyber-security.html', ready: true },

    // Cluster 3: SE & Enterprise Systems (5)
    { id: 'it-12', num: 12, cluster: 'cluster3', clusterLabel: 'Cluster 3: SE & Enterprise Systems', title: 'Systems Analysis & Design', href: 'notes/cluster3-ch12-sad.html', ready: true },
    { id: 'it-13', num: 13, cluster: 'cluster3', clusterLabel: 'Cluster 3: SE & Enterprise Systems', title: 'Software Engineering', href: 'notes/cluster3-ch13-software-engineering.html', ready: true },
    { id: 'it-14', num: 14, cluster: 'cluster3', clusterLabel: 'Cluster 3: SE & Enterprise Systems', title: 'Management Information Systems (MIS)', href: 'notes/cluster3-ch14-mis.html', ready: true },
    { id: 'it-15', num: 15, cluster: 'cluster3', clusterLabel: 'Cluster 3: SE & Enterprise Systems', title: 'API Usage', href: 'notes/cluster3-ch15-api-usage.html', ready: true },
    { id: 'it-16', num: 16, cluster: 'cluster3', clusterLabel: 'Cluster 3: SE & Enterprise Systems', title: 'Application Development', href: 'notes/cluster3-ch16-app-development.html', ready: true },

    // Cluster 4: Data, AI/ML & Emerging Tech (9)
    { id: 'it-17', num: 17, cluster: 'cluster4', clusterLabel: 'Cluster 4: Data, AI/ML & Emerging Tech', title: 'AI & Machine Learning', href: 'notes/cluster4-ch17-ai-ml.html', ready: true },
    { id: 'it-18', num: 18, cluster: 'cluster4', clusterLabel: 'Cluster 4: Data, AI/ML & Emerging Tech', title: 'Natural Language Processing (NLP)', href: 'notes/cluster4-ch18-nlp.html', ready: false },
    { id: 'it-19', num: 19, cluster: 'cluster4', clusterLabel: 'Cluster 4: Data, AI/ML & Emerging Tech', title: 'Big Data Analytics', href: 'notes/cluster4-ch19-big-data.html', ready: false },
    { id: 'it-20', num: 20, cluster: 'cluster4', clusterLabel: 'Cluster 4: Data, AI/ML & Emerging Tech', title: 'Data Modelling & Analytics', href: 'notes/cluster4-ch20-data-modelling.html', ready: false },
    { id: 'it-21', num: 21, cluster: 'cluster4', clusterLabel: 'Cluster 4: Data, AI/ML & Emerging Tech', title: 'Data Visualisation', href: 'notes/cluster4-ch21-data-visualisation.html', ready: false },
    { id: 'it-22', num: 22, cluster: 'cluster4', clusterLabel: 'Cluster 4: Data, AI/ML & Emerging Tech', title: 'Data Warehousing', href: 'notes/cluster4-ch22-data-warehousing.html', ready: false },
    { id: 'it-23', num: 23, cluster: 'cluster4', clusterLabel: 'Cluster 4: Data, AI/ML & Emerging Tech', title: 'Numerical & Statistical Computing', href: 'notes/cluster4-ch23-statistical-computing.html', ready: false },
    { id: 'it-24', num: 24, cluster: 'cluster4', clusterLabel: 'Cluster 4: Data, AI/ML & Emerging Tech', title: 'Internet of Things (IoT)', href: 'notes/cluster4-ch24-iot.html', ready: false },
    { id: 'it-25', num: 25, cluster: 'cluster4', clusterLabel: 'Cluster 4: Data, AI/ML & Emerging Tech', title: 'Mobile Computing', href: 'notes/cluster4-ch25-mobile-computing.html', ready: false }
  ];

  function getProgressMap() {
    return readStore(STORAGE_KEYS.progress, {});
  }

  function toggleTopicProgress(id, checked) {
    const map = getProgressMap();
    if (checked) map[id] = true;
    else delete map[id];
    writeStore(STORAGE_KEYS.progress, map);
    return map;
  }

  function initSyllabusTracker() {
    const container = document.getElementById('cluster-tracker-grid');
    if (!container) return;

    let activeFilter = 'all';
    let searchTerm = '';

    const clusters = [
      { key: 'cluster1', title: 'Cluster 1 — Core CS & Programming', meta: 'Topics 1–7 (High Objective Weight)' },
      { key: 'cluster2', title: 'Cluster 2 — Databases, Networks & Security', meta: 'Topics 8–11 (High Numerical & Banking Weight)' },
      { key: 'cluster3', title: 'Cluster 3 — SE & Enterprise Systems', meta: 'Topics 12–16 (High Descriptive Weight)' },
      { key: 'cluster4', title: 'Cluster 4 — Data, AI/ML & Emerging Tech', meta: 'Topics 17–25 (Modern Regulatory Edge)' }
    ];

    function render() {
      const progress = getProgressMap();
      const total = OFFICIAL_SYLLABUS.length;
      const doneCount = OFFICIAL_SYLLABUS.filter(t => !!progress[t.id]).length;
      const pct = total ? Math.round((doneCount / total) * 100) : 0;

      const pctEl = document.getElementById('overall-pct');
      const countEl = document.getElementById('overall-count');
      const barEl = document.getElementById('overall-progress-fill');
      if (pctEl) pctEl.textContent = pct + '%';
      if (countEl) countEl.textContent = doneCount + ' / ' + total + ' IT Topics';
      if (barEl) barEl.style.width = pct + '%';

      container.innerHTML = '';
      clusters.forEach(cl => {
        const items = OFFICIAL_SYLLABUS.filter(t => t.cluster === cl.key);
        const clDone = items.filter(t => !!progress[t.id]).length;
        const clPct = items.length ? Math.round((clDone / items.length) * 100) : 0;

        const filtered = items.filter(t => {
          const isDone = !!progress[t.id];
          if (activeFilter === 'pending' && isDone) return false;
          if (activeFilter === 'completed' && !isDone) return false;
          if (searchTerm && !t.title.toLowerCase().includes(searchTerm)) return false;
          return true;
        });

        const card = document.createElement('div');
        card.className = 'cluster-card';
        card.innerHTML = `
          <div class="cluster-head">
            <div>
              <h3>${cl.title}</h3>
              <div style="font-size:0.78rem;color:var(--text-subtle);margin-top:0.15rem;">${cl.meta}</div>
            </div>
            <span class="cluster-pct">${clDone}/${items.length} (${clPct}%)</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${clPct}%"></div></div>
          <ul class="topic-list"></ul>
        `;

        const ul = card.querySelector('.topic-list');
        if (!filtered.length) {
          ul.innerHTML = '<li style="font-size:0.84rem;color:var(--text-subtle);padding:0.4rem;">No topics match current filter.</li>';
        } else {
          filtered.forEach(topic => {
            const checked = !!progress[topic.id];
            const li = document.createElement('li');
            li.className = 'topic-item' + (checked ? ' completed' : '');
            const statusControl = topic.ready
              ? `<a class="btn btn-primary btn-sm" href="${topic.href}">Open Notes</a>`
              : `<span class="badge badge-planned" title="Scheduled for upcoming chapter batch">Queued</span>`;

            li.innerHTML = `
              <div class="topic-left">
                <input type="checkbox" id="chk-${topic.id}" ${checked ? 'checked' : ''} aria-label="Mark ${topic.title} complete">
                <label class="topic-name" for="chk-${topic.id}"><strong>${topic.num}.</strong> ${topic.title}</label>
              </div>
              <div class="topic-actions">${statusControl}</div>
            `;

            const chk = li.querySelector('input[type="checkbox"]');
            chk.addEventListener('change', e => {
              toggleTopicProgress(topic.id, e.target.checked);
              render();
            });
            ul.appendChild(li);
          });
        }
        container.appendChild(card);
      });
    }

    // Filter pills
    document.querySelectorAll('[data-tracker-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-tracker-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.getAttribute('data-tracker-filter');
        render();
      });
    });

    // Search box
    const searchInput = document.getElementById('topic-search');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        searchTerm = e.target.value.trim().toLowerCase();
        render();
      });
    }

    // Reset progress modal (no window.confirm)
    const resetBtn = document.getElementById('reset-progress-btn');
    const modal = document.getElementById('reset-modal');
    const cancelBtn = document.getElementById('cancel-reset-btn');
    const confirmBtn = document.getElementById('confirm-reset-btn');

    if (resetBtn && modal) {
      resetBtn.addEventListener('click', () => modal.classList.add('open'));
    }
    if (cancelBtn && modal) {
      cancelBtn.addEventListener('click', () => modal.classList.remove('open'));
    }
    if (confirmBtn && modal) {
      confirmBtn.addEventListener('click', () => {
        writeStore(STORAGE_KEYS.progress, {});
        modal.classList.remove('open');
        render();
        showToast('Syllabus progress reset to 0%.');
      });
    }

    render();
  }

  // Helper for future chapter note pages to mark themselves complete
  function initChapterCompletionButton(topicId, selector) {
    const btn = document.querySelector(selector || '[data-chapter-complete]');
    if (!btn || !topicId) return;

    function sync() {
      const done = !!getProgressMap()[topicId];
      btn.textContent = done ? 'Completed (Click to Undo)' : 'Mark Chapter Complete';
      btn.className = done ? 'btn btn-secondary' : 'btn btn-primary';
    }

    btn.addEventListener('click', () => {
      const done = !!getProgressMap()[topicId];
      toggleTopicProgress(topicId, !done);
      sync();
      showToast(!done ? 'Chapter marked complete on Dashboard!' : 'Chapter marked pending.');
    });
    sync();
  }

  // ========================================================================
  // 5. Reusable Objective MCQ Engine (5-Option, 1 & 2 Mark Mix, -0.25 Neg.)
  // ========================================================================
  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function initMCQEngine(config) {
    const mount = document.getElementById(config.mountId || 'mcq-engine-root');
    if (!mount || !Array.isArray(config.questions) || !config.questions.length) return;

    const negPenalty = typeof config.negativeMark === 'number' ? config.negativeMark : 0.25;
    const durationSec = (config.durationMinutes || 60) * 60;
    const letters = ['A', 'B', 'C', 'D', 'E'];

    // Dynamically shuffle options per question on every attempt
    const questions = config.questions.map((q, idx) => {
      const indexed = q.options.map((text, origIdx) => ({ text, isCorrect: origIdx === q.correctIndex }));
      const shuffled = config.shuffleOptions === false ? indexed : shuffleArray(indexed);
      return {
        index: idx,
        id: q.id || 'Q' + (idx + 1),
        marks: q.marks || 1,
        section: q.section || 'IT Objective',
        prompt: q.prompt,
        options: shuffled,
        correctIndex: shuffled.findIndex(o => o.isCorrect),
        explanation: q.explanation || ''
      };
    });

    const state = {
      current: 0,
      answers: {},       // qIndex -> selected option index
      marked: {},        // qIndex -> boolean
      visited: { 0: true },
      submitted: false,
      remainingSec: durationSec,
      timerId: null
    };

    function formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function startTimer() {
      if (state.timerId) clearInterval(state.timerId);
      state.timerId = setInterval(() => {
        if (state.submitted) {
          clearInterval(state.timerId);
          return;
        }
        state.remainingSec -= 1;
        const tEl = mount.querySelector('#mcq-timer');
        if (tEl) {
          tEl.textContent = formatTime(Math.max(0, state.remainingSec));
          tEl.classList.toggle('urgent', state.remainingSec <= 300);
        }
        if (state.remainingSec <= 0) {
          clearInterval(state.timerId);
          submitExam();
        }
      }, 1000);
    }

    function computeScore() {
      let obtained = 0, maxMarks = 0, correct = 0, wrong = 0, skipped = 0;
      questions.forEach((q, idx) => {
        maxMarks += q.marks;
        if (typeof state.answers[idx] !== 'number') {
          skipped += 1;
        } else if (state.answers[idx] === q.correctIndex) {
          correct += 1;
          obtained += q.marks;
        } else {
          wrong += 1;
          obtained -= negPenalty;
        }
      });
      return { obtained: Number(obtained.toFixed(2)), maxMarks, correct, wrong, skipped };
    }

    function submitExam() {
      state.submitted = true;
      if (state.timerId) clearInterval(state.timerId);
      render();
      showToast('Mock submitted! Review detailed explanations below.');
    }

    function render() {
      const q = questions[state.current];
      const chosen = state.answers[state.current];
      const score = state.submitted ? computeScore() : null;

      let summaryHtml = '';
      if (state.submitted && score) {
        const attempted = score.correct + score.wrong;
        const acc = attempted ? Math.round((score.correct / attempted) * 100) : 0;
        summaryHtml = `
          <div class="callout" style="margin-bottom:1rem;">
            <span class="callout-title">Scorecard: ${score.obtained} / ${score.maxMarks} Marks (${acc}% Accuracy)</span>
            Correct: <strong>${score.correct}</strong> &bull; Wrong: <strong>${score.wrong}</strong> (-${(score.wrong * negPenalty).toFixed(2)}) &bull; Skipped: <strong>${score.skipped}</strong>
          </div>
        `;
      }

      const optionsHtml = q.options.map((opt, idx) => {
        let cls = 'mcq-option';
        if (state.submitted) {
          if (idx === q.correctIndex) cls += ' correct';
          else if (idx === chosen) cls += ' wrong';
        } else if (idx === chosen) {
          cls += ' selected';
        }
        return `
          <label class="${cls}" data-opt="${idx}">
            <input type="radio" name="mcq-opt" value="${idx}" ${idx === chosen ? 'checked' : ''} ${state.submitted ? 'disabled' : ''}>
            <span><strong>(${letters[idx]})</strong> ${opt.text}</span>
          </label>
        `;
      }).join('');

      const paletteHtml = questions.map((_, idx) => {
        let cls = 'pal-btn';
        if (idx === state.current) cls += ' current';
        const isAns = typeof state.answers[idx] === 'number';
        const isMark = !!state.marked[idx];
        if (isAns && isMark) cls += ' answered-marked';
        else if (isAns) cls += ' answered';
        else if (isMark) cls += ' marked';
        return `<button type="button" class="${cls}" data-jump="${idx}">${idx + 1}</button>`;
      }).join('');

      mount.innerHTML = `
        ${summaryHtml}
        <div class="mcq-shell">
          <div class="card">
            <div class="card-header">
              <div>
                <span class="badge badge-info">${q.section}</span>
                <span class="badge badge-warn">${q.marks} Mark${q.marks > 1 ? 's' : ''} | -${negPenalty} Neg</span>
              </div>
              <div class="timer-display" id="mcq-timer">${formatTime(state.remainingSec)}</div>
            </div>
            <div style="font-size:1rem;font-weight:600;margin-bottom:0.75rem;">
              Q${state.current + 1} of ${questions.length}. ${q.prompt}
            </div>
            <div class="mcq-options">${optionsHtml}</div>
            ${state.submitted ? `<div class="callout callout-info"><span class="callout-title">Explanation (Correct: ${letters[q.correctIndex]})</span>${q.explanation}</div>` : ''}
            <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:0.5rem;margin-top:1rem;">
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm" id="mcq-prev" ${state.current === 0 ? 'disabled' : ''}>Previous</button>
                <button type="button" class="btn btn-secondary btn-sm" id="mcq-next" ${state.current === questions.length - 1 ? 'disabled' : ''}>Next</button>
                ${!state.submitted ? `<button type="button" class="btn btn-secondary btn-sm" id="mcq-mark">${state.marked[state.current] ? 'Unmark Review' : 'Mark for Review'}</button>` : ''}
                ${!state.submitted ? `<button type="button" class="btn btn-secondary btn-sm" id="mcq-clear">Clear Response</button>` : ''}
              </div>
              ${!state.submitted ? `<button type="button" class="btn btn-primary btn-sm" id="mcq-submit">Submit Test</button>` : `<button type="button" class="btn btn-primary btn-sm" id="mcq-retry">Re-Attempt (Shuffled)</button>`}
            </div>
          </div>
          <aside class="card">
            <h3 class="card-title" style="font-size:0.96rem;">Question Palette</h3>
            <div style="font-size:0.76rem;color:var(--text-subtle);margin-top:0.25rem;">Green: Answered &bull; Purple: Marked &bull; Amber: Both</div>
            <div class="palette-grid">${paletteHtml}</div>
          </aside>
        </div>
      `;

      // Bind listeners
      mount.querySelectorAll('.mcq-option').forEach(el => {
        el.addEventListener('click', () => {
          if (state.submitted) return;
          state.answers[state.current] = Number(el.getAttribute('data-opt'));
          render();
        });
      });

      mount.querySelectorAll('[data-jump]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.current = Number(btn.getAttribute('data-jump'));
          state.visited[state.current] = true;
          render();
        });
      });

      const prevBtn = mount.querySelector('#mcq-prev');
      const nextBtn = mount.querySelector('#mcq-next');
      const markBtn = mount.querySelector('#mcq-mark');
      const clearBtn = mount.querySelector('#mcq-clear');
      const subBtn = mount.querySelector('#mcq-submit');
      const retryBtn = mount.querySelector('#mcq-retry');

      if (prevBtn) prevBtn.addEventListener('click', () => { if (state.current > 0) { state.current--; render(); } });
      if (nextBtn) nextBtn.addEventListener('click', () => { if (state.current < questions.length - 1) { state.current++; render(); } });
      if (markBtn) markBtn.addEventListener('click', () => { state.marked[state.current] = !state.marked[state.current]; render(); });
      if (clearBtn) clearBtn.addEventListener('click', () => { delete state.answers[state.current]; render(); });
      if (subBtn) subBtn.addEventListener('click', submitExam);
      if (retryBtn) retryBtn.addEventListener('click', () => initMCQEngine(config));
    }

    render();
    startTimer();
  }

  // ========================================================================
  // 6. Descriptive Typing Simulator & AI-Evaluation Prompt Engine
  // ========================================================================
  function initDescriptiveLab(questions) {
    const listEl = document.getElementById('desc-question-list');
    const titleEl = document.getElementById('active-q-title');
    const metaEl = document.getElementById('active-q-meta');
    const promptEl = document.getElementById('active-q-prompt');
    const hintsEl = document.getElementById('active-q-hints');
    const textarea = document.getElementById('desc-textarea');
    const wordEl = document.getElementById('stat-words');
    const charEl = document.getElementById('stat-chars');
    const limitEl = document.getElementById('stat-limit-badge');
    const timerEl = document.getElementById('desc-timer');
    const durationSel = document.getElementById('desc-duration');
    const startPauseBtn = document.getElementById('timer-start-pause');
    const resetTimerBtn = document.getElementById('timer-reset');
    const spellToggle = document.getElementById('spellcheck-toggle');
    const copyEvalBtn = document.getElementById('copy-ai-eval-btn');
    const clearDraftBtn = document.getElementById('clear-draft-btn');

    if (!listEl || !textarea || !Array.isArray(questions) || !questions.length) return;

    let activePaperFilter = 'all';
    let currentQ = questions[0];
    let totalSec = 3600; // Default 60 min
    let remainingSec = 3600;
    let running = false;
    let timerId = null;

    function formatMMSS(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function countWords(text) {
      const trimmed = text.trim();
      return trimmed ? trimmed.split(/\s+/).length : 0;
    }

    function updateTimerUI() {
      if (!timerEl) return;
      timerEl.textContent = formatMMSS(remainingSec);
      timerEl.classList.toggle('urgent', remainingSec <= 300);
      if (startPauseBtn) {
        startPauseBtn.textContent = running ? 'Pause Timer' : (remainingSec < totalSec ? 'Resume Timer' : 'Start 60-Min Timer');
      }
    }

    function stopTimer() {
      running = false;
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      updateTimerUI();
    }

    function toggleTimer() {
      if (running) {
        stopTimer();
        return;
      }
      if (remainingSec <= 0) remainingSec = totalSec;
      running = true;
      updateTimerUI();
      timerId = setInterval(() => {
        remainingSec -= 1;
        updateTimerUI();
        if (remainingSec <= 0) {
          stopTimer();
          showToast('Time is up! Click "Copy for AI Evaluation" to grade your answer.');
        }
      }, 1000);
    }

    function resetTimer() {
      stopTimer();
      totalSec = (Number(durationSel ? durationSel.value : 60) || 60) * 60;
      remainingSec = totalSec;
      updateTimerUI();
    }

    function updateWordStats() {
      const text = textarea.value;
      const words = countWords(text);
      const chars = text.length;
      if (wordEl) wordEl.textContent = String(words);
      if (charEl) charEl.textContent = String(chars);

      if (limitEl && currentQ) {
        const minW = currentQ.minWords || 0;
        const maxW = currentQ.maxWords || 400;
        if (words === 0) {
          limitEl.className = 'badge badge-planned';
          limitEl.textContent = 'Target: ' + currentQ.wordLimitLabel;
        } else if (words < minW) {
          limitEl.className = 'badge badge-warn';
          limitEl.textContent = 'Under Target (' + currentQ.wordLimitLabel + ')';
        } else if (words <= maxW) {
          limitEl.className = 'badge badge-live';
          limitEl.textContent = 'Optimal Range (' + currentQ.wordLimitLabel + ')';
        } else {
          limitEl.className = 'badge badge-danger';
          limitEl.textContent = 'Over Limit (' + currentQ.wordLimitLabel + ')';
        }
      }

      // Persist draft
      const drafts = readStore(STORAGE_KEYS.descDrafts, {});
      drafts[currentQ.id] = text;
      writeStore(STORAGE_KEYS.descDrafts, drafts);
    }

    function selectQuestion(q) {
      currentQ = q;
      if (titleEl) titleEl.textContent = q.title;
      if (metaEl) {
        metaEl.innerHTML = `
          <span class="badge ${q.paper === 'paper2' ? 'badge-purple' : 'badge-info'}">${q.paperLabel}</span>
          <span class="badge badge-warn">${q.marks} Marks</span>
          <span class="badge badge-live">Word Limit: ${q.wordLimitLabel}</span>
          <span class="badge badge-planned">${q.category}</span>
        `;
      }
      if (promptEl) promptEl.innerHTML = q.promptHtml;
      if (hintsEl) {
        hintsEl.innerHTML = `
          <ul>${q.hints.map(h => `<li>${h}</li>`).join('')}</ul>
          ${q.sources && q.sources.length ? `<div style="margin-top:0.6rem;font-size:0.8rem;"><strong>Verified References:</strong> ${q.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label}</a>`).join(' &bull; ')}</div>` : ''}
        `;
      }

      const drafts = readStore(STORAGE_KEYS.descDrafts, {});
      textarea.value = drafts[q.id] || '';
      updateWordStats();
      renderQuestionList();
    }

    function renderQuestionList() {
      const drafts = readStore(STORAGE_KEYS.descDrafts, {});
      const filtered = questions.filter(q => activePaperFilter === 'all' || q.paper === activePaperFilter);
      listEl.innerHTML = '';

      filtered.forEach(q => {
        const hasDraft = drafts[q.id] && drafts[q.id].trim().length > 0;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'q-card-btn' + (q.id === currentQ.id ? ' active' : '');
        btn.innerHTML = `
          <div class="q-card-meta">
            <span class="badge ${q.paper === 'paper2' ? 'badge-purple' : 'badge-info'}">${q.paper === 'paper2' ? 'Paper II' : 'Paper III'}</span>
            <span class="badge badge-warn">${q.marks}M &bull; ${q.wordLimitLabel}</span>
          </div>
          <span class="q-card-title">${q.title}</span>
          ${hasDraft ? '<span style="font-size:0.74rem;color:var(--accent);font-weight:600;display:inline-block;margin-top:0.25rem;">Draft saved</span>' : ''}
        `;
        btn.addEventListener('click', () => selectQuestion(q));
        listEl.appendChild(btn);
      });
    }

    // Paper filter pills
    document.querySelectorAll('[data-paper-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-paper-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activePaperFilter = btn.getAttribute('data-paper-filter');
        renderQuestionList();
      });
    });

    // Spellcheck toggle (Exam Mode)
    if (spellToggle) {
      spellToggle.addEventListener('change', e => {
        const disabled = e.target.checked;
        textarea.setAttribute('spellcheck', disabled ? 'false' : 'true');
        textarea.setAttribute('autocorrect', disabled ? 'off' : 'on');
        textarea.setAttribute('autocapitalize', disabled ? 'off' : 'sentences');
        textarea.setAttribute('autocomplete', disabled ? 'off' : 'on');
        // Force browser refresh of spellcheck state
        const val = textarea.value;
        textarea.value = '';
        textarea.value = val;
        showToast(disabled ? 'Exam Mode ON: Browser spellcheck disabled.' : 'Browser spellcheck enabled.');
      });
    }

    if (durationSel) {
      durationSel.addEventListener('change', resetTimer);
    }
    if (startPauseBtn) startPauseBtn.addEventListener('click', toggleTimer);
    if (resetTimerBtn) resetTimerBtn.addEventListener('click', resetTimer);

    textarea.addEventListener('input', updateWordStats);

    if (clearDraftBtn) {
      clearDraftBtn.addEventListener('click', () => {
        textarea.value = '';
        updateWordStats();
        renderQuestionList();
        showToast('Draft cleared for this question.');
      });
    }

    // Copy for AI Evaluation
    if (copyEvalBtn) {
      copyEvalBtn.addEventListener('click', () => {
        const answer = textarea.value.trim();
        const words = countWords(answer);
        const elapsedSec = Math.max(0, totalSec - remainingSec);
        const timeTaken = formatMMSS(elapsedSec);

        const rubricPrompt = [
          '=== SIDBI GRADE A/B (IT STREAM) 2026 — DESCRIPTIVE AI EVALUATION REQUEST ===',
          '',
          '1. EXAM METADATA',
          `- Paper: ${currentQ.paperLabel}`,
          `- Category: ${currentQ.category}`,
          `- Maximum Marks: ${currentQ.marks} Marks`,
          `- Recommended Word Limit: ${currentQ.wordLimitLabel}`,
          '',
          '2. EXACT QUESTION',
          currentQ.plainPrompt,
          '',
          '3. CANDIDATE SUBMISSION METRICS',
          `- Word Count: ${words} words`,
          `- Time Taken: ${timeTaken} (mm:ss)`,
          `- Exam Mode (Spellcheck Disabled): ${spellToggle && spellToggle.checked ? 'Yes' : 'No'}`,
          '',
          '4. CANDIDATE TYPED ANSWER',
          answer || '[No answer typed yet — please evaluate this as a blank attempt and provide the 9/10 model answer.]',
          '',
          '5. STRICT SIDBI EXAMINER RUBRIC (INSTRUCTIONS FOR GEMINI)',
          `Act as a strict SIDBI Grade A/B (IT Stream) 2026 Descriptive Examiner. Grade my answer strictly out of ${currentQ.marks} marks with a clear breakdown across these 4 parameters:`,
          '  (a) Relevance & Technical Depth (accuracy of concepts, standards, architectures, or regulatory facts)',
          '  (b) Structure (clear Introduction, logical Body with headings/bullets, and actionable Conclusion)',
          '  (c) Banking / SIDBI / MSME Context (practical alignment with SIDBI, AIFIs, RBI, DPDP, CERT-In, or MSME digital lending)',
          '  (d) Conciseness, Grammar & Word-Limit Adherence',
          '',
          'Required Output Format:',
          `1. Final Score: X / ${currentQ.marks} with parameter-wise marks.`,
          '2. Exact Flaws & Missing High-Yield Points (bullet list of specific gaps, technical inaccuracies, or filler).',
          '3. Upgraded 9/10 Model Answer (strictly within the recommended word limit, structured for high exam scoring).'
        ].join('\n');

        copyText(rubricPrompt, 'Evaluation prompt copied! Paste it into Gemini for strict SIDBI grading.');
      });
    }

    updateTimerUI();
    selectQuestion(questions[0]);
  }

  // Auto-initialize shared components on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMobileNav();
    initTOCSpy();
    initCountdown('2026-12-27T09:00:00+05:30');
    initSyllabusTracker();
  });

  // Expose public API for chapter notes, mocks, and descriptive lab
  global.SIDBIPortal = {
    OFFICIAL_SYLLABUS,
    showToast,
    copyText,
    initCountdown,
    initSyllabusTracker,
    initChapterCompletionButton,
    initMCQEngine,
    initDescriptiveLab
  };
})(window);
