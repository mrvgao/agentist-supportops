// Parallight lecture runtime — deck nav + academic chrome + logo loader +
// quiz/fill widget hydration (AI-graded fill). The selection layer, highlights,
// notes and the AI assistant live in the separate pl-annotations.js +
// pl-assistant.js modules (injected by the /learn route); this file is
// intentionally limited to nav/chrome/logos/quizzes so each has one job.

const NEXT_KEYS = new Set(['ArrowDown', ' ', 'PageDown']);
const PREV_KEYS = new Set(['ArrowUp', 'PageUp']);

// Pure: current slide index + key + count → index to move to (clamped). Unit-tested.
export function nextIndex(cur, key, total) {
  if (NEXT_KEYS.has(key)) return Math.min(cur + 1, total - 1);
  if (PREV_KEYS.has(key)) return Math.max(cur - 1, 0);
  return cur;
}

// tiny DOM builder (no innerHTML; text via textNodes)
function el(tag, opts, ...kids) {
  const e = document.createElement(tag);
  if (opts) for (const k in opts) { if (k === 'class') e.className = opts[k]; else e.setAttribute(k, opts[k]); }
  for (const c of kids) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}

// ---------- helpers ----------
const LEC = () => document.documentElement.getAttribute('data-pl-lecture') || '';
// The deck language is driven by the cover EN/CN toggle (html.lang-en / .lang-zh),
// default English. Falls back to <html lang> for non-deck contexts.
const LANG = () => (document.documentElement.classList.contains('lang-zh') ? 'zh'
  : document.documentElement.classList.contains('lang-en') ? 'en'
  : (document.documentElement.lang || 'en').startsWith('zh') ? 'zh' : 'en');
