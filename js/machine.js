/* Tamamlandı ✦ — Makine
   Tek dokunuşla başlayan, kendi kendine akan tam-ekran ritüel programları.
   İçerik her gün rotasyonla değişir; ekrana dokunmak bir sonraki faza geçirir. */

const Machine = {
  SOUND_KEY: 'machine.sound',
  audio: null,
  stepTimer: null,
  steps: [],
  idx: 0,
  programKey: null,

  /* ---------- ses: fazlar arasında yumuşak çan ---------- */
  soundOn() { return localStorage.getItem(this.SOUND_KEY) !== 'off'; },
  toggleSound() {
    localStorage.setItem(this.SOUND_KEY, this.soundOn() ? 'off' : 'on');
    this.syncSoundBtn();
  },
  syncSoundBtn() {
    const b = document.getElementById('machine-sound');
    if (b) b.textContent = this.soundOn() ? '🔔' : '🔕';
  },
  chime() {
    if (!this.soundOn()) return;
    try {
      this.audio = this.audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = this.audio.currentTime;
      const o = this.audio.createOscillator();
      const g = this.audio.createGain();
      o.type = 'sine'; o.frequency.value = 196;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g); g.connect(this.audio.destination);
      o.start(t); o.stop(t + 1.5);
    } catch { /* ses yoksa sessiz devam */ }
  },

  /* ---------- programlar ---------- */
  day() { return Math.floor(Date.now() / 864e5); },
  rot(arr, n, offset = 0) {
    const d = this.day();
    return Array.from({ length: n }, (_, i) => arr[(d + offset + i) % arr.length]);
  },

  programs: {
    sabah: {
      title: 'Sabah Makinesi',
      build() {
        const M = Machine, d = M.day();
        const anchor = ANCHORS[d % ANCHORS.length];
        const scene = Object.values(SCENES).filter(s => s.label !== 'Ninni Modu')[d % 7];
        return [
          { text: 'Her şey zaten oldu.', t: 4, chime: true, cls: 'big' },
          { text: '“' + anchor.quote + '”', t: 8 },
          { text: 'Şimdi kim olduğunu hatırla —', t: 3, chime: true },
          ...M.rot(IAM_LINES, 3).map(l => ({ text: l, t: 4.5 })),
          { text: 'Kulak ver. Bugün senin hakkında konuşuyorlar —', t: 3, chime: true },
          ...M.rot(INNER_TALK.sohbet.lines, 1).map(l => ({ text: l, t: 5.5 })),
          ...M.rot(INNER_TALK.rahatlik.lines, 1, 3).map(l => ({ text: l, t: 5.5 })),
          { text: scene.label + ' — içine gir:', t: 3, chime: true },
          ...scene.lines.map(l => ({ text: l, t: 5 })),
          { text: M.rot(MEMORY_LINES, 1)[0], t: 8, chime: true },
          { text: '“' + M.rot(WONDERFUL_LINES, 1)[0] + '”', t: 6 },
          { text: 'Tamamlandı. Git ve o adam olarak yaşa.', t: 6, chime: true, cls: 'big' },
        ];
      },
    },
    sohbet: {
      title: 'Sohbet Makinesi',
      build() {
        const M = Machine;
        return [
          { text: 'Kapının önündesin. İyi — çünkü içerisi seni bekliyor.', t: 4, chime: true },
          { text: 'BEN, sohbeti tereyağı gibi akıtan adamım.', t: 4.5, cls: 'big' },
          { text: 'Duy —', t: 2, chime: true },
          ...M.rot(INNER_TALK.sohbet.lines, 3).map(l => ({ text: l, t: 4.5 })),
          { text: 'Şimdi sahneyi gör —', t: 2.5, chime: true },
          ...SCENES.muhabbet.lines.map(l => ({ text: l, t: 4.5 })),
          ...PREPAVE_STEPS.map(s => ({ text: s.text, t: 7 })),
          { text: PREPAVE_END, t: 5, chime: true, cls: 'big' },
        ];
      },
    },
    gece: {
      title: 'Gece Makinesi',
      build() {
        const M = Machine;
        return [
          { text: 'Gün bitti. Şimdi onu istediğin haline getir.', t: 4, chime: true },
          { text: 'Bugünden bir an seç. İstediğin gibi geçmiş olsun — gözlerini kapat ve o anı şimdi öyle yaşa.', t: 14 },
          { text: 'Mühürlendi. Bilinçaltı tarih atmaz.', t: 5, chime: true },
          { text: '“' + M.rot(WONDERFUL_LINES, 1, 2)[0] + '”', t: 6 },
          ...SCENES.lullaby.lines.map(l => ({ text: l, t: 6 })),
          { text: 'İçinde uyu. Gerisi hallolur. Her zaman hallolur.', t: 8, chime: true, cls: 'big' },
        ];
      },
    },
  },

  /* ---------- oynatıcı ---------- */
  el(id) { return document.getElementById(id); },

  run(key) {
    const prog = this.programs[key];
    if (!prog) return;
    this.programKey = key;
    this.steps = prog.build();
    this.idx = -1;
    this.done = false;
    this.el('machine-title').textContent = prog.title;
    this.el('machine-overlay').classList.add('open');
    this.el('machine-bar-fill').style.width = '0%';
    this.syncSoundBtn();
    this.next();
  },

  next() {
    if (this.done) return this.close(); // bitiş ekranında dokunuş → kapat
    clearTimeout(this.stepTimer);
    this.idx++;
    if (this.idx >= this.steps.length) return this.finish();
    const s = this.steps[this.idx];
    const stage = this.el('machine-text');
    stage.innerHTML = `<div class="line ${s.cls || ''}">${s.text}</div>`;
    if (s.chime) this.chime();
    const done = this.steps.slice(0, this.idx + 1).reduce((a, x) => a + x.t, 0);
    const total = this.steps.reduce((a, x) => a + x.t, 0);
    const fill = this.el('machine-bar-fill');
    fill.style.transitionDuration = s.t + 's';
    requestAnimationFrame(() => { fill.style.width = (done / total * 100) + '%'; });
    this.stepTimer = setTimeout(() => this.next(), s.t * 1000);
  },

  finish() {
    clearTimeout(this.stepTimer);
    this.done = true;
    Store.add('machine', this.programKey);
    const n = Store.streak();
    this.el('machine-text').innerHTML =
      `<div class="line big">✦</div><div class="line" style="animation-delay:.6s">Makine tamamlandı — ${n}. gün. Durumun içindesin.</div>`;
    this.chime();
    this.stepTimer = setTimeout(() => this.close(), 6000);
  },

  close() {
    clearTimeout(this.stepTimer);
    this.el('machine-overlay').classList.remove('open');
  },

  /* ---------- bağlama ---------- */
  suggestedKey() {
    const h = new Date().getHours();
    return h >= 20 || h < 4 ? 'gece' : h < 12 ? 'sabah' : 'sohbet';
  },

  bind() {
    document.querySelectorAll('.machine-card').forEach(b =>
      b.addEventListener('click', () => this.run(b.dataset.m)));

    // saate göre önerilen programı işaretle
    const sug = document.querySelector(`.machine-card[data-m="${this.suggestedKey()}"]`);
    if (sug) sug.classList.add('suggested');

    const overlay = this.el('machine-overlay');
    overlay.addEventListener('click', () => this.next()); // dokun → ilerle
    this.el('machine-close').addEventListener('click', e => { e.stopPropagation(); this.close(); });
    this.el('machine-sound').addEventListener('click', e => { e.stopPropagation(); this.toggleSound(); });

    // #otomatik: ana ekran kısayolu siteyi açar açmaz makineyi çalıştırır
    if (location.hash === '#otomatik') this.run(this.suggestedKey());
  },
};
