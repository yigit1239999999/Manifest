/* Altın Kitap — Manifest Atölyesi
   Hedefini olmuş-bitmiş dilde yazarsın; Claude motoru ona özel affirmasyonlar,
   iç konuşmalar ve bir SATS sahnesi üretir. Her manifest bir dosya (dossier):
   kendi sahnesi, kanıtları ve günlük çalışması olur. Gerçekleşince törenle
   Gerçekleşenler Salonu'na işlenir ve gökyüzüne büyük yıldız olarak düşer. */

const Manifests = {
  doneIds() { return new Set(Store.byKind('manifest_done').map(e => e.content)); },
  active() {
    const done = this.doneIds();
    return Store.byKind('manifest').filter(m => !done.has(m.id));
  },
  completed() {
    const doneEntries = Store.byKind('manifest_done');
    return doneEntries.map(d => {
      const m = Store.byKind('manifest').find(x => x.id === d.content);
      return m ? { manifest: m, doneAt: d.created_at, doneDay: d.day } : null;
    }).filter(Boolean);
  },
  byId(id) { return Store.byKind('manifest').find(m => m.id === id); },
  genLines(id, role) {
    return Store.byKind('affirm_gen')
      .filter(e => e.meta && e.meta.manifestId === id && (!role || e.meta.role === role));
  },
  proofCount(id) {
    return Store.byKind('confirmation').filter(e => e.meta && e.meta.manifestId === id).length;
  },
  daysSince(m) {
    return Math.max(1, Math.round((Date.now() - new Date(m.created_at).getTime()) / 864e5) + 1);
  },
  todayManifest() {
    const a = this.active();
    if (!a.length) return null;
    return a[Math.floor(Date.now() / 864e5) % a.length];
  },

  sceneFor(m) {
    const gen = this.genLines(m.id, 'scene').map(e => e.content);
    if (gen.length) return gen;
    return ATELIER.scene_template.map(l => l.replace('{goal}', m.content));
  },

  practiceDone(id, step) {
    const key = id + ':' + step;
    return Store.byKind('practice').some(e => e.content === key && e.day === Store.todayKey());
  },

  /* ---------- Claude üretimi ---------- */
  async generateFor(m, statusEl) {
    const existing = this.genLines(m.id).map(e => e.content);
    statusEl.textContent = existing.length ? 'Derinleştiriliyor…' : 'Üretiliyor…';
    try {
      const out = await ClaudeGen.generate(m.content, existing);
      const push = (arr, role) => (arr || []).forEach(line => {
        const v = String(line).trim();
        if (v) Store.add('affirm_gen', v, { manifestId: m.id, role });
      });
      push(out.affirmations, 'affirmation');
      push(out.iam, 'iam');
      push(out.inner_talk, 'inner');
      push(out.scene, 'scene');
      this.renderDossiers();
      this.renderToday();
      if (window.refreshRobot) refreshRobot();
      const fresh = document.querySelector(`[data-status="${m.id}"]`);
      if (fresh) fresh.textContent = '✦ Yeni satırlar kazındı — zikirmatikte "Manifestlerim" kanalında.';
    } catch (err) {
      statusEl.textContent = err.message === 'noKey'
        ? 'Claude API key gerekli — sağ üstteki ⚙ panelinden ekle (console.anthropic.com).'
        : err.message;
    }
  },

  /* ---------- render ---------- */
  render() {
    this.bindForm();
    this.renderToday();
    this.renderDossiers();
    this.renderSalon();
  },

  bindForm() {
    const input = document.getElementById('manifest-input');
    const domains = document.getElementById('manifest-domains');
    input.placeholder = ATELIER.placeholder;
    document.getElementById('atelier-hint').textContent = ATELIER.hint;
    let domain = ANCHORS[0].key;
    domains.innerHTML = ANCHORS.map(a =>
      `<button data-k="${a.key}" class="${a.key === domain ? 'active' : ''}">${a.domain}</button>`).join('');
    domains.addEventListener('click', e => {
      const k = e.target.dataset.k;
      if (!k) return;
      domain = k;
      [...domains.children].forEach(b => b.classList.toggle('active', b.dataset.k === k));
    });
    document.getElementById('manifest-add').addEventListener('click', () => {
      const v = input.value.trim();
      if (!v) return;
      const m = Store.add('manifest', v, { domain });
      input.value = '';
      this.renderDossiers();
      this.renderToday();
      renderHistory();
      // key varsa ilk üretimi kendiliğinden başlat
      const status = document.querySelector(`[data-status="${m.id}"]`);
      if (ClaudeGen.ready() && status) this.generateFor(m, status);
    });
  },

  renderToday() {
    const box = document.getElementById('today-work');
    const m = this.todayManifest();
    if (!m) { box.innerHTML = ''; return; }
    let tally = { today: 0 };
    try { const t = JSON.parse(localStorage.getItem('robot.tally')); if (t && t.day === Store.todayKey()) tally = t; } catch { /* yoksay */ }
    const tasks = [
      { key: 'sahne', done: this.practiceDone(m.id, 'sahne'), label: ATELIER.tasks.sahne },
      { key: 'zikir', done: tally.today >= 33, label: ATELIER.tasks.zikir + (tally.today < 33 ? ` — ${tally.today}/33` : '') },
      { key: 'onay', done: this.practiceDone(m.id, 'onay'), label: ATELIER.tasks.onay },
    ];
    const allDone = tasks.every(t => t.done);
    box.innerHTML = `<div class="today-card ${allDone ? 'sealed' : ''}">
      <div class="today-title">${ATELIER.today_title}</div>
      <div class="today-sub">${ATELIER.today_sub}</div>
      <div class="today-goal">“${m.content}”</div>
      <div class="today-tasks">${tasks.map(t =>
        `<div class="today-task ${t.done ? 'done' : ''}"><span>${t.done ? '✦' : '○'}</span>${t.label}</div>`).join('')}</div>
      ${allDone ? `<div class="today-sealed">${ATELIER.sealed}</div>`
        : `<button class="btn" data-live="${m.id}">Sahnede Yaşa — 68 sn</button>`}
    </div>`;
    const liveBtn = box.querySelector('[data-live]');
    if (liveBtn) liveBtn.addEventListener('click', () => this.playScene(m));
  },

  playScene(m) {
    Machine.runCustom('Manifest Sahnesi', this.sceneFor(m), () => {
      Store.addUnique('practice', m.id + ':sahne');
      this.renderToday();
    });
  },

  renderDossiers() {
    const list = document.getElementById('dossier-list');
    const active = this.active();
    list.innerHTML = active.map(m => {
      const lines = this.genLines(m.id, 'affirmation').length + this.genLines(m.id, 'iam').length;
      const proofs = this.proofCount(m.id);
      const a = ANCHORS.find(x => x.key === (m.meta && m.meta.domain)) || ANCHORS[0];
      return `<div class="dossier" data-id="${m.id}">
        <div class="dossier-domain">${a.domain}</div>
        <div class="dossier-goal">“${m.content}”</div>
        <div class="dossier-meta">${this.daysSince(m)} ${ATELIER.days_word} · ${proofs} ${ATELIER.proof_word} · ${lines} ${ATELIER.line_word}</div>
        <div class="dossier-actions">
          <button class="btn secondary" data-act="gen">${lines ? 'Derinleştir ✦' : 'Affirmasyon Üret ✦'}</button>
          <button class="btn secondary" data-act="scene">68 sn Yaşa</button>
          <button class="btn secondary" data-act="proof">Onay Yaz</button>
          <button class="btn" data-act="done">Gerçekleşti ✓</button>
        </div>
        <div class="dossier-status" data-status="${m.id}"></div>
        <div class="row dossier-proof-row" data-proofrow="${m.id}" style="display:none">
          <input type="text" placeholder="3D bu manifest için ne gösterdi?">
          <button class="btn" data-act="proof-save">Kaydet</button>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.dossier').forEach(card => {
      const m = this.byId(card.dataset.id);
      const status = card.querySelector('[data-status]');
      card.addEventListener('click', e => {
        const act = e.target.dataset.act;
        if (!act) return;
        if (act === 'gen') this.generateFor(m, status);
        if (act === 'scene') this.playScene(m);
        if (act === 'proof') {
          const row = card.querySelector('[data-proofrow]');
          row.style.display = row.style.display === 'none' ? '' : 'none';
          if (row.style.display === '') row.querySelector('input').focus();
        }
        if (act === 'proof-save') {
          const inputEl = card.querySelector('[data-proofrow] input');
          const v = inputEl.value.trim();
          if (!v) return;
          Store.add('confirmation', v, { manifestId: m.id });
          Store.addUnique('practice', m.id + ':onay');
          inputEl.value = '';
          Sky.birth();
          Report.renderWeekly();
          renderHistory();
          this.renderDossiers();
          this.renderToday();
        }
        if (act === 'done') this.ceremony(m);
      });
    });
  },

  ceremony(m) {
    const modal = document.getElementById('ceremony-modal');
    const dayNum = Math.floor(Date.now() / 864e5);
    document.getElementById('ceremony-goal').textContent = '“' + m.content + '”';
    document.getElementById('ceremony-line').textContent =
      ATELIER.done_lines[dayNum % ATELIER.done_lines.length];
    modal.classList.add('open');
    document.getElementById('ceremony-seal').onclick = () => {
      Store.add('manifest_done', m.id, { goal: m.content });
      modal.classList.remove('open');
      Sky.birth();
      Report.render();
      this.renderDossiers();
      this.renderToday();
      this.renderSalon();
    };
    document.getElementById('ceremony-cancel').onclick = () => modal.classList.remove('open');
  },

  renderSalon() {
    const box = document.getElementById('salon-list');
    const done = this.completed().reverse();
    if (!done.length) {
      box.innerHTML = `<div class="history-empty">${ATELIER.salon_empty}</div>`;
      return;
    }
    box.innerHTML = done.map(({ manifest, doneAt }) => {
      const days = Math.max(1, Math.round((new Date(doneAt) - new Date(manifest.created_at)) / 864e5) + 1);
      const when = new Date(doneAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      return `<div class="salon-item">
        <div class="salon-star">✦</div>
        <div>
          <div class="salon-goal">“${manifest.content}”</div>
          <div class="salon-meta">${when} — ${days} ${ATELIER.delivered_word}</div>
        </div>
      </div>`;
    }).join('');
  },
};
