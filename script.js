(() => {
  'use strict';

  /* =========================================================
     1. Константи
     ========================================================= */
  const STORAGE_KEY_DONE = 'webcourse-done-topics';
  const CLS = {
    open: 'is-open',
    done: 'is-done',
    visible: 'is-visible',
    active: 'is-active',
    reached: 'is-reached',
    complete: 'is-complete',
    copied: 'is-copied',
  };
  const TIMING = {
    toast: 2400,
    typeChar: 38,
    typeLinePause: 420,
    terminalRestart: 3200,
    revealStagger: 70,
  };
  const CONFETTI_COLORS = ['#8b7cff', '#4fd1e8', '#ff7ab6', '#4ade9b', '#ffcf5c'];
  const RING_LENGTH = 326.73;     // 2πr, r = 52
  const TO_TOP_LENGTH = 131.95;   // 2πr, r = 21

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const storage = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* недоступно */ }
    },
  };

  /* =========================================================
     2. Спливне повідомлення і конфеті
     ========================================================= */
  const toast = $('#toast');
  let toastTimer;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add(CLS.visible);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove(CLS.visible), TIMING.toast);
  }

  const confettiLayer = $('#confetti');
  function burstConfetti(x, y, count = 40) {
    if (reduceMotion) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti__piece';
      const angle = Math.random() * Math.PI * 2;
      const power = 80 + Math.random() * 220;
      piece.style.left = `${x}px`;
      piece.style.top = `${y}px`;
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.setProperty('--dx', `${Math.cos(angle) * power}px`);
      piece.style.setProperty('--dy', `${Math.sin(angle) * power + 160}px`);
      piece.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
      piece.style.animationDelay = `${Math.random() * 80}ms`;
      if (i % 3 === 0) piece.style.borderRadius = '50%';
      frag.append(piece);
    }
    confettiLayer.append(frag);
    setTimeout(() => {
      [...confettiLayer.children].slice(0, count).forEach((p) => p.remove());
    }, 1500);
  }

  /* =========================================================
     3. Заголовок, що з'являється по словах
     ========================================================= */
  function splitWords(el) {
    let index = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); return; }
            const word = document.createElement('span');
            word.className = 'word';
            const inner = document.createElement('span');
            inner.className = 'word__inner';
            inner.style.setProperty('--i', index++);
            inner.textContent = part;
            word.append(inner);
            frag.append(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    walk(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-split')));
  }
  $$('[data-split]').forEach(splitWords);

  /* =========================================================
     4. Поява при прокрутці + лічильники
     ========================================================= */
  const reveals = $$('.reveal');
  // Каскадна затримка для тем в одному етапі
  $$('.accordion').forEach((acc) => {
    $$('.topic', acc).forEach((t, i) => t.style.setProperty('--reveal-delay', `${i * TIMING.revealStagger}ms`));
  });
  $$('.hero .reveal').forEach((el, i) => el.style.setProperty('--reveal-delay', `${300 + i * 120}ms`));

  function animateCount(el) {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reduceMotion || target === 0) { el.textContent = target + suffix; return; }
    const duration = 1200;
    const start = performance.now();
    const tick = (now) => {
      const p = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add(CLS.visible);
        $$('[data-count]', el).forEach(animateCount);
        io.unobserve(el);
        // Після появи прибираємо службовий клас, щоб повернути «рідні» переходи елемента
        const delay = parseFloat(getComputedStyle(el).getPropertyValue('--reveal-delay')) || 0;
        setTimeout(() => {
          el.classList.remove('reveal', CLS.visible);
          el.style.removeProperty('--reveal-delay');
        }, delay + 800);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add(CLS.visible));
    $$('[data-count]').forEach(animateCount);
  }

  /* =========================================================
     5. Термінал, що сам друкує команди
     ========================================================= */
  const terminal = $('#terminal');
  const TERMINAL_SCRIPT = [
    { type: 'cmd', text: 'git add .' },
    { type: 'cmd', text: 'git commit -m "update site"' },
    { type: 'out', text: '[main 1d5b9b0] update site\n 3 files changed, 248 insertions(+)' },
    { type: 'cmd', text: 'git push' },
    { type: 'out', text: 'To github.com/you/webcourse.git\n   a3f2c1e..1d5b9b0  main -> main' },
    { type: 'ok', text: '✓ Netlify: deploy published — сайт онлайн 🚀' },
  ];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function addPrompt() {
    const line = document.createElement('span');
    line.innerHTML = '<span class="t-prompt">➜</span> <span class="t-path">webcourse</span> ';
    terminal.append(line);
  }
  function addLine(text, cls) {
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = `${text}\n`;
    terminal.append(span);
  }

  async function runTerminal() {
    const caret = document.createElement('span');
    caret.className = 't-caret';
    while (true) {
      terminal.textContent = '';
      for (const step of TERMINAL_SCRIPT) {
        if (step.type === 'cmd') {
          addPrompt();
          const typed = document.createElement('span');
          terminal.append(typed, caret);
          for (const ch of step.text) {
            typed.textContent += ch;
            await wait(TIMING.typeChar + Math.random() * 40);
          }
          caret.remove();
          typed.textContent += '\n';
          await wait(TIMING.typeLinePause);
        } else {
          addLine(step.text, step.type === 'ok' ? 't-ok' : 't-out');
          await wait(TIMING.typeLinePause);
        }
      }
      addPrompt();
      terminal.append(caret);
      await wait(TIMING.terminalRestart);
    }
  }

  if (reduceMotion) {
    TERMINAL_SCRIPT.forEach((s) => {
      if (s.type === 'cmd') { addPrompt(); addLine(s.text); } else addLine(s.text, s.type === 'ok' ? 't-ok' : 't-out');
    });
  } else {
    runTerminal();
  }

  /* =========================================================
     6. Блоки коду: підсвітка синтаксису + кнопка «Копіювати»
     ========================================================= */
  const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const RULES = {
    html: [
      ['tok-com', /<!--[\s\S]*?-->/],
      ['tok-str', /"[^"]*"/],
      ['tok-tag', /<\/?[\w!?:-]+|\/?>|\?>/],
      ['tok-attr', /\b[\w:-]+(?==)/],
    ],
    css: [
      ['tok-com', /\/\*[\s\S]*?\*\//],
      ['tok-tag', /^[\w.:#-]+(?=\s*\{)/],
      ['tok-key', /[\w-]+(?=\s*:)/],
      ['tok-num', /#[0-9a-fA-F]{3,6}\b|\b\d+(?:px|%)?\b/],
    ],
    js: [
      ['tok-str', /"[^"]*"|'[^']*'|`[^`]*`/],
      ['tok-key', /\b(?:function|const|let|return|document)\b/],
      ['tok-attr', /\.\w+(?=\()/],
    ],
    bash: [
      ['tok-str', /"[^"]*"/],
      ['tok-key', /^git\b/],
      ['tok-attr', /\s--?[\w-]+/],
    ],
  };
  const LANG_MAP = { 'index.html': 'html', 'sitemap.xml': 'html', html: 'html', 'style.css': 'css', 'script.js': 'js', bash: 'bash' };

  function highlight(text, rules) {
    const combined = new RegExp(rules.map(([, re]) => `(${re.source})`).join('|'), 'gm');
    let out = '';
    let last = 0;
    let m;
    while ((m = combined.exec(text)) !== null) {
      if (m[0] === '') { combined.lastIndex++; continue; }
      const groupIndex = m.slice(1).findIndex((g) => g !== undefined);
      out += escapeHtml(text.slice(last, m.index));
      out += `<span class="${rules[groupIndex][0]}">${escapeHtml(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return out + escapeHtml(text.slice(last));
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }

  $$('pre.code').forEach((pre) => {
    const code = $('code', pre);
    const raw = code.textContent;
    const lang = pre.dataset.lang || '';
    const rules = RULES[LANG_MAP[lang]];
    if (rules) {
      try { code.innerHTML = highlight(raw, rules); } catch { /* залишаємо без підсвітки */ }
    }

    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    const bar = document.createElement('div');
    bar.className = 'code-wrap__bar';
    bar.innerHTML = `<span>${escapeHtml(lang)}</span>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = '⧉ Копіювати';
    bar.append(btn);
    pre.before(wrap);
    wrap.append(bar, pre);

    btn.addEventListener('click', async () => {
      try {
        await copyText(raw.trim());
        btn.textContent = '✓ Скопійовано';
        btn.classList.add(CLS.copied);
        showToast('Код скопійовано в буфер обміну');
      } catch {
        showToast('Не вдалося скопіювати');
      }
      setTimeout(() => {
        btn.textContent = '⧉ Копіювати';
        btn.classList.remove(CLS.copied);
      }, 1800);
    });
  });

  /* =========================================================
     7. Акордеон
     ========================================================= */
  const topics = $$('.topic');
  const toggleAllBtn = $('#toggleAll');

  topics.forEach((topic, idx) => {
    const header = $('.topic__header', topic);
    const body = $('.topic__body', topic);
    const inner = $('.topic__inner', topic);
    body.id = `topic-body-${idx}`;
    header.setAttribute('aria-controls', body.id);

    // Кнопка «Виконано»
    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'done-btn';
    doneBtn.innerHTML = '<span class="done-btn__box" aria-hidden="true"></span><span class="done-btn__label">Позначити як виконане</span>';
    inner.append(doneBtn);

    // Порядковий номер для каскадної появи вмісту
    [...inner.children].forEach((child, i) => child.style.setProperty('--i', i));

    header.addEventListener('click', (e) => {
      addRipple(header, e);
      setTopic(topic, !topic.classList.contains(CLS.open));
      updateToggleAll();
    });

    doneBtn.addEventListener('click', (e) => toggleDone(topic, e));
  });

  function setTopic(topic, open) {
    topic.classList.toggle(CLS.open, open);
    $('.topic__header', topic).setAttribute('aria-expanded', String(open));
  }

  function updateToggleAll() {
    const allOpen = topics.every((t) => t.classList.contains(CLS.open));
    toggleAllBtn.textContent = allOpen ? 'Згорнути все' : 'Розгорнути все';
    toggleAllBtn.setAttribute('aria-pressed', String(allOpen));
  }

  toggleAllBtn.addEventListener('click', () => {
    const open = !topics.every((t) => t.classList.contains(CLS.open));
    topics.forEach((t, i) => {
      if (reduceMotion) setTopic(t, open);
      else setTimeout(() => setTopic(t, open), i * 25);
    });
    setTimeout(updateToggleAll, topics.length * 25);
  });

  function addRipple(el, e) {
    if (reduceMotion) return;
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.left = `${(e.clientX || rect.left + rect.width / 2) - rect.left}px`;
    ripple.style.top = `${(e.clientY || rect.top + rect.height / 2) - rect.top}px`;
    el.append(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  // Перехід на етап відкриває його першу тему
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', () => {
      const target = $(link.getAttribute('href'));
      const first = target && $('.topic', target);
      if (first && !first.classList.contains(CLS.open)) {
        setTimeout(() => { setTopic(first, true); updateToggleAll(); }, 450);
      }
    });
  });

  /* =========================================================
     8. Прогрес навчання
     ========================================================= */
  const doneSet = new Set(storage.get(STORAGE_KEY_DONE, []));
  const ring = $('#ringValue');
  const percentEl = $('#progressPercent');
  const pill = $('#progressPill');
  const pillText = $('#progressPillText');
  const finish = $('#finish');

  function renderProgress(animatePill = false) {
    const total = topics.length;
    let done = 0;
    topics.forEach((t) => {
      const isDone = doneSet.has(t.dataset.id);
      t.classList.toggle(CLS.done, isDone);
      $('.done-btn__label', t).textContent = isDone ? 'Виконано' : 'Позначити як виконане';
      if (isDone) done++;
    });
    $$('.stage').forEach((stage) => {
      const list = $$('.topic', stage);
      stage.classList.toggle(CLS.complete, list.length > 0 && list.every((t) => t.classList.contains(CLS.done)));
    });
    const ratio = total ? done / total : 0;
    ring.style.strokeDashoffset = String(RING_LENGTH * (1 - ratio));
    percentEl.textContent = `${Math.round(ratio * 100)}%`;
    pillText.textContent = `${done}/${total}`;
    if (animatePill) {
      pill.classList.remove('is-bump');
      void pill.offsetWidth;
      pill.classList.add('is-bump');
    }
    finish.classList.toggle('is-celebrated', done === total);
    return done === total;
  }

  function toggleDone(topic, e) {
    const id = topic.dataset.id;
    const nowDone = !doneSet.has(id);
    if (nowDone) doneSet.add(id); else doneSet.delete(id);
    storage.set(STORAGE_KEY_DONE, [...doneSet]);
    const allDone = renderProgress(true);

    if (nowDone) {
      burstConfetti(e.clientX, e.clientY, 18);
      if (allDone) {
        setTimeout(() => burstConfetti(window.innerWidth / 2, window.innerHeight / 3, 120), 200);
        showToast('🎉 Усі теми пройдено! Твій сайт готовий до світу');
      } else {
        // Згортаємо виконану тему й відкриваємо наступну
        const next = topics[topics.indexOf(topic) + 1];
        setTimeout(() => {
          setTopic(topic, false);
          if (next && !next.classList.contains(CLS.done)) setTopic(next, true);
          updateToggleAll();
        }, 500);
      }
    }
  }
  renderProgress();

  /* =========================================================
     9. Прокрутка: шапка, смуга прогресу, таймлайн, «Нагору»
     ========================================================= */
  const header = $('.header');
  const scrollBar = $('#scrollProgress');
  const journey = $('#journey');
  const journeyFill = $('#journeyFill');
  const stages = $$('.stage');
  const navLinks = $$('.nav__link');
  const toTop = $('#toTop');
  const toTopRing = $('#toTopRing');
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const pageProgress = max > 0 ? y / max : 0;

    header.classList.toggle('is-scrolled', y > 10);
    scrollBar.style.setProperty('--progress', pageProgress.toFixed(4));
    toTop.classList.toggle(CLS.visible, y > 500);
    toTopRing.style.strokeDashoffset = String(TO_TOP_LENGTH * (1 - pageProgress));

    const jRect = journey.getBoundingClientRect();
    const fill = clamp((vh * 0.55 - jRect.top) / jRect.height, 0, 1);
    journeyFill.style.setProperty('--fill', fill.toFixed(4));

    let currentId = '';
    stages.forEach((stage) => {
      const top = $('.stage__node', stage).getBoundingClientRect().top;
      const reached = top < vh * 0.55;
      stage.classList.toggle(CLS.reached, reached);
      if (reached) currentId = stage.id;
    });
    navLinks.forEach((l) => l.classList.toggle(CLS.active, l.getAttribute('href') === `#${currentId}`));

    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  /* =========================================================
     10. Мобільне меню
     ========================================================= */
  const burger = $('#burger');
  const nav = $('#nav');
  function setMenu(open) {
    nav.classList.toggle(CLS.open, open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
  }
  burger.addEventListener('click', () => setMenu(!nav.classList.contains(CLS.open)));
  navLinks.forEach((l) => l.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !burger.contains(e.target)) setMenu(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* =========================================================
     11. Ефекти для миші: підсвітка, нахил, «магніт»
     ========================================================= */
  if (finePointer && !reduceMotion) {
    $$('.topic, .terminal, .progress-card, .finish').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });

    $$('.tilt').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `rotateY(${px * 10}deg) rotateX(${-py * 10}deg)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });

    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.25}px, ${dy * 0.35}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* =========================================================
     12. Демо з кроку 3.4
     ========================================================= */
  $('#helloBtn').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    burstConfetti(r.left + r.width / 2, r.top + r.height / 2, 60);
    showToast('Вітаю! Ви створили свій перший сайт 🚀');
  });

  $('#year').textContent = new Date().getFullYear();
})();
