(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
};
let users = store.get('kk_users', {}), session = store.get('kk_session', null);
const settings = { diff: 'Easy', dur: 30, mode: 'timed', pmin: 30 };
let current = null, authMode = 'signin', typedTimer = null, forgotKey = null;

const user = () => session && users[session];
const scoresKey = () => 'kk_scores_' + session;
const scores = () => store.get(scoresKey(), []);
const best = () => scores().filter(s => !s.practice).reduce((m, s) => Math.max(m, s.wpm), 0);
const fmt = s => { s = Math.max(0, Math.floor(s)); const h = s / 3600 | 0, m = (s % 3600) / 60 | 0; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------- views ---------- */
function go(name) {
  if (!session && name !== 'landing') { openModal('signin'); return; }
  if (name !== 'test') stopTest();
  closeSidebar();
  const next = $('#view-' + name), prev = current && $('#view-' + current);
  const show = () => {
    current = name; next.hidden = false;
    render(name);
    requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add('active')));
    $$('.nav-link').forEach(b => b.classList.toggle('current', b.dataset.view === name));
    window.scrollTo(0, 0);
  };
  if (prev && prev !== next) {
    prev.classList.remove('active');
    setTimeout(() => { prev.hidden = true; show(); }, 200);
  } else if (!prev) show();
}
function render(name) {
  ({ landing: renderLanding, dashboard: renderDash, practice: renderPractice, guide: () => {}, test: resetTest, streak: renderStreak, profile: renderProfile }[name] || (() => {}))();
}

/* ---------- chrome / landing ---------- */
function updateChrome() {
  const u = user(), av = $('#sideAvatar');
  $('#sideName').textContent = u ? u.name : 'Guest';
  setAvatar(av, u);
}
function setAvatar(el, u) {
  if (u && u.avatar) { el.style.backgroundImage = `url(${u.avatar})`; el.textContent = ''; }
  else { el.style.backgroundImage = ''; el.textContent = u ? u.name[0].toUpperCase() : '?'; }
}
function renderLanding() {
  const u = user();
  $('#guestActions').hidden = $('#heroSub').hidden = !!u;
  $('#userActions').hidden = $('#heroGreeting').hidden = !u;
  if (u) $('#heroGreeting').textContent = `Welcome back, ${u.name}!`;
  const el = $('#typed'), txt = 'Welcome to KwikKeys'; let i = 0;
  clearInterval(typedTimer); el.textContent = '';
  typedTimer = setInterval(() => { el.textContent = txt.slice(0, ++i); if (i >= txt.length) clearInterval(typedTimer); }, 70);
}

/* ---------- sidebar ---------- */
function toggleSidebar(open) {
  const o = open ?? !$('#sidebar').classList.contains('open');
  $('#sidebar').classList.toggle('open', o); $('#scrim').classList.toggle('on', o);
  $('#menuBtn').setAttribute('aria-expanded', o);
}
const closeSidebar = () => toggleSidebar(false);

