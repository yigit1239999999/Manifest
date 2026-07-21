/* Altın Kitap — Claude affirmasyon motoru
   Kullanıcının yazdığı hedefe özel, Neville yapısında affirmasyonlar üretir.
   Çağrı doğrudan tarayıcıdan api.anthropic.com'a gider; API key yalnızca
   localStorage'da durur, repoya ya da başka bir sunucuya asla gitmez.
   Şifreli kişisel içerik API'ye GÖNDERİLMEZ — yalnızca o an yazılan hedef gider. */

const ClaudeGen = {
  KEY: 'claude.key',
  key() { return localStorage.getItem(this.KEY) || ''; },
  setKey(k) { k ? localStorage.setItem(this.KEY, k.trim()) : localStorage.removeItem(this.KEY); },
  ready() { return !!this.key(); },

  SCHEMA: {
    type: 'object',
    properties: {
      affirmations: { type: 'array', items: { type: 'string' } },
      iam: { type: 'array', items: { type: 'string' } },
      inner_talk: { type: 'array', items: { type: 'string' } },
      scene: { type: 'array', items: { type: 'string' } },
    },
    required: ['affirmations', 'iam', 'inner_talk', 'scene'],
    additionalProperties: false,
  },

  SYSTEM: [
    'Sen Neville Goddard ekolünde usta bir manifest koçusun. Kullanıcı sana Türkçe bir hedef verir;',
    'sen o hedefe özel, Türkçe, bilinçaltına işleyen satırlar üretirsin. Kurallar:',
    '1) Olmuş-bitmiş dil: asla "olacak" deme; "öyledir", "oldu", "hep öyleydi".',
    '2) Feeling is the secret: soyut iddia yerine duyulur/görülür/hissedilir an — satır okunurken bedende yaşanmalı.',
    '3) "her zaman" kalıcılık çapasını doğal yerlerde cömertçe kullan (robotlaşmadan).',
    '4) Çekim formu: iyi olan ona gelir, onu bulur.',
    '5) Birkaç satır "Ne güzel ki…" / "Şükür ki…" şükür formunda olsun.',
    '6) Satırlar kısa ve tekrarlanabilir olsun (zikirmatikte söylenecek).',
    '7) affirmations: hedefe özel 10 satır, birinci tekil şahıs.',
    '8) iam: "BEN, … adamım/insanım" formunda 2 satır.',
    '9) inner_talk: başkalarının ağzından ona söylenen 3 cümle, tırnak içinde ("…").',
    '10) scene: hedefin gerçekleşmiş olduğu anın SATS sahnesi — 5-7 kısa satır, ikinci tekil şahıs ("sen" dili), sinematik, şimdiki zaman.',
    'Derinleştirme istenirse: önceki satırları TEKRARLAMA; aynı hedefin daha derin, daha duyusal, daha taze katmanlarını yaz.',
  ].join('\n'),

  async generate(goal, existing = []) {
    if (!this.ready()) throw new Error('noKey');
    const user = existing.length
      ? `Hedef: "${goal}"\n\nDaha önce üretilenler (bunları tekrarlama, derine in):\n${existing.join('\n')}`
      : `Hedef: "${goal}"`;

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.key(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-8',
          max_tokens: 4096,
          system: this.SYSTEM,
          output_config: { format: { type: 'json_schema', schema: this.SCHEMA } },
          messages: [{ role: 'user', content: user }],
        }),
      });
    } catch {
      throw new Error('Ağa ulaşılamadı — bağlantını kontrol et.');
    }

    if (!res.ok) {
      if (res.status === 401) throw new Error('API key geçersiz görünüyor (⚙ panelinden kontrol et).');
      if (res.status === 429) throw new Error('Hız sınırı — bir dakika sonra tekrar dene.');
      throw new Error('Üretim başarısız (' + res.status + ').');
    }
    const data = await res.json();
    if (data.stop_reason === 'refusal') throw new Error('Bu hedef için üretim yapılamadı — hedefi yeniden ifade et.');
    const block = (data.content || []).find(b => b.type === 'text');
    if (!block) throw new Error('Boş yanıt geldi — tekrar dene.');
    return JSON.parse(block.text);
  },
};