// Pick the active-language half of an `English ||| 中文` string (for attribute text).
const pickLang = (text) => {
  const t = String(text == null ? '' : text);
  const i = t.indexOf('|||');
  if (i < 0) return t;
  return LANG() === 'zh' ? t.slice(i + 3).trim() : t.slice(0, i).trim();
};
// UI string by current language (for dynamic/transient runtime text).
const t = (en, zh) => (LANG() === 'zh' ? zh : en);
const slidesArr = () => [...document.querySelectorAll('.slide')];
// Build a node for chrome text: bilingual `EN ||| 中文` → two data-lang spans
// (so the toggle switches it live), else a plain text node.
function biNode(text) {
  const t = String(text == null ? '' : text);
  const i = t.indexOf('|||');
  if (i < 0) return document.createTextNode(t);
  const f = document.createDocumentFragment();
  f.appendChild(el('span', { 'data-lang': 'en' }, t.slice(0, i).trim()));
  f.appendChild(el('span', { 'data-lang': 'zh' }, t.slice(i + 3).trim()));
  return f;
}
// The app is served under basePath '/lab'; raw fetch is not auto-prefixed.
function courseApi(path, opts) { return fetch('/lab/api/course' + path, { credentials: 'same-origin', ...(opts || {}) }); }
function jpost(path, body) {
  return courseApi(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

// ---------- academic chrome (header/footer/frame) ----------
function injectChrome(slides) {
  const ds = document.documentElement.dataset;
  const course = ds.plCourse || 'PARALLIGHT';
  const lno = ds.plLectureNo ? ('Lecture ' + ds.plLectureNo) : '';
  const title = ds.plTitle || '';
  const total = slides.length;
  slides.forEach((slide, i) => {
    if (slide.querySelector(':scope > .frame')) return;
    const inner = slide.querySelector('.slide-inner');
    if (!inner) return;
    const shead = el('div', { class: 'shead' },
      el('span', { class: 'pl-brand' }, el('span', { class: 'pl-dot' }), course),
      el('span', { class: 'pl-act' }, biNode(slide.getAttribute('data-act') || '')),
      el('span', { class: 'pl-lno' }, lno),
    );
    const sfoot = el('div', { class: 'sfoot' },
      el('span', {}, biNode(title)),
      el('span', { class: 'pl-pg' }, (i + 1) + ' / ' + total),
    );
    const frame = el('div', { class: 'frame' });
    slide.insertBefore(frame, inner);
    frame.append(shead, inner, sfoot);
  });
}

// ---------- real brand logos (Simple Icons; monogram fallback) ----------
function loadLogos() {
  document.querySelectorAll('.logo[data-slug]').forEach((node) => {
    const slug = node.getAttribute('data-slug');
    const mk = node.querySelector('.mk');
    if (!slug || !mk) return;
    const probe = new Image();
    probe.onload = () => {
      mk.replaceChildren();
      mk.style.background = '#fff'; mk.style.border = '1px solid var(--rule)';
      const img = document.createElement('img'); img.src = probe.src; img.alt = ''; mk.appendChild(img);
    };
    probe.src = 'https://cdn.simpleicons.org/' + slug;
  });
}

// Move a clone of an element's children into a fragment (preserves bilingual
// <span data-lang> markup so the language toggle works on widget text too).
function cloneChildren(src) {
  const f = document.createDocumentFragment();
  src.childNodes.forEach((n) => f.appendChild(n.cloneNode(true)));
  return f;
}

// ---------- widget hydration: <pl-quiz> (MCQ, client + local persist), <pl-fill> (AI-graded) ----------
const KEY_LETTERS = 'ABCDEFGH';
function hydrateWidgets() {
  document.querySelectorAll('pl-quiz').forEach((q, qi) => {
    const id = q.getAttribute('id') || ('q' + qi);
    const answer = (q.getAttribute('answer') || '0').split(',').map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
    const multi = q.hasAttribute('multi');
    const tag = q.getAttribute('tag') || '选择题 · 即时判分';
    const plq = q.querySelector('pl-q');
    const opts = [...q.querySelectorAll('pl-opt')];
    const lsKey = 'plq:' + LEC() + ':' + id;
    const qDiv = el('div', { class: 'pl-q' });
    if (plq) qDiv.appendChild(cloneChildren(plq));
    const card = el('div', { class: 'pl-card' }, el('div', { class: 'pl-tag' }, biNode(tag)), qDiv);
    const fb = el('div', { class: 'pl-feedback' });
    opts.forEach((o, i) => {
      const otxt = el('span', {}); otxt.appendChild(cloneChildren(o));
      const row = el('div', { class: 'opt' }, el('span', { class: 'key' }, KEY_LETTERS[i] || '?'), otxt);
      row.onclick = () => {
        const ok = answer.includes(i);
        if (multi) {
          row.classList.add(ok ? 'correct' : 'wrong');
          fb.className = 'pl-feedback show' + (ok ? ' ok' : '');
        } else {
          card.querySelectorAll('.opt').forEach((x) => x.classList.remove('correct', 'wrong'));
          if (ok) { row.classList.add('correct'); fb.className = 'pl-feedback show ok'; }
          else { row.classList.add('wrong'); const corr = card.querySelectorAll('.opt')[answer[0]]; if (corr) corr.classList.add('correct'); fb.className = 'pl-feedback show'; }
          try { localStorage.setItem(lsKey, String(i)); } catch (_) { /* ignore */ }
          // Persist to server so the teacher can see it; localStorage stays as offline fallback.
          void fetch('/lab/api/course/quiz-answer', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ lecture_id: LEC(), widget_id: id, response: String(i), is_correct: ok }),
          }).catch(() => { /* unauthenticated or offline — UI still works */ });
        }
        fb.textContent = pickLang(o.getAttribute('exp') || '');
      };
      card.appendChild(row);
    });
    card.appendChild(fb);
    q.replaceWith(card);
    if (!multi) { try { const s = localStorage.getItem(lsKey); if (s != null) { const r = card.querySelectorAll('.opt')[+s]; if (r) r.click(); } } catch (_) { /* ignore */ } }
  });

  document.querySelectorAll('pl-fill').forEach((f, fi) => {
    const id = f.getAttribute('id') || ('f' + fi);
    const question = pickLang(f.getAttribute('question') || '');
    const qDiv = el('div', { class: 'q' });
    if (f.childNodes.length) qDiv.appendChild(cloneChildren(f)); else qDiv.textContent = question;
    const card = el('div', { class: 'pl-fill' });
    card.setAttribute('data-wid', id);
    card.append(
      el('div', { class: 'pl-tag', style: 'font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent-ink);margin-bottom:9px' }, biNode('Fill-in · AI-graded ||| 填空 · AI 判题')),
      qDiv,
    );
    const input = el('input', { type: 'text' });
    const setPh = () => { input.placeholder = t('Type your answer…', '输入你的答案…'); };
    setPh(); window.addEventListener('pl-lang', setPh);
    const btn = document.createElement('button'); btn.className = 'btn btn-primary'; btn.appendChild(biNode('AI check ||| 智能判断'));
    const v = el('div', { class: 'pl-verdict' });
    card.append(el('div', { class: 'row' }, input, btn), v);
    btn.onclick = async () => {
      const resp = input.value.trim(); if (!resp) { input.focus(); return; }
      v.className = 'pl-verdict show';
      v.replaceChildren(el('div', { class: 'who' }, t('✦ AI grading', '✦ AI 判题中'), el('span', { class: 'pl-thinking' }, el('i'), el('i'), el('i'))));
      try {
        const gbody = { lecture_id: LEC(), widget_id: id, response: resp, question: pickLang(f.getAttribute('question') || ''), lang: LANG() };
        // Studio preview sets PL_GRADE_URL so authors can test grading against the
        // in-progress draft rubric before publishing; learners never have it set.
        const r = window.PL_GRADE_URL
          ? await fetch(window.PL_GRADE_URL, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(gbody) })
          : await jpost('/grade', gbody);
        const j = await r.json();
        if (j.error) { v.className = 'pl-verdict show'; v.textContent = t('Grading failed: ', '判题失败：') + j.error; return; }
        v.className = 'pl-verdict show' + (j.correct ? ' ok' : '');
        v.replaceChildren(el('div', { class: 'who' }, t('✦ AI verdict', '✦ AI 判题')), el('div', {}, (j.correct ? '✓ ' : '') + (j.feedback || '')));
      } catch (_) { v.className = 'pl-verdict show'; v.textContent = t('Network error', '网络错误'); }
    };
    f.replaceWith(card);
  });
}