/* ---------- auth ---------- */
function openModal(mode) {
  authMode = mode;
  const si = mode === 'signin', su = mode === 'signup', fo = mode === 'forgot';
  $('#modalTitle').textContent = si ? 'Sign In' : su ? 'Sign Up' : 'Reset Password';
  $('#authSubmit').textContent = si ? 'Sign In' : su ? 'Create Account' : 'Reset Password';
  $('#passLabel').textContent = fo ? 'New password' : 'Password';
  $('#authHint').hidden = !fo; $('#authHint').textContent = 'Enter your username and choose a new password.';
  $('#switchText').textContent = si ? 'New here?' : su ? 'Already have an account?' : '';
  $('#switchMode').textContent = si ? 'Sign Up' : fo ? 'Back to Sign In' : 'Sign In';
  $('#forgotLink').parentElement.hidden = !si;
  $('#authErr').textContent = $('#authMsg').textContent = ''; $('#authForm').reset();
  $('#modal').hidden = false; closeSidebar(); $('#authUser').focus();
}
const closeModal = () => { $('#modal').hidden = true; };
function submitAuth(e) {
  e.preventDefault();
  const name = $('#authUser').value.trim(), pass = $('#authPass').value, key = name.toLowerCase(), err = $('#authErr');
  err.textContent = '';
  if (authMode === 'forgot') {
    if (!users[key]) return err.textContent = 'No account found with that username.';
    users[key].pass = pass;
    if (!store.set('kk_users', users)) return err.textContent = 'Could not save your new password. Check browser storage.';
    openModal('signin'); $('#authMsg').textContent = 'Password updated. Sign in with your new password.'; return;
  }
  if (authMode === 'signup') {
    if (users[key]) return err.textContent = 'That username is taken. Try another or sign in.';
    users[key] = { name, pass, joined: Date.now(), avatar: '' };
    if (!store.set('kk_users', users)) return err.textContent = 'Could not save your account. Check browser storage.';
  } else if (!users[key] || users[key].pass !== pass) return err.textContent = 'Username or password is incorrect.';
  session = key; store.set('kk_session', key);
  closeModal(); updateChrome(); go('dashboard');
}
function signOut() {
  stopTest(); session = null; localStorage.removeItem('kk_session');
  closeSidebar(); updateChrome();
  const cur = current && $('#view-' + current);
  if (current === 'landing') renderLanding(); else go('landing');
}

/* ---------- dashboard ---------- */
function renderDash() {
  $('#dashHello').textContent = `Welcome, ${user().name}`;
  $$('[data-diff]').forEach(b => b.setAttribute('aria-pressed', b.dataset.diff === settings.diff));
  $$('[data-dur]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.dur === settings.dur));
  const b = best(), target = Math.max(30, Math.ceil((b + 5) / 5) * 5);
  $('#targetWpm').textContent = target;
  $('#targetFill').style.width = Math.min(100, b / target * 100) + '%';
  $('#targetNote').textContent = b ? `Your best is ${b} WPM.` : 'Take a test to set your best.';
  const n = todayCount();
  $('#goalNum').textContent = `${Math.min(n, 3)} / 3`;
  $('#goalFill').style.width = Math.min(100, n / 3 * 100) + '%';
}
const todayCount = () => scores().filter(s => new Date(s.ts).toDateString() === new Date().toDateString()).length;

/* ---------- guided practice and heart rewards ---------- */
const PRACTICE_EXERCISES = {
  Beginner: [
    { title: 'Home-row warm-up', text: 'asdf jkl; asdf jkl; fj fj dk dk sl sl', tip: 'Rest your left fingers on A, S, D, F and your right fingers on J, K, L, ;.' },
    { title: 'Easy words', text: 'sad ask fall dad flask all add', tip: 'Keep your fingers close to the home row and return after reaching for a key.' },
    { title: 'Short sentence', text: 'A sad lad asks dad.', tip: 'Type gently and use the correct finger rather than stretching one finger across the keyboard.' }
  ],
  Medium: [
    { title: 'Reach and return', text: 'type write quiet power yellow', tip: 'Reach for keys with the assigned finger, then bring it back to its home-row position.' },
    { title: 'Steady rhythm', text: 'Small steps build steady typing skills.', tip: 'Try to keep a steady rhythm. Accuracy matters more than rushing.' },
    { title: 'Common words', text: 'people learn better when practice feels calm', tip: 'Look at the text instead of your hands, and relax your shoulders.' }
  ],
  Hard: [
    { title: 'Punctuation practice', text: 'Accuracy first; speed follows.', tip: 'Use the appropriate finger for punctuation and keep your wrists relaxed.' },
    { title: 'Longer sentence', text: 'Consistent practice helps your fingers find each key without looking.', tip: 'Break the sentence into small chunks and focus on clean keystrokes.' },
    { title: 'Mixed characters', text: 'In 2026, small habits can improve typing by 10%.', tip: 'Shift gently for capital letters and use the opposite hand for the Shift key when possible.' }
  ]
};
let practiceLevel = 'Beginner', practiceExerciseIndex = -1;
const heartsKey = () => 'kk_hearts_' + session;
const hearts = () => store.get(heartsKey(), 0);
function renderPractice() {
  $('#practiceHearts').textContent = hearts();
  $('#dashHearts').textContent = hearts() + ' hearts';
  $('[data-practice-level]').forEach(b => b.setAttribute('aria-pressed', b.dataset.practiceLevel === practiceLevel));
  loadPracticeExercise();
}
function loadPracticeExercise() {
  const list = PRACTICE_EXERCISES[practiceLevel];
  let n = Math.floor(Math.random() * list.length);
  if (list.length > 1 && n === practiceExerciseIndex) n = (n + 1) % list.length;
  practiceExerciseIndex = n;
  const item = list[n];
  $('#practiceExerciseTitle').textContent = item.title;
  $('#practiceLevelTag').textContent = practiceLevel.toUpperCase();
  $('#practicePrompt').textContent = item.text;
  $('#practiceInput').value = '';
  $('#practiceFeedback').hidden = true;
  $('#practiceInput').focus({ preventScroll: true });
}
function checkPractice() {
  const target = $('#practicePrompt').textContent, typed = $('#practiceInput').value;
  if (!typed.length) {
    $('#practiceFeedback').hidden = false;
    $('#practiceFeedback').innerHTML = '<h3>Start with a few characters 💗</h3><p>Type the exercise above, then check your practice to get helpful feedback.</p>';
    return;
  }
  let correct = 0, errors = 0, wrongKeys = {};
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === target[i]) correct++;
    else { errors++; const key = target[i] || typed[i]; wrongKeys[key] = (wrongKeys[key] || 0) + 1; }
  }
  const accuracy = Math.round(correct / typed.length * 100);
  const complete = typed === target;
  const reward = (complete ? 5 : 2) + (accuracy >= 95 ? 10 : 0);
  store.set(heartsKey(), hearts() + reward);
  const commonMistake = Object.entries(wrongKeys).sort((a,b) => b[1] - a[1])[0];
  const feedback = commonMistake
    ? 'You had the most trouble around "' + commonMistake[0] + '". ' + PRACTICE_EXERCISES[practiceLevel][practiceExerciseIndex].tip
    : PRACTICE_EXERCISES[practiceLevel][practiceExerciseIndex].tip;
  $('#practiceFeedback').hidden = false;
  $('#practiceFeedback').innerHTML = '<h3>' + (accuracy >= 95 ? 'Lovely accuracy! ♡' : 'Good effort — keep going!') + '</h3><p>Accuracy: <strong>' + accuracy + '%</strong> · Correct characters: <strong>' + correct + '</strong> · Mistakes: <strong>' + errors + '</strong></p><p>' + feedback.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p><p class="earned">+' + reward + ' ♥ earned!</p><p>Tip: retry the same exercise slowly to build muscle memory.</p>';
  $('#practiceHearts').textContent = hearts();
  $('#dashHearts').textContent = hearts() + ' hearts';
}


