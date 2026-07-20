/* Altın Kitap — mühürler + haftalık kanıt raporu */

const Report = {
  renderSeals() {
    const grid = document.getElementById('seals-grid');
    if (!grid) return;
    const streak = Store.streak();
    const machines = Store.byKind('machine').length;
    grid.innerHTML = SEALS.map(s => {
      const val = s.type === 'machine' ? machines : streak;
      const earned = val >= s.n;
      const pct = Math.min(100, Math.round(val / s.n * 100));
      return `<div class="seal ${earned ? 'earned' : ''}">
        <div class="seal-disc"><span>${earned ? '✦' : s.n}</span></div>
        <b>${s.name}</b>
        <p>${s.desc}</p>
        <div class="seal-progress">${earned ? 'Kazanıldı' : `${val} / ${s.n} — %${pct}`}</div>
      </div>`;
    }).join('');
  },

  lastWeek() {
    const cutoff = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    return Store.entries.filter(e => e.day >= cutoff);
  },

  renderWeekly() {
    const box = document.getElementById('weekly-report');
    if (!box) return;
    const week = this.lastWeek();
    const count = k => week.filter(e => e.kind === k).length;
    const confirmations = count('confirmation');
    const rows = [
      ['3D Onayı', confirmations],
      ['Revizyon', count('revision')],
      ['Senaryo', count('script')],
      ['Zihinsel Diyet Zaferi', count('diet')],
      ['Makine Turu', count('machine')],
      ['İç Konuşma', count('inner_line')],
    ].filter(([, n]) => n > 0);

    if (!rows.length) {
      box.innerHTML = `<div class="report-doc"><div class="report-title">${REPORT.title}</div>
        <p class="report-empty">${REPORT.empty}</p></div>`;
      return;
    }

    const highlights = week.filter(e => e.kind === 'confirmation').slice(-3).reverse()
      .map(e => `<li>${e.content}</li>`).join('');
    const closing = REPORT.closings[Machine.day() % REPORT.closings.length]
      .replace('{n}', confirmations || week.length);

    box.innerHTML = `<div class="report-doc">
      <div class="report-title">${REPORT.title}</div>
      <table class="report-table">${rows.map(([k, n]) =>
        `<tr><td>${k}</td><td>${n}</td></tr>`).join('')}</table>
      ${highlights ? `<div class="report-sub">Tutanağa geçen son onaylar:</div><ul class="report-list">${highlights}</ul>` : ''}
      <div class="report-closing">${closing}</div>
      <div class="report-stamp">✦</div>
    </div>`;
  },

  render() { this.renderSeals(); this.renderWeekly(); },
};
