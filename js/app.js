/* Tamamlandı ✦ — uygulama */

const $ = id => document.getElementById(id);
const trDate = iso => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

const KIND_LABELS = {
  confirmation: '3D Onayı',
  revision: 'Revizyon',
  script: 'Senaryo',
  diet: 'Zihinsel Diyet',
  ladder_proof: 'Merdiven Kanıtı',
  inner_line: 'İç Konuşma',
};

/* ---------- yıldızlar ---------- */
function renderStars() {
  const box = $('stars');
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 60 + '%';
    s.style.animationDelay = (Math.random() * 4) + 's';
    box.appendChild(s);
  }
}

/* ---------- baş ---------- */
function renderHeader() {
  const now = new Date();
  $('date').textContent = now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const h = now.getHours();
  const isim = window.PROFILE_NAME || '';
  const hitap = isim ? ', ' + isim : '';
  $('greeting').textContent =
    h < 5  ? `Sessiz saatler${hitap}. Bilinçaltı dinliyor.` :
    h < 12 ? `Günaydın${hitap}. Her şey zaten oldu.` :
    h < 18 ? `İyi günler${hitap}. Sen o adamsın.` :
             `İyi akşamlar${hitap}. Sahneni seç, içinde uyu.`;

  Store.addUnique('visit', 'visit');
  const n = Store.streak();
  $('streak').textContent = `✦ ${n}. gün — durumun içinde yaşıyorsun`;
}

/* ---------- günün varsayımı + wonderful ---------- */
function renderAssumption() {
  const dayNum = Math.floor(Date.now() / 864e5);
  const a = ANCHORS[dayNum % ANCHORS.length];
  $('assumption-quote').textContent = '“' + a.quote + '”';
  $('assumption-domain').textContent = a.domain;

  const w = $('wonderful');
  let wi = dayNum % WONDERFUL_LINES.length;
  const show = () => { w.textContent = '“' + WONDERFUL_LINES[wi] + '”'; };
  w.addEventListener('click', () => { wi = (wi + 1) % WONDERFUL_LINES.length; show(); });
  show();
}

/* ---------- I AM ---------- */
function renderIam() {
  const stage = $('iam-stage');
  let i = 0;
  const show = () => {
    stage.innerHTML = `<div class="iam-line">${IAM_LINES[i]}</div>`;
    $('iam-progress').textContent = `${i + 1} / ${IAM_LINES.length} — dokun, sıradakini söyle`;
  };
  stage.addEventListener('click', () => { i = (i + 1) % IAM_LINES.length; show(); });
  show();
}

/* ---------- tamamlananlar ---------- */
function renderDone() {
  $('done-list').innerHTML = ANCHORS.map(a => `
    <div class="done-card">
      <div class="tick">✓</div>
      <div>
        <b>${a.title}</b>
        <p>${a.feel}</p>
        <span class="status">Gerçekleşti — 3D yetişiyor</span>
      </div>
    </div>`).join('');
}

/* ---------- SATS ---------- */
function renderSats() {
  const picker = $('sats-picker'), stage = $('sats-stage'),
        startBtn = $('sats-start'), timerEl = $('timer');
  let current = null, timer = null;

  picker.innerHTML = Object.entries(SCENES).map(([k, s]) =>
    `<button data-k="${k}">${s.label}</button>`).join('');

  const showScene = (scene, slow) => {
    stage.innerHTML = scene.lines.map((l, i) =>
      `<div class="line" style="animation-delay:${slow ? i * 4 : i * 0.35}s">${l}</div>`).join('');
  };

  picker.addEventListener('click', e => {
    const k = e.target.dataset.k;
    if (!k) return;
    current = k;
    [...picker.children].forEach(b => b.classList.toggle('active', b.dataset.k === k));
    showScene(SCENES[k], false);
    startBtn.style.display = '';
    timerEl.style.display = 'none';
    clearInterval(timer);
  });

  startBtn.addEventListener('click', () => {
    if (!current) return;
    showScene(SCENES[current], true);
    startBtn.style.display = 'none';
    timerEl.style.display = '';
    let left = 68;
    timerEl.textContent = left;
    clearInterval(timer);
    timer = setInterval(() => {
      left--;
      timerEl.textContent = left > 0 ? left : 'Tamamlandı. Artık öyle.';
      if (left <= 0) {
        clearInterval(timer);
        startBtn.style.display = '';
        startBtn.textContent = 'Tekrar Yaşa';
      }
    }, 1000);
  });
}