/* ---------- typing test ---------- */
const PARAS = {
  Easy: [
    'The sun rises early in the morning and the birds start to sing. I like to sit by the window with a warm cup of tea and watch the day begin.',
    'My dog loves to run in the park. Every evening we walk to the lake, play with a ball, and then go home for dinner.',
    'A good friend is someone who listens. They share your joy when you win and stay close when things go wrong.',
    'We planted a small garden last spring. Now the tomatoes are red, the beans are tall, and the flowers smell sweet.',
    'Reading a book before bed helps me relax. I turn off the lights, open a story, and let my mind drift to another place.',
    'Practice makes things easier. If you type a little each day, your hands will learn where every key is.'
  ],
  Medium: [
    "Learning to type well is not about rushing; it's about rhythm. When your fingers know the keyboard, your thoughts can move onto the screen without friction, and the work feels lighter.",
    'Every morning, the train arrives at 7:45, and the platform fills with quiet commuters. Some read, some sleep, and others stare out the window, rehearsing the day ahead.',
    'Good habits are built slowly. Start with five minutes a day, keep your wrists relaxed, and look at the screen instead of your hands; accuracy will come first, and speed will follow.',
    'The old library at the corner of Main Street has stood for over a century. Its creaky floors, tall windows, and endless shelves still attract readers who prefer paper to pixels.',
    'Cooking is a kind of conversation: you taste, adjust, and listen to what the dish needs. A pinch of salt, a squeeze of lemon, and patience can turn simple ingredients into a feast.',
    'When the storm finally passed, the streets were quiet and shining. Neighbors stepped outside, checked on one another, and began to clear the fallen branches together.'
  ],
  Hard: [
    'In 2024, researchers at the university published a comprehensive analysis of sleep patterns across 3,500 participants; the results (surprisingly) showed that consistency matters more than duration.',
    '"Efficiency," the manager remarked, "is doing things right; effectiveness is doing the right things." The team nodded, then reorganized the project timeline from 12 weeks to 9.',
    'Photosynthesis converts carbon dioxide and water into glucose and oxygen, using sunlight absorbed by chlorophyll; without it, nearly all life on Earth would be unsustainable.',
    "The committee's recommendation, approved by a 7-to-2 vote, requires every department to submit quarterly budgets, performance metrics, and a 500-word summary by the 15th.",
    'Cryptography relies on mathematical problems that are easy to verify but extraordinarily difficult to solve, such as factoring the product of two enormous prime numbers.',
    'She wrote: "Please email me at 5:30 p.m. if the shipment (order #48213) has not arrived; otherwise, we will reschedule the meeting for Thursday afternoon."'
  ]
};
let lastP = -1;
function para() {
  const pool = PARAS[settings.diff]; let i;
  do { i = Math.random() * pool.length | 0; } while (i === lastP && pool.length > 1);
  lastP = i; return pool[i];
}
function genText(min) { let s = para(); while (s.length < min) s += ' ' + para(); return s; }
let t = { chars: [], idx: 0, started: false, done: false, total: 0, hits: 0, ok: 0, start: 0, iv: null, practice: false };

