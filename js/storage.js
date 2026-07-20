/* Tamamlandı ✦ — hafıza katmanı
   Her zaman localStorage; Supabase yapılandırılmışsa REST API üzerinden
   iki yönlü eşitleme (bağımlılık yok, CDN yok — sadece fetch). */

const Store = {
  KEY: 'entries.v2',
  CFG_KEY: 'sb.cfg',
  entries: [],
  status: 'off', // off | on | err
  onStatus: null,

  uuid() {
    return (crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
  },

  todayKey() { return new Date().toISOString().slice(0, 10); },

  loadLocal() {
    try { this.entries = JSON.parse(localStorage.getItem(this.KEY)) ?? []; }
    catch { this.entries = []; }
    this.migrateV1();
  },

  saveLocal() { localStorage.setItem(this.KEY, JSON.stringify(this.entries)); },

  /* ilk sürümün 'confirmations' / 'revisions' anahtarlarını taşı */
  migrateV1() {
    const pull = (key, kind) => {
      let old;
      try { old = JSON.parse(localStorage.getItem(key)); } catch { return; }
      if (!Array.isArray(old) || !old.length) return;
      for (const item of old) {
        this.entries.push({
          id: this.uuid(), kind, content: item.text ?? String(item),
          meta: { migrated: true, when: item.when ?? null },
          day: this.todayKey(), created_at: new Date().toISOString(),
        });
      }
      localStorage.removeItem(key);
    };
    pull('confirmations', 'confirmation');
    pull('revisions', 'revision');
    this.saveLocal();
  },

  cfg() {
    try { return JSON.parse(localStorage.getItem(this.CFG_KEY)); } catch { return null; }
  },

  setCfg(url, key) {
    if (!url || !key) localStorage.removeItem(this.CFG_KEY);
    else localStorage.setItem(this.CFG_KEY, JSON.stringify({ url: url.replace(/\/+$/, ''), key }));
  },

  setStatus(s) { this.status = s; if (this.onStatus) this.onStatus(s); },

  headers() {
    const c = this.cfg();
    return {
      'apikey': c.key,
      'Authorization': 'Bearer ' + c.key,
      'Content-Type': 'application/json',
    };
  },

  async remoteFetchAll() {
    const c = this.cfg();
    const res = await fetch(c.url + '/rest/v1/manifest_entries?select=*&order=created_at.asc&limit=5000',
      { headers: this.headers() });
    if (!res.ok) throw new Error('fetch ' + res.status);
    return res.json();
  },

  async remoteUpsert(rows) {
    if (!rows.length) return;
    const c = this.cfg();
    const res = await fetch(c.url + '/rest/v1/manifest_entries', {
      method: 'POST',
      headers: { ...this.headers(), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error('upsert ' + res.status);
  },

  /* tam eşitleme: uzaktakini çek, birleştir, yerelde olup uzakta olmayanı gönder */
  async sync() {
    if (!this.cfg()) { this.setStatus('off'); return; }
    try {
      const remote = await this.remoteFetchAll();
      const localIds = new Set(this.entries.map(e => e.id));
      const remoteIds = new Set(remote.map(e => e.id));
      for (const r of remote) if (!localIds.has(r.id)) this.entries.push(r);
      this.entries.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      this.saveLocal();
      const missing = this.entries.filter(e => !remoteIds.has(e.id));
      await this.remoteUpsert(missing);
      this.setStatus('on');
    } catch (err) {
      console.warn('Supabase eşitleme hatası:', err);
      this.setStatus('err');
    }
  },

  /* kurulum linki: site.html#sb=<url>|<key> → yapılandırmayı kaydet, hash'i temizle.
     Key böylece repoya/adres geçmişine girmeden tek tıkla tanımlanır. */
  bootstrapFromHash() {
    const m = location.hash.match(/^#sb=([^|]+)\|(.+)$/);
    if (!m) return;
    this.setCfg(decodeURIComponent(m[1]), decodeURIComponent(m[2]));
    history.replaceState(null, '', location.pathname + location.search);
  },

  async init() {
    this.bootstrapFromHash();
    this.loadLocal();
    await this.sync();
  },

  add(kind, content, meta = {}) {
    const entry = {
      id: this.uuid(), kind, content, meta,
      day: this.todayKey(), created_at: new Date().toISOString(),
    };
    this.entries.push(entry);
    this.saveLocal();
    if (this.cfg()) {
      this.remoteUpsert([entry])
        .then(() => this.setStatus('on'))
        .catch(() => this.setStatus('err')); // sonraki sync() tamamlar
    }
    return entry;
  },

  byKind(kind) { return this.entries.filter(e => e.kind === kind); },

  /* aynı gün + kind + content tekrarını engelle (visit, ladder günleri) */
  addUnique(kind, content, meta = {}) {
    const dup = this.entries.find(e => e.kind === kind && e.content === content && e.day === this.todayKey());
    if (kind === 'ladder') {
      const anyDay = this.entries.find(e => e.kind === kind && e.content === content);
      if (anyDay) return anyDay;
    } else if (dup) return dup;
    return this.add(kind, content, meta);
  },

  /* seri: bugünden geriye kesintisiz ziyaret günü sayısı */
  streak() {
    const days = new Set(this.byKind('visit').map(e => e.day));
    let count = 0;
    const d = new Date();
    while (days.has(d.toISOString().slice(0, 10))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  },
};
