# Tamamlandı ✦

Neville Goddard'ın Law of Assumption prensipleri ve r/NevilleGoddard'ın klasik teknikleri üzerine kurulu, kalıcı hafızalı, kişisel bir sabah ritüeli sitesi.

> İçeride bitti. Dışarısı sadece yetişiyor.

## Mahremiyet modeli

- **Kişisel içerik repoda yoktur.** Çapalar, sahneler, tasdikler — hepsi `js/content.enc.js` içinde AES-256-GCM ile mühürlüdür (PBKDF2, 300.000 iterasyon). Repoyu ya da siteyi gezen biri yalnızca bir kilit ekranı ve anlamsız şifreli veri görür.
- Site açılışta **anahtar kelime** ister; doğru girildiğinde içerik tarayıcıda çözülür ve o cihazda hatırlanır.
- Kayıtlar (onaylar, revizyonlar, senaryolar…) Supabase'e gider; erişim anon key'ledir ve key repoya asla commit'lenmez — `#sb=` kurulum linkiyle cihaza bir kere tanımlanır.

### İçeriği güncellemek

Düz metin içerik dosyası repoda tutulmaz. Güncellemek için lokalde:

```
node scripts/encrypt.mjs content.json '<anahtar-kelime>' > js/content.enc.js
```

`content.json`'ı commit'leme — sadece şifreli çıktıyı commit'le.

## Ritüelin akışı

| Bölüm | Teknik | Ne yapar |
|---|---|---|
| **Bugünün Varsayımı** | Law of Assumption | Her gün rotasyonla gelen, "olmuş bitmiş" dilinde kimlik çapası |
| **"Ne harika değil mi?"** | Isn't It Wonderful (Abdullah) | Dokundukça değişen hayret-şükür kalıbı |
| **BEN** | Self-concept / I AM | Dokunarak ilerlenen kimlik beyanları |
| **Tamamlananlar** | Living in the End | Dilek listesi değil; henüz haber gelmemiş gerçekler |
| **İmajinal Sahne** | SATS + Ninni Modu | Sahne seç, 68 saniye içinde yaşa |
| **Robotik Tasdik** | Robotic Affirming (Edward Art) | Duygu beklemeden tekrar; 21'de mühür |
| **Hatırlıyor Musun?** | I Remember When | Dileği eski bir anı gibi anlatma |
| **Zihinsel Diyet** | Mental Diet | Yakalanıp çevrilen düşünceler — sadece zaferler |
| **Senaryo** | Scripting | Günü olmuş bitmiş halinin ağzından yazma |
| **3D Onayları** | Evidence log | Dış dünyanın bıraktığı izlerin arşivi |
| **Revizyon** | Revision | Günü istediğin gibi yeniden yazıp mühürleme |
| **Merdiven Deneyi** | Neville'in ladder experiment'i | Yasanın ispatı — gece takibi + 3D kanıt kaydı |
| **Arşiv** | — | Tüm kayıtların filtrelenebilir zaman çizelgesi |
| **"3D gürültüsü mü?"** | No Objections + EIYPO | Şüphe anında itiraz-kabul-edilmez protokolü |

## Kalıcı hafıza (Supabase)

Site bağlantısız da tam çalışır (localStorage). Kalıcı, cihazlar-arası hafıza için bir kere kurulum:

1. [supabase.com](https://supabase.com) → ücretsiz proje aç
2. **SQL Editor** → repodaki [`supabase/schema.sql`](supabase/schema.sql) içeriğini yapıştır → **Run**
3. Site adresinin sonuna `#sb=<proje-url>|<anon-key>` ekleyip bir kere aç — yapılandırma cihaza kaydolur, adres çubuğundan anında silinir. (Ya da ⚙ panelinden elle gir.)

Yeşil nokta yandığında her kayıt buluta eşitlenir; bağlantı koptuğunda yerelde birikir, sonraki açılışta eşitlenir.

## Çalıştırma

`index.html`'i tarayıcıda aç, ya da GitHub Pages ile yayınla:
**Settings → Pages → Deploy from branch**. Telefonda ana ekrana kısayol ekle — her sabah tek dokunuş.

## Yapı

```
index.html          — sayfa + kilit ekranı
css/style.css       — gece→şafak teması
js/content.enc.js   — mühürlü kişisel içerik (AES-256-GCM)
js/vault.js         — kasa: çözme + kilit ekranı akışı
js/storage.js       — localStorage + Supabase REST eşitleme katmanı
js/app.js           — uygulama mantığı
scripts/encrypt.mjs — içerik mühürleme aracı
supabase/schema.sql — tek tablo: manifest_entries
```
