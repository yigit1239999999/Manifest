/* Tamamlandı ✦ — kasa
   Kişisel içerik repoda yalnızca AES-256-GCM ile mühürlü durur (content.enc.js).
   Doğru anahtar kelime girilince çözülür, bu cihazda hatırlanır ve uygulama başlar.
   Anahtar olmadan site boş bir kilit ekranından ibarettir. */

const Vault = {
  PASS_KEY: 'vault.pass',

  b64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); },

  async decrypt(pass) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: this.b64(CONTENT_ENC.salt), iterations: CONTENT_ENC.iterations, hash: 'SHA-256' },
      baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.b64(CONTENT_ENC.iv) }, key, this.b64(CONTENT_ENC.data)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  },

  async tryUnlock(pass) {
    try {
      const content = await this.decrypt(pass);
      Object.assign(window, content); // ANCHORS, SCENES, IAM_LINES… global olarak yerleşir
      localStorage.setItem(this.PASS_KEY, pass);
      return true;
    } catch { return false; }
  },

  open() {
    const overlay = document.getElementById('lock-overlay');
    const input = document.getElementById('lock-input');
    const btn = document.getElementById('lock-btn');
    const msg = document.getElementById('lock-msg');

    const succeed = () => {
      overlay.classList.add('unlocked'); // kapılar açılır
      setTimeout(() => overlay.remove(), 1250);
      startApp();
    };

    const attempt = async () => {
      const v = input.value.trim();
      if (!v) return;
      btn.disabled = true;
      msg.textContent = '';
      if (await this.tryUnlock(v)) succeed();
      else {
        btn.disabled = false;
        msg.textContent = 'Bu anahtar bu kapıyı açmıyor.';
        input.select();
      }
    };

    btn.addEventListener('click', attempt);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });

    // bu cihazda daha önce açıldıysa sessizce aç
    const saved = localStorage.getItem(this.PASS_KEY);
    if (saved) {
      this.tryUnlock(saved).then(ok => {
        if (ok) succeed();
        else { localStorage.removeItem(this.PASS_KEY); input.focus(); }
      });
    } else input.focus();
  },
};

document.addEventListener('DOMContentLoaded', () => Vault.open());
