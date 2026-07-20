/* Altın Kitap — canlı gökyüzü + kanıt takımyıldızı
   Hero'nun arka planı gerçek saate göre renklenir; kaydedilen her 3D onayı
   gökyüzüne kalıcı bir yıldız olarak işlenir ve dokununca anıyı gösterir. */

const Sky = {
  W: 1000, H: 600,

  hash(s) {
    let h = 2166136261;
    for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },

  proofEntries() {
    return Store.entries
      .filter(e => e.kind === 'confirmation' || e.kind === 'ladder_proof')
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  },

  /* konum id'den deterministik ORAN olarak gelir; her ekranda aynı düzen, hep görünür */
  pos(entry) {
    const h = this.hash(entry.id);
    return {
      x: this.W * (0.07 + (h % 1000) / 1000 * 0.86),
      y: this.H * (0.08 + ((h >> 10) % 1000) / 1000 * 0.6),
    };
  },

  /* saat → gökyüzü gradyanı (durak renkleri arasında doğrusal geçiş) */
  skyGradient() {
    const stops = [
      [0,  ['#05040f', '#0d0a1f', '#1b1440']],
      [5,  ['#0d0a1f', '#1b1440', '#2a1d5e']],
      [7,  ['#1b1440', '#4a2d7a', '#d98b64']],
      [11, ['#1e1a4a', '#4a3d8f', '#e8a97a']],
      [16, ['#221a52', '#5a3d96', '#d98b64']],
      [19, ['#140f33', '#3a2470', '#a55f6e']],
      [22, ['#07051a', '#120d2e', '#241a52']],
      [24, ['#05040f', '#0d0a1f', '#1b1440']],
    ];
    const now = new Date();
    const t = now.getHours() + now.getMinutes() / 60;
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const f = (t - a[0]) / (b[0] - a[0] || 1);
    const mix = (c1, c2) => {
      const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const [r1, g1, b1] = p(c1), [r2, g2, b2] = p(c2);
      const v = (x, y) => Math.round(x + (y - x) * f);
      return `rgb(${v(r1, r2)},${v(g1, g2)},${v(b1, b2)})`;
    };
    return `linear-gradient(180deg, ${mix(a[1][0], b[1][0])} 0%, ${mix(a[1][1], b[1][1])} 55%, ${mix(a[1][2], b[1][2])} 100%)`;
  },

  darkness() {
    const h = new Date().getHours();
    return (h >= 21 || h < 5) ? 1 : (h >= 7 && h < 17) ? 0.45 : 0.75;
  },

  starSvg(e, i, total, born) {
    const { x, y } = this.pos(e);
    const r = 2 + (i / Math.max(1, total - 1)) * 2.2; // yeniler daha parlak/büyük
    return `<g class="proof-star ${born ? 'born' : ''}" data-id="${e.id}" transform="translate(${x},${y})">
      <circle r="${r * 4}" fill="transparent"></circle>
      <circle r="${r}" fill="#f0cd8a"></circle>
      <circle r="${r * 2.4}" fill="#e8b34b" opacity="0.14"></circle>
    </g>`;
  },

  render() {
    const svg = document.getElementById('sky-svg');
    const hero = document.getElementById('hero');
    if (!svg || !hero) return;
    this.W = hero.clientWidth || 1000;
    this.H = hero.clientHeight || 600;
    hero.style.background = this.skyGradient();

    const dark = this.darkness();
    let ambient = '';
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * this.W, y = Math.random() * this.H * 0.8;
      const o = (Math.random() * 0.6 + 0.1) * dark;
      ambient += `<circle cx="${x}" cy="${y}" r="${Math.random() * 1.1 + 0.3}" fill="#fff" opacity="${o.toFixed(2)}" class="amb" style="animation-delay:${(Math.random() * 5).toFixed(1)}s"></circle>`;
    }

    const proofs = this.proofEntries();
    const pts = proofs.map(e => this.pos(e));
    const lines = pts.length > 1
      ? `<polyline points="${pts.map(p => p.x + ',' + p.y).join(' ')}" fill="none" stroke="#e8b34b" stroke-width="0.7" opacity="0.28"></polyline>`
      : '';
    const stars = proofs.map((e, i) => this.starSvg(e, i, proofs.length, false)).join('');

    svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    svg.innerHTML = ambient + lines + stars;
    this.bindTips(svg, proofs);
  },

  bindTips(svg, proofs) {
    const tip = document.getElementById('sky-tip');
    svg.onclick = ev => {
      const g = ev.target.closest('.proof-star');
      if (!g) { tip.classList.remove('show'); return; }
      const e = proofs.find(p => p.id === g.dataset.id);
      if (!e) return;
      tip.innerHTML = `<span class="when">${new Date(e.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</span>${e.content}`;
      tip.classList.add('show');
      const rect = svg.getBoundingClientRect();
      const x = Math.min(Math.max(ev.clientX - rect.left, 90), rect.width - 90);
      tip.style.left = x + 'px';
      tip.style.top = Math.min(ev.clientY - rect.top + 14, rect.height - 60) + 'px';
    };
    document.addEventListener('click', ev => {
      if (!ev.target.closest('#sky-svg')) tip.classList.remove('show');
    });
  },

  /* yeni onay → yıldız doğumu */
  birth() {
    this.render();
    const last = document.querySelector('#sky-svg .proof-star:last-of-type');
    if (last) last.classList.add('born');
  },
};

let skyResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(skyResizeTimer);
  skyResizeTimer = setTimeout(() => { if (window.Store && Store.entries) Sky.render(); }, 250);
});