function addChars(str) {
  const box = $('#chars');
  [...str].forEach(ch => { t.chars.push(ch); const s = document.createElement('span'); s.textContent = ch; box.appendChild(s); });
}
function stopTest() { clearInterval(t.iv); }
function resetTest() {
  stopTest();
  const p = settings.mode === 'practice';
  t = { chars: [...genText(p ? 400 : 900)], idx: 0, started: false, done: false, total: 0, hits: 0, ok: 0, start: 0, iv: null, practice: p, paused: false, limit: p ? settings.pmin * 60 : settings.dur };
  const box = $('#chars'); box.innerHTML = '<span id="caret"></span>';
  t.chars.forEach(c => { const s = document.createElement('span'); s.textContent = c; box.appendChild(s); });
  box.style.transform = '';
  $('#arena').hidden = false; $('#results').hidden = true;
  $('#hudWpm').textContent = 0; $('#hudAcc').textContent = '100%';
  $('#hudTime').textContent = p ? fmt(t.limit) : settings.dur + 's';
  $('#hudMode').textContent = p ? `Practice, ${settings.diff}` : `${settings.diff} mode`;
  $('.bar.wide').hidden = false; $('#testBar').hidden = false;
  $('#pauseBtn').disabled = true; $('#pauseBtn').textContent = 'Pause Test'; $('#words').classList.remove('paused');
  $('#barFill').style.width = '100%';
  rearm(); if (matchMedia('(hover: none)').matches) $('#kbd').focus({ preventScroll: true });
  moveCaret();
}
const spanAt = i => $('#chars').children[i + 1];
function moveCaret() {
  const c = $('#caret'), s = spanAt(t.idx) || spanAt(t.idx - 1), after = !spanAt(t.idx);
  if (!s) return;
  const lh = parseFloat(getComputedStyle($('#words')).lineHeight);
  c.style.left = s.offsetLeft + (after ? s.offsetWidth : 0) + 'px';
  c.style.top = s.offsetTop + (lh - c.offsetHeight) / 2 + 'px';
  $('#chars').style.transform = `translateY(${-Math.max(0, s.offsetTop - lh)}px)`;
}
const canType = () => current === 'test' && $('#modal').hidden && !t.paused && !t.done;
function backspace() {
  if (!canType() || t.idx <= 0) return;
  t.idx--; const s = spanAt(t.idx); if (s.className === 'ok') t.ok--; s.className = ''; moveCaret();
}
function typeChar(ch) {
  if (!canType()) return;
  if (!t.started) { t.started = true; t.start = performance.now(); t.iv = setInterval(tick, 100); $('#pauseBtn').disabled = false; }
  const s = spanAt(t.idx), good = ch === t.chars[t.idx];
  s.className = good ? 'ok' : 'bad'; t.total++;
  if (good) { t.hits++; t.ok++; }
  t.idx++;
  if (t.practice && t.chars.length - t.idx < 250) addChars(' ' + para());
  moveCaret(); hud();
  if (t.idx >= t.chars.length) finish();
}
function onKey(e) {
  if (current !== 'test' || !$('#modal').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') return resetTest();
  if (e.key === 'Backspace') { e.preventDefault(); return backspace(); }
  if (e.key.length === 1) { e.preventDefault(); typeChar(e.key); }
}
const elapsed = () => (performance.now() - t.start) / 1000;
function hud() {
  const m = Math.max(elapsed(), 1) / 60;
  $('#hudWpm').textContent = Math.round(t.ok / 5 / m);
  $('#hudAcc').textContent = (t.total ? Math.round(t.hits / t.total * 100) : 100) + '%';
}
function tick() {
  const left = t.limit - elapsed();
  $('#hudTime').textContent = t.practice ? fmt(Math.ceil(left)) : Math.max(0, Math.ceil(left)) + 's';
  $('#barFill').style.width = Math.max(0, left / t.limit * 100) + '%';
  hud();
  if (left <= 0) finish();
}
function finish() {
  if (t.done) return; t.done = true; stopTest();
  const p = t.practice, secs = Math.min(t.limit, Math.max(elapsed(), 1));
  const wpm = Math.round(t.ok / 5 / (secs / 60)), acc = t.total ? Math.round(t.hits / t.total * 100) : 0;
  const isBest = !p && wpm > 0 && wpm > best();
  const list = scores(); list.unshift({ ts: Date.now(), diff: settings.diff, dur: p ? Math.round(secs) : settings.dur, practice: p, wpm, acc, status: p ? 'Practice' : isBest ? 'New best' : 'Completed' });
  store.set(scoresKey(), list.slice(0, 200));
  $('#resWpm').textContent = wpm; $('#resAcc').textContent = acc + '%';
  $('#resChars').textContent = t.ok; $('#resMode').textContent = p ? `Practice, ${fmt(secs)}` : `${settings.diff}, ${settings.dur}s`;
  $('#bestBadge').hidden = !isBest;
  $('#kbd').blur(); $('#arena').hidden = true; $('#testBar').hidden = true; $('#results').hidden = false;
}
function togglePause() {
  if (!t.started || t.done) return;
  if (!t.paused) { t.paused = true; clearInterval(t.iv); t.pausedAt = performance.now(); }
  else { t.paused = false; t.start += performance.now() - t.pausedAt; t.iv = setInterval(tick, 100); }
  $('#pauseBtn').textContent = t.paused ? 'Resume Test' : 'Pause Test';
  $('#words').classList.toggle('paused', t.paused);
}

/* ---------- streak / profile ---------- */
function renderStreak() {
  const list = scores(), days = new Set(list.map(s => new Date(s.ts).toDateString()));
  let d = new Date(), n = 0;
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  $('#streakNum').textContent = `${n} day${n === 1 ? '' : 's'}`;
  const today = todayCount();
  $('#todayNum').textContent = today;
  $('#streakNote').textContent = today ? 'Streak secured for today.' : 'Take a test today to keep your streak.';
  $('#histEmpty').hidden = list.length > 0;
  const body = $('#histBody'); body.innerHTML = '';
  list.forEach(s => {
    const tr = body.insertRow();
    [new Date(s.ts).toLocaleDateString(), s.diff, s.practice ? fmt(s.dur) : s.dur + 's', s.wpm, s.acc + '%'].forEach(v => tr.insertCell().textContent = v);
    const c = tr.insertCell(), tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = s.status; c.appendChild(tag);
  });
}
function renderProfile() {
  const u = user(); openEdit(false);
  $('#profName').textContent = u.name;
  $('#profJoined').textContent = 'Joined ' + new Date(u.joined).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  $('#profBest').textContent = best(); $('#profTotal').textContent = scores().length;
  setAvatar($('#profAvatar'), u);
}
function uploadAvatar(e) {
  const f = e.target.files[0]; if (!f || !f.type.startsWith('image/')) return;
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    const c = document.createElement('canvas'), sz = 160, r = Math.min(img.width, img.height);
    c.width = c.height = sz;
    c.getContext('2d').drawImage(img, (img.width - r) / 2, (img.height - r) / 2, r, r, 0, 0, sz, sz);
    users[session].avatar = c.toDataURL('image/jpeg', .85); URL.revokeObjectURL(url);
    store.set('kk_users', users); updateChrome(); renderProfile();
  };
  img.src = url; e.target.value = '';
}

