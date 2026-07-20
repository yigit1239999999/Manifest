/* Altın Kitap — günlük kehanet kartı
   Günde bir çekiliş; hüküm çekiliş anında meta'ya yazılır ve Supabase'e
   eşitlenir — aynı gün her cihazda aynı kart açık gelir. */

const Oracle = {
  dayKey() { return String(Machine.day()); },

  pool() {
    const w = window.PRIORITY_WEIGHTS || {};
    const out = [];
    for (const a of ANCHORS) {
      const n = w[a.key] ?? 2;
      for (let i = 0; i < n; i++) out.push('“' + a.quote + '”');
    }
    MEMORY_LINES.forEach(l => out.push(l));
    WONDERFUL_LINES.forEach(l => out.push('“' + l + '”'));
    Store.byKind('inner_line').forEach(e => { out.push(e.content); out.push(e.content); });
    return out;
  },

  drawn() {
    return Store.entries.find(e => e.kind === 'oracle' && e.content === this.dayKey());
  },

  render() {
    const card = document.getElementById('oracle-card');
    const hint = document.getElementById('oracle-hint');
    if (!card) return;
    hint.textContent = ORACLE.hint;

    const reveal = (text, animate) => {
      card.querySelector('.oracle-text').textContent = text;
      if (animate) card.classList.add('revealed');
      else { card.classList.add('revealed', 'instant'); }
      hint.textContent = ORACLE.closing;
    };

    const existing = this.drawn();
    if (existing && existing.meta && existing.meta.text) reveal(existing.meta.text, false);

    card.addEventListener('click', () => {
      if (card.classList.contains('revealed')) return;
      const p = this.pool();
      const text = p[Machine.day() % p.length];
      Store.addUnique('oracle', this.dayKey(), { text });
      reveal(text, true);
    });
  },
};