/* ---------- iç konuşmalar (Neville: inner conversations + telefon tekniği) ---------- */
function customTalkLines() { return Store.byKind('inner_line').map(e => e.content); }

function renderInnerTalk() {
  const picker = $('talk-picker'), card = $('talk-card'), loopBtn = $('talk-loop');
  const cats = [...Object.keys(INNER_TALK), 'kisiler'];
  const label = k => k === 'kisiler' ? 'Kişiler' : INNER_TALK[k].label;
  let cat = cats[0], i = 0, loop = null;

  picker.innerHTML = cats.map((k, n) =>
    `<button data-k="${k}" class="${n === 0 ? 'active' : ''}">${label(k)}</button>`).join('');

  const lines = () => cat === 'kisiler' ? customTalkLines() : INNER_TALK[cat].lines;

  const show = () => {
    const ls = lines();
    card.innerHTML = ls.length
      ? `<span class="line">${ls[i % ls.length]}</span>`
      : `<span class="line" style="color:var(--ink-dim);font-size:.95rem">${TALK_CUSTOM_HINT}</span>`;
  };
  const next = () => { i++; show(); };
  const stopLoop = () => { clearInterval(loop); loop = null; loopBtn.textContent = 'Döngü ▶'; };

  picker.addEventListener('click', e => {
    const k = e.target.dataset.k;
    if (!k) return;
    cat = k; i = 0;
    [...picker.children].forEach(b => b.classList.toggle('active', b.dataset.k === k));
    show();
  });
  $('talk-next').addEventListener('click', next);
  loopBtn.addEventListener('click', () => {
    if (loop) return stopLoop();
    loopBtn.textContent = 'Durdur ■';
    loop = setInterval(next, 4500);
  });
  $('talk-add').addEventListener('click', () => {
    const v = $('talk-input').value.trim();
    if (!v) return;
    Store.add('inner_line', v.startsWith('“') ? v : '“' + v + '”');
    $('talk-input').value = '';
    cat = 'kisiler'; i = customTalkLines().length - 1;
    [...picker.children].forEach(b => b.classList.toggle('active', b.dataset.k === 'kisiler'));
    show();
    renderHistory();
  });
  $('talk-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('talk-add').click(); });
  show();
}

/* ---------- sahneye giriş (ön-döşeme) ---------- */
function renderPrepave() {
  const stage = $('prepave-stage'), btn = $('prepave-start'), timerEl = $('prepave-timer');
  let timer = null;

  btn.addEventListener('click', () => {
    clearInterval(timer);
    btn.style.display = 'none';
    timerEl.style.display = '';
    const total = PREPAVE_STEPS.reduce((s, x) => s + x.t, 0);
    let left = total, step = 0, stepLeft = PREPAVE_STEPS[0].t;
    const showStep = () => { stage.innerHTML = `<div class="line">${PREPAVE_STEPS[step].text}</div>`; };
    showStep();
    timerEl.textContent = left;
    timer = setInterval(() => {
      left--; stepLeft--;
      timerEl.textContent = left > 0 ? left : '';
      if (stepLeft <= 0 && step < PREPAVE_STEPS.length - 1) {
        step++; stepLeft = PREPAVE_STEPS[step].t; showStep();
      }
      if (left <= 0) {
        clearInterval(timer);
        stage.innerHTML = `<div class="line" style="color:var(--gold-soft)">${PREPAVE_END}</div>`;
        btn.style.display = '';
        btn.textContent = 'Tekrar';
        timerEl.style.display = 'none';
      }
    }, 1000);
  });
}

/* ---------- özgürlük protokolü ---------- */
function bindFreedom() {
  const modal = $('freedom-modal');
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const fill = () => {
    $('freedom-line').textContent = pick(FREEDOM_LINES);
    $('freedom-mission').textContent = '→ ' + pick(FREEDOM_MISSIONS);
  };
  $('freedom-btn').addEventListener('click', () => { fill(); modal.classList.add('open'); });
  $('freedom-other').addEventListener('click', fill);
  $('freedom-done').addEventListener('click', () => {
    Store.add('diet', 'Eski hikâye yakalandı → hayata döndüm.');
    refreshDietCount();
    renderHistory();
    modal.classList.remove('open');
  });
}

/* ---------- robotik tasdik ---------- */
function renderRobot() {
  const picker = $('robot-picker'), phrases = $('robot-phrases'), stage = $('robot-stage'),
        phraseEl = $('robot-phrase'), countEl = $('robot-count');
  const cats = Object.keys(ROBOT_SETS);
  let cat = cats[0], idx = 0, count = 0;

  const lines = () => ROBOT_SETS[cat].lines;

  const renderCats = () => {
    picker.innerHTML = cats.map(k =>
      `<button data-k="${k}" class="${k === cat ? 'active' : ''}">${ROBOT_SETS[k].label}</button>`).join('');
  };
  const renderPhrases = () => {
    phrases.innerHTML = lines().map((a, i) =>
      `<button data-i="${i}" class="${i === idx ? 'active' : ''}">${a.split(' ').slice(0, 3).join(' ')}…</button>`).join('');
  };
  const show = () => {
    phraseEl.textContent = lines()[idx];
    countEl.textContent = count;
  };

  picker.addEventListener('click', e => {
    const k = e.target.dataset.k;
    if (!k) return;
    cat = k; idx = 0; count = 0;
    renderCats(); renderPhrases(); show();
  });
  phrases.addEventListener('click', e => {
    const i = e.target.dataset.i;
    if (i === undefined) return;
    idx = +i; count = 0;
    renderPhrases(); show();
  });
  renderCats(); renderPhrases();

  stage.addEventListener('click', () => {
    count++;
    countEl.textContent = count;
    phraseEl.classList.remove('pulse');
    void phraseEl.offsetWidth; // animasyonu yeniden tetikle
    phraseEl.classList.add('pulse');
    if (count === 21) {
      phraseEl.textContent = 'Yerleşti. Cümle artık senin.';
      setTimeout(show, 2200);
      count = 0;
    }
  });

  show();
}

/* ---------- hatırlıyor musun ---------- */
function renderMemory() {
  const card = $('memory-card');
  const dayNum = Math.floor(Date.now() / 864e5);
  let i = dayNum % MEMORY_LINES.length;
  const show = () => { card.textContent = MEMORY_LINES[i]; };
  $('memory-next').addEventListener('click', () => { i = (i + 1) % MEMORY_LINES.length; show(); });
  show();
}

/* ---------- zihinsel diyet ---------- */
function refreshDietCount() {
  $('diet-today').textContent = Store.byKind('diet').filter(e => e.day === Store.todayKey()).length;
}
function renderDiet() {
  $('diet-add').addEventListener('click', () => {
    const note = $('diet-input').value.trim();
    Store.add('diet', note || 'Yakaladım ve çevirdim.');
    $('diet-input').value = '';
    refreshDietCount();
    renderHistory();
  });
  refreshDietCount();
}

/* ---------- kayıt bölümleri (senaryo, onay, revizyon) ---------- */
function bindLogSection({ inputId, btnId, logId, kind, max }) {
  const render = () => {
    const items = Store.byKind(kind).slice(-max).reverse();
    $(logId).innerHTML = items.map(i =>
      `<div class="log-item kind-${kind}"><span class="when">${trDate(i.created_at)}${kind === 'revision' ? ' — mühürlendi' : ''}</span>${i.content}</div>`).join('');
  };
  $(btnId).addEventListener('click', () => {
    const v = $(inputId).value.trim();
    if (!v) return;
    Store.add(kind, v);
    $(inputId).value = '';
    render();
    renderHistory();
  });
  const input = $(inputId);
  if (input.tagName === 'INPUT') {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') $(btnId).click(); });
  }
  render();
  return render;
}

/* ---------- merdiven deneyi ---------- */
function renderLadder() {
  $('ladder-intro').textContent = LADDER_INFO.intro;
  const box = $('ladder-days');
  const doneDays = () => new Set(Store.byKind('ladder').map(e => e.content));
  const render = () => {
    const done = doneDays();
    box.innerHTML = Array.from({ length: LADDER_INFO.days }, (_, i) => {
      const d = 'day' + (i + 1);
      return `<button class="ladder-day ${done.has(d) ? 'done' : ''}" data-d="${d}">${done.has(d) ? '✓' : i + 1}</button>`;
    }).join('');
  };
  box.addEventListener('click', e => {
    const d = e.target.dataset.d;
    if (!d) return;
    Store.addUnique('ladder', d, { label: LADDER_INFO.nightLabel });
    render();
  });
  bindLogSection({ inputId: 'ladder-input', btnId: 'ladder-add', logId: 'ladder-log', kind: 'ladder_proof', max: 5 });
  render();
}

/* ---------- geçmiş ---------- */
let historyFilter = 'all';
function renderHistory() {
  const kinds = Object.keys(KIND_LABELS);
  const items = Store.entries
    .filter(e => kinds.includes(e.kind))
    .filter(e => historyFilter === 'all' || e.kind === historyFilter)
    .slice(-100).reverse();
  $('history-log').innerHTML = items.length
    ? items.map(i =>
        `<div class="log-item kind-${i.kind}"><span class="when">${trDate(i.created_at)} — ${KIND_LABELS[i.kind]}</span>${i.content}</div>`).join('')
    : '<div class="history-empty">Arşiv doluyor. Her kayıt, 3D’nin sana yetiştiğinin belgesi.</div>';
}
function bindHistoryFilters() {
  $('history-filter').addEventListener('click', e => {
    const f = e.target.dataset.f;
    if (!f) return;
    historyFilter = f;
    [...$('history-filter').children].forEach(b => b.classList.toggle('active', b.dataset.f === f));
    renderHistory();
  });
}

/* ---------- 3D gürültü modalı ---------- */
function bindNoise() {
  $('noise-btn').addEventListener('click', () => {
    $('noise-text').textContent = NOISE_LINES[Math.floor(Math.random() * NOISE_LINES.length)];
    $('noise-modal').classList.add('open');
  });
  $('noise-close').addEventListener('click', () => $('noise-modal').classList.remove('open'));
}

/* ---------- ayarlar / Supabase ---------- */
function bindSettings() {
  const modal = $('settings-modal'), status = $('settings-status');
  const dot = $('sync-dot');

  Store.onStatus = s => {
    dot.className = 'sync-dot' + (s === 'on' ? ' on' : s === 'err' ? ' err' : '');
    dot.title = s === 'on' ? 'Supabase eşitli' : s === 'err' ? 'Eşitleme hatası' : 'Yerel mod';
  };
  Store.onStatus(Store.status);

  $('gear-btn').addEventListener('click', () => {
    const c = Store.cfg();
    $('sb-url').value = c ? c.url : '';
    $('sb-key').value = c ? c.key : '';
    status.textContent = '';
    status.className = 'settings-status';
    modal.classList.add('open');
  });
  $('settings-close').addEventListener('click', () => modal.classList.remove('open'));

  $('sb-connect').addEventListener('click', async () => {
    const url = $('sb-url').value.trim(), key = $('sb-key').value.trim();
    if (!url || !key) { status.textContent = 'URL ve anon key gerekli.'; status.className = 'settings-status err'; return; }
    Store.setCfg(url, key);
    status.textContent = 'Bağlanıyor…';
    status.className = 'settings-status';
    await Store.sync();
    if (Store.status === 'on') {
      status.textContent = `Bağlandı — ${Store.entries.length} kayıt eşitlendi. Hafızan artık kalıcı.`;
      status.className = 'settings-status ok';
      renderHistory();
      renderHeader();
    } else {
      status.textContent = 'Bağlanamadı. URL/key doğru mu? schema.sql çalıştırıldı mı?';
      status.className = 'settings-status err';
    }
  });

  $('sb-disconnect').addEventListener('click', () => {
    Store.setCfg(null, null);
    Store.setStatus('off');
    status.textContent = 'Bağlantı kaldırıldı. Kayıtlar bu tarayıcıda kalmaya devam ediyor.';
    status.className = 'settings-status';
  });
}

/* ---------- açılış — kasa çözüldükten sonra vault.js çağırır ---------- */
async function startApp() {
  renderStars();
  renderAssumption();
  renderIam();
  renderDone();
  renderSats();
  renderInnerTalk();
  renderPrepave();
  renderRobot();
  renderMemory();
  bindNoise();
  bindFreedom();
  Machine.bind();
  bindSettings();
  bindHistoryFilters();

  await Store.init();

  renderHeader();
  renderDiet();
  bindLogSection({ inputId: 'confirm-input', btnId: 'confirm-add', logId: 'confirm-log', kind: 'confirmation', max: 30 });
  bindLogSection({ inputId: 'script-input', btnId: 'script-add', logId: 'script-log', kind: 'script', max: 10 });
  bindLogSection({ inputId: 'revision-input', btnId: 'revision-save', logId: 'revision-log', kind: 'revision', max: 10 });
  $('revision-templates').innerHTML = REVISION_TEMPLATES.map(t =>
    `<button data-tpl="${t}">${t.slice(0, 22)}…</button>`).join('');
  $('revision-templates').addEventListener('click', e => {
    const t = e.target.dataset.tpl;
    if (!t) return;
    const ta = $('revision-input');
    ta.value = t; ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  });
  renderLadder();
  renderHistory();

  // senaryo ilhamı
  const dayNum = Math.floor(Date.now() / 864e5);
  $('script-input').placeholder = SCRIPT_PROMPTS[dayNum % SCRIPT_PROMPTS.length];
}