function openEdit(on) {
  $('#editForm').hidden = !on; $('#editErr').textContent = '';
  if (on) { $('#editUser').value = user().name; $('#editPass').value = ''; $('#editUser').focus(); }
}
function saveEdit(e) {
  e.preventDefault();
  const name = $('#editUser').value.trim(), pass = $('#editPass').value, key = name.toLowerCase(), err = $('#editErr');
  if (key !== session && users[key]) return err.textContent = 'That username is taken. Try another.';
  const u = user(); u.name = name; if (pass) u.pass = pass;
  if (key !== session) {
    store.set('kk_scores_' + key, scores()); localStorage.removeItem(scoresKey());
    delete users[session]; users[key] = u; session = key; store.set('kk_session', key);
  }
  if (!store.set('kk_users', users)) return err.textContent = 'Could not save changes. Check browser storage.';
  openEdit(false); updateChrome(); renderProfile();
}
function removeAvatar() { user().avatar = ''; store.set('kk_users', users); updateChrome(); renderProfile(); }

/* ---------- touch / on-screen keyboard input ---------- */
const SENT = '\u200b';
let last = '';
function rearm() { const k = $('#kbd'); k.value = SENT; last = ''; }
(() => {
  const k = $('#kbd'), toEnd = () => k.setSelectionRange(k.value.length, k.value.length);
  k.addEventListener('input', () => {
    if (!k.value.startsWith(SENT)) { backspace(); rearm(); return; }
    const v = k.value.slice(1); let i = 0;
    while (i < v.length && i < last.length && v[i] === last[i]) i++;
    for (let n = last.length; n > i; n--) backspace();
    [...v.slice(i)].forEach(typeChar);
    last = v; if (v.length > 30) rearm();
  });
  k.addEventListener('focus', toEnd); k.addEventListener('click', toEnd);
  rearm();
})();