async function restoreResponses() {
  try {
    const r = await courseApi('/responses?lecture=' + encodeURIComponent(LEC()));
    if (!r.ok) return;
    const j = await r.json();
    (j.items || []).forEach((it) => {
      const card = document.querySelector('.pl-fill[data-wid="' + (window.CSS && CSS.escape ? CSS.escape(it.widget_id) : it.widget_id) + '"]');
      if (!card) return;
      const input = card.querySelector('input'); if (input && it.response) input.value = it.response;
      const v = card.querySelector('.pl-verdict');
      if (v && it.ai_feedback) {
        v.className = 'pl-verdict show' + (it.is_correct ? ' ok' : '');
        v.replaceChildren(el('div', { class: 'who' }, t('✦ AI verdict', '✦ AI 判题')), el('div', {}, (it.is_correct ? '✓ ' : '') + it.ai_feedback));
      }
    });
  } catch (_) { /* ignore */ }
}

// ---------- generic deck interactions (reveal panels, steppers, reflection) ----------
function hydrateInteractions() {
  document.querySelectorAll('[data-reveal]').forEach((b) => {
    b.addEventListener('click', () => { const t = document.getElementById(b.getAttribute('data-reveal')); if (t) t.classList.add('show'); });
  });
  document.querySelectorAll('[data-step]').forEach((b) => {
    b.addEventListener('click', () => { const box = document.getElementById(b.getAttribute('data-step')); if (!box) return; const n = box.querySelector('.step:not(.show)'); if (n) n.classList.add('show'); });
  });
  document.querySelectorAll('[data-step-reset]').forEach((b) => {
    b.addEventListener('click', () => { const box = document.getElementById(b.getAttribute('data-step-reset')); if (!box) return; box.querySelectorAll('.step').forEach((s) => s.classList.remove('show')); });
  });
}

function toast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function hydrateReflections() {
  document.querySelectorAll('[data-reflect-save]').forEach((btn) => {
    const id = btn.getAttribute('data-reflect-save');
    const ta = document.getElementById(id); if (!ta) return;
    const lsKey = 'plr:' + LEC() + ':' + id;
    // Placeholder may be multi-line bilingual (EN ||| 中文 per line) — localize each line.
    const ph0 = ta.getAttribute('placeholder') || '';
    const setPh = () => { ta.placeholder = ph0.split('\n').map(pickLang).join('\n'); };
    setPh(); window.addEventListener('pl-lang', setPh);
    try { const v = localStorage.getItem(lsKey); if (v != null) ta.value = v; } catch (_) { /* ignore */ }
    btn.addEventListener('click', () => {
      const content = ta.value;
      try { localStorage.setItem(lsKey, content); } catch (_) { /* ignore */ }
      // Persist to server so the teacher can see it; localStorage stays as offline/draft fallback.
      void fetch('/lab/api/course/reflection', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lecture_id: LEC(), widget_id: id, content }),
      }).catch(() => { /* offline or unauthenticated — localStorage still has it */ });
      toast(t('Saved — visible to your teacher', '已保存,老师可见'));
    });
  });
}

