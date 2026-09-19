# Canlıya Alma (Deploy) Rehberi

Bu proje bir Next.js 16 uygulamasıdır; veritabanı olarak Supabase (Postgres)
kullanır. Önerilen barındırma: **Vercel** (ücretsiz Hobby planı yeterli).

## 0. Ön koşullar

- GitHub'da bu repo (`yigit1239999999/Manifest`) — mevcut ✅
- Supabase projesi (aktif, paused değil) — mevcut ✅
- Bir Vercel hesabı (yoksa GitHub ile 1 dakikada açılır)

## 1. Vercel'e bağla (tek seferlik, ~5 dk)

1. Tarayıcıda **https://vercel.com/new** adresini aç.
2. **Continue with GitHub** ile giriş yap.
3. "Import Git Repository" listesinden **Manifest**'i seç
   (görünmüyorsa *Adjust GitHub App Permissions* ile repoya erişim ver).
4. Framework otomatik **Next.js** algılanır — build ayarlarına dokunma.
   `package.json` içindeki `vercel-build` script'i sayesinde her deploy'da
   önce `prisma migrate deploy` çalışır (şema otomatik güncellenir), sonra
   uygulama derlenir.
5. **Environment Variables** bölümüne şunları ekle
   (değerler lokaldeki `.env` dosyanla aynı):

   | Ad             | Değer                                                                 |
   |----------------|-----------------------------------------------------------------------|
   | `DATABASE_URL` | `postgresql://postgres.<ref>:<şifre>@<bölge>.pooler.supabase.com:6543/postgres?pgbouncer=true` |
   | `DIRECT_URL`   | `postgresql://postgres.<ref>:<şifre>@<bölge>.pooler.supabase.com:5432/postgres` |
   | `AUTH_SECRET`  | En az 32 karakter rastgele değer — üretmek için: `openssl rand -base64 33` |

   İsteğe bağlı: `SENTRY_DSN` (hata takibi), `LOG_LEVEL` (`info` varsayılan).

   > Lokal `.env`'i görmek için: `cat .env`. `AUTH_SECRET` için canlıda
   > lokaldekinden FARKLI, yeni üretilmiş bir değer kullanmak daha güvenlidir.

6. **Deploy**'a bas. 2–3 dakika içinde yeşil "Congratulations" ekranı gelir.

## 2. Tarayıcıda açma

1. Deploy bitince Vercel sana `https://manifest-<hesap>.vercel.app` gibi bir
   adres verir (proje sayfasında **Visit** butonu). Bu adresi tarayıcıda aç.
2. `/sign-up` sayfasından ilk klinik hesabını oluştur
   (Klinik adı + ad + email + en az 8 karakter şifre).
3. Giriş sonrası panel açılır; sağ üstten dil (EN/TR) ve tema seçilebilir.
4. Telefonda da aynı adres çalışır. İstersen Vercel → Settings → Domains
   üzerinden kendi alan adını bağlayabilirsin.

Hızlı sağlık kontrolü: `https://<adresin>/api/health` → `{"db":"ok"}`
dönmeli. 503 dönerse Supabase erişimi/env değişkenlerini kontrol et.

## 3. Bundan sonrası

- `main` dalına atılan **her push otomatik deploy olur** (migration dahil).
- Her PR için Vercel otomatik önizleme adresi üretir.
- Supabase ücretsiz planda ~1 hafta hareketsizlikte duraklar; canlı
  kullanımda istekler geldiği için genelde sorun olmaz, yine de
  duraklarsa dashboard'dan **Restore** de.

## Lokalde çalıştırma (hatırlatma)

```bash
npm install
npm run db:migrate:deploy   # şemayı uygula
npm run dev                 # http://localhost:3000
```

## 4. WhatsApp bildirimleri (isteğe bağlı)

Uygulama, randevu onayı / hatırlatması ve hayvan hatırlatmalarını (aşı zamanı,
kontrol vb.) müşterinin dilinde WhatsApp ile gönderebilir. Zamanlama
**Ayarlar → WhatsApp bildirimleri**'nden, müşteri bazında açma/kapama ise
müşteri kartından yapılır.

- **Bağlantı yokken:** randevu sayfasındaki "WhatsApp'ta aç" düğmesi hazır
  mesajı WhatsApp'ta açar; personel tek dokunuşla gönderir. Ek kurulum gerekmez.
- **Otomatik gönderim için** (Meta WhatsApp Cloud API) Vercel env'e ekleyin:

  | Ad                          | Değer                                                  |
  |-----------------------------|--------------------------------------------------------|
  | `WHATSAPP_ACCESS_TOKEN`     | Meta Business → WhatsApp → API Setup'taki kalıcı token |
  | `WHATSAPP_PHONE_NUMBER_ID`  | Aynı ekrandaki "Phone number ID"                       |
  | `CRON_SECRET`               | Rastgele ≥16 karakter (`openssl rand -hex 24`)         |

  Not: Meta, işletmenin başlattığı sohbetlerde **onaylı şablon** ister; onay
  ve hatırlatma metinlerini Meta Business Manager'da şablon olarak kaydedin.

- **Zamanlayıcı:** `vercel.json` günde bir (05:00 UTC) `/api/cron/reminders`
  çağırır (Hobby planı günlük cron'a izin verir). "Randevudan X saat önce"
  modunu kullanacaksanız daha sık tetikleyin: Vercel Pro'da `*/15 * * * *`,
  ya da cron-job.org gibi ücretsiz bir servisten 15 dakikada bir
  `Authorization: Bearer <CRON_SECRET>` başlığıyla aynı adrese GET isteği.