/* ---------- wiring ---------- */
$('#editBtn').onclick = () => openEdit(true);
$('#editCancel').onclick = () => openEdit(false);
$('#editForm').onsubmit = saveEdit;
$('#removeAvatar').onclick = removeAvatar;
$('#menuBtn').onclick = () => toggleSidebar();
$('#scrim').onclick = closeSidebar;
$$('.nav-link').forEach(b => b.onclick = () => go(b.dataset.view));
$$('.brand').forEach(b => b.onclick = e => { e.preventDefault(); go('landing'); });
$$('[data-auth]').forEach(b => b.onclick = () => openModal(b.dataset.auth));
$('#switchMode').onclick = e => { e.preventDefault(); openModal(authMode === 'signin' ? 'signup' : 'signin'); };
$('#closeModal').onclick = closeModal;
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
$('#authForm').onsubmit = submitAuth;
$('#toDash').onclick = () => go('dashboard');
$('#signOut').onclick = signOut;
$('#takeTest').onclick = () => { settings.mode = 'timed'; go('test'); };
$('#openPractice').onclick = () => go('practice');
$('#practiceLevels').onclick = e => { const level = e.target.dataset.practiceLevel; if (level && PRACTICE_EXERCISES[level]) { practiceLevel = level; loadPracticeExercise(); $('[data-practice-level]').forEach(b => b.setAttribute('aria-pressed', b.dataset.practiceLevel === practiceLevel)); } };
$('#checkPractice').onclick = checkPractice;
$('#newExercise').onclick = loadPracticeExercise;
$('[data-view="practice"]').forEach(b => b.addEventListener('click', () => go('practice')));
$('[data-view="guide"]').forEach(b => b.addEventListener('click', () => go('guide')));
$('#practiceSel').onchange = () => { $('#customWrap').hidden = $('#practiceSel').value !== 'custom'; $('#practiceErr').textContent = ''; };
$('#startPractice').onclick = () => {
  const v = $('#practiceSel').value, mins = v === 'custom' ? Number($('#practiceCustom').value) : +v;
  if (!Number.isFinite(mins) || mins < 1 || mins > 600) return $('#practiceErr').textContent = 'Enter a practice time between 1 and 600 minutes.';
  $('#practiceErr').textContent = ''; settings.pmin = Math.round(mins); settings.mode = 'practice'; go('test');
};
$('#stopBtn').onclick = e => { e.currentTarget.blur(); if (!t.started) return go('dashboard'); if (t.paused) togglePause(); finish(); };
$('#pauseBtn').onclick = e => { e.currentTarget.blur(); togglePause(); };
$('#backBtn').onclick = () => go('dashboard');
$('#forgotLink').onclick = e => { e.preventDefault(); openModal('forgot'); };
$('#restartBtn').onclick = $('#againBtn').onclick = resetTest;
$('#backDash').onclick = () => go('dashboard');
$('#avatarInput').onchange = uploadAvatar;
$('#diffPills').onclick = e => { const d = e.target.dataset.diff; if (d) { settings.diff = d; renderDash(); } };
$('#durPills').onclick = e => { const d = e.target.dataset.dur; if (d) { settings.dur = +d; renderDash(); } };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#modal').hidden) return closeModal(); if ($('#sidebar').classList.contains('open')) return closeSidebar(); }
  onKey(e);
});
window.addEventListener('resize', () => current === 'test' && !t.done && moveCaret());