// ---------- language (EN default; CN toggle on the cover) ----------
function applyLang(l) {
  const zh = l === 'zh';
  const root = document.documentElement;
  root.classList.toggle('lang-zh', zh);
  root.classList.toggle('lang-en', !zh);
  root.lang = zh ? 'zh-CN' : 'en';
  document.querySelectorAll('.pl-lang-btn').forEach((b) => b.classList.toggle('on', b.getAttribute('data-l') === l));
  try { localStorage.setItem('pl-lang', l); } catch (_) { /* ignore */ }
  window.dispatchEvent(new Event('pl-lang')); // let JS widgets / dynamic UI re-render
}
function setupLang() {
  let init = 'en';
  try { init = localStorage.getItem('pl-lang') || 'en'; } catch (_) { /* ignore */ }
  applyLang(init === 'zh' ? 'zh' : 'en'); // set class before widgets hydrate (exp/question pick by lang)
  // Prefer the marked cover, fall back to the first slide so every lecture
  // gets the actions row (cover is opt-in via `<!-- cover -->` in source md).
  const cover = document.querySelector('.slide.cover .slide-inner')
    || document.querySelector('.slide:first-of-type .slide-inner');
  if (cover && !cover.querySelector('.pl-cover-actions')) {
    const enB = el('button', { class: 'pl-lang-btn', 'data-l': 'en' }, 'EN');
    const zhB = el('button', { class: 'pl-lang-btn', 'data-l': 'zh' }, '中文');
    enB.onclick = () => applyLang('en');
    zhB.onclick = () => applyLang('zh');
    const langGroup = el('div', { class: 'pl-lang' }, enB, zhB);
    // Print → Save as PDF; @media print in pl-runtime.css flattens the deck into one slide per page.
    const pdfBtn = el('button', { class: 'pl-pdf-btn', type: 'button' });
    pdfBtn.append(document.createTextNode('↓ '), biNode('Download PDF ||| 下载 PDF'));
    pdfBtn.addEventListener('click', downloadAsPdf);
    cover.insertBefore(el('div', { class: 'pl-cover-actions' }, pdfBtn, langGroup), cover.firstChild);
    applyLang(document.documentElement.classList.contains('lang-zh') ? 'zh' : 'en'); // sync button .on state
  }
}

// Rename document.title so Chrome uses the lecture title as the default PDF
// filename (read at print-dialog open), then restore on afterprint.
function downloadAsPdf() {
  const original = document.title;
  const lectureTitle = pickLang(document.documentElement.dataset.plTitle || '').trim();
  if (lectureTitle) document.title = lectureTitle;
  const restore = () => { document.title = original; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  window.print();
}

// ---------- deck nav + boot ----------
function boot() {
  const deck = document.getElementById('deck');
  const slides = slidesArr();
  if (!deck || slides.length === 0) return;

  setupLang();
  hydrateWidgets();
  hydrateInteractions();
  hydrateReflections();
  injectChrome(slides);
  loadLogos();
  if (LEC()) restoreResponses();

  let cur = 0;
  const curEl = document.getElementById('curN');
  const totEl = document.getElementById('totN');
  if (totEl) totEl.textContent = String(slides.length);

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      cur = slides.indexOf(e.target);
      if (curEl) curEl.textContent = String(cur + 1);
    }
  }, { threshold: 0.55 });
  slides.forEach((s) => io.observe(s));

  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLElement && e.target.matches('input,textarea')) return;
    const to = nextIndex(cur, e.key, slides.length);
    if (to !== cur) { e.preventDefault(); slides[to].scrollIntoView(); }
  });

  // Floating "返回主页" button, top-left — mirrors the 全屏 button (top-right) and
  // stays pinned while scrolling. Lets learners jump back to the course menu
  // (Learning Center) instead of closing the deck tab to re-enter. Top-level
  // only, so it never shows inside the Studio preview iframe. (Teacher feedback.)
  if (window.top === window.self && !document.querySelector('.topbar-left')) {
    const homeBtn = el('a', { class: 'iconbtn', href: '/lab/home?view=learning' });
    homeBtn.append(document.createTextNode('← '), biNode('Home ||| 返回主页'));
    document.body.appendChild(el('div', { class: 'topbar-left' }, homeBtn));
  }

  const fsBtn = document.getElementById('fsBtn');
  fsBtn?.addEventListener('click', () => {
    if (!document.fullscreenElement) deck.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  // In fullscreen, uniformly scale each 16:9 slide (design 1080×607.5) to fit the
  // screen — preserving the exact windowed layout instead of reflowing content.
  function fitFullscreen() {
    if (document.fullscreenElement === deck) {
      const k = Math.min(window.innerWidth / 1080, window.innerHeight / 607.5);
      deck.style.setProperty('--fs-scale', String(k));
      deck.classList.add('fs');
    } else {
      deck.classList.remove('fs');
      deck.style.removeProperty('--fs-scale');
    }
  }
  document.addEventListener('fullscreenchange', fitFullscreen);
  document.addEventListener('webkitfullscreenchange', fitFullscreen);
  addEventListener('resize', fitFullscreen);
}

if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
}