if (session && !users[session]) session = null;
updateChrome(); go('landing');
})();

/* interactive dot background: dots near the cursor rise and cast a shadow */
(() => {
  const cv = document.getElementById('dots'), ctx = cv.getContext('2d');
  let GAP = 26; const R = 120, still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, cols, rows, lift, mx = -999, my = -999, raf = 0;
  function size() {
    const d = Math.min(devicePixelRatio || 1, 2); GAP = innerWidth < 640 ? 30 : 26;
    W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    cols = Math.ceil(W / GAP) + 1; rows = Math.ceil(H / GAP) + 1; lift = new Float32Array(cols * rows); draw();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H); let active = false;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, x = c * GAP + GAP / 2, y = r * GAP + GAP / 2, dist = Math.hypot(x - mx, y - my);
      const target = dist < R ? (1 - dist / R) ** 2 : 0;
      let v = lift[i] + (target - lift[i]) * .16;
      if (Math.abs(target - v) < .003) v = target;
      lift[i] = v; if (v > 0) active = true;
      ctx.fillStyle = `rgba(255,92,138,${.07 + v * .12})`;
      ctx.beginPath(); ctx.ellipse(x, y + 2, 1.9 + v * 2, (1.9 + v * 2) * .55, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = `rgb(255,${255 - 163 * v | 0},${255 - 117 * v | 0})`; ctx.beginPath(); ctx.arc(x, y - v * 9, 1.7 + v * 2.1, 0, 6.3); ctx.fill();
    }
    return active;
  }
  const loop = () => { raf = draw() ? requestAnimationFrame(loop) : 0; };
  const wake = () => { if (!raf) raf = requestAnimationFrame(loop); };
  size(); addEventListener('resize', size);
  if (still) return;
  addEventListener('pointermove', e => {
    const onUI = e.target.closest('.card,button,aside,.topbar,.modal-card,a,label,input,table');
    mx = onUI ? -999 : e.clientX; my = onUI ? -999 : e.clientY; wake();
  });
  addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') { mx = my = -999; wake(); } });
  document.documentElement.addEventListener('pointerleave', () => { mx = my = -999; wake(); });
})();
