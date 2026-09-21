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

## 4. Bildirim mesajları: SMS (önerilen) ve WhatsApp

Randevu onayı/hatırlatması ve hayvan hatırlatmaları (aşı zamanı, kontrol vb.)
müşterinin dilinde gönderilir. Zamanlama ve kanal **Ayarlar → Bildirim
mesajları**'nden, müşteri bazında açma/kapama müşteri kartından yapılır.

### SMS (Netgsm)
1. netgsm.com.tr'de kurumsal hesap açın; "Mesaj başlığı" (gönderici adı, örn.
   `PETTRACK` veya klinik adı, en fazla 11 karakter) tanımlatın.
2. Vercel env'e ekleyin:

   | Ad                 | Değer                                   |
   |--------------------|-----------------------------------------|
   | `SMS_PROVIDER`     | `netgsm`                                |
   | `NETGSM_USERCODE`  | Netgsm kullanıcı kodu (API kullanıcısı) |
   | `NETGSM_PASSWORD`  | Netgsm API şifresi                      |
   | `NETGSM_MSGHEADER` | Onaylı mesaj başlığı                    |
   | `CRON_SECRET`      | Rastgele ≥16 karakter (`openssl rand -hex 24`) |

   Geliştirme ortamında `SMS_PROVIDER=log` mesajı göndermek yerine sunucu
   loguna yazar; tüm akış ücretsiz denenebilir.
3. Netgsm panelinde API erişimi için IP kısıtı varsa Vercel çıkış IP'lerini
   ekleyin veya kısıtı kaldırın (hata kodu 30 = kimlik/IP).

Mevzuat notu: mevcut hizmet ilişkisine dair bilgilendirme mesajları (randevu,
hatırlatma) 6563 sayılı kanunda ticari ileti sayılmaz; İYS onayı gerekmez.
Kampanya/pazarlama gönderimi için İYS gerekir; uygulama bunu göndermez.

### WhatsApp Business (isteğe bağlı)
Kanal olarak WhatsApp seçilirse Meta Cloud API gerekir: `WHATSAPP_ACCESS_TOKEN`
ve `WHATSAPP_PHONE_NUMBER_ID`. Meta, işletmenin başlattığı sohbetlerde onaylı
şablon ister. Bağlantı olmasa da randevu sayfasındaki "WhatsApp'ta aç" düğmesi
hazır mesajı WhatsApp'ta açar (elle gönderim), bu her zaman çalışır.

### Zamanlayıcı

**Hiçbir şey süpürgeyi çağırmıyorsa hiçbir hatırlatma gitmez.** Kayıtlar
birikir, ekran doğru görünür, tek eksik olan çağrıdır. Bu bölüm o çağrının
nasıl kurulacağını anlatır.

**Birincil yol: dış zamanlayıcı, 15 dakikada bir.** cron-job.org gibi
ücretsiz bir servisten, `Authorization: Bearer <CRON_SECRET>` başlığıyla
`https://<alan-adiniz>/api/cron/reminders` adresine GET. Onbeş dakika,
"randevudan X saat önce" modunun da "sabah saat 9'da" modunun da fark
edilir bir gecikmeye uğramaması için yeterli sıklıktır.

**Yedek yol: `vercel.json`, günde bir, 06:15 UTC.** Hobby planı yalnız
günlük cron'a izin verir, ve bu satır dış servis sustuğunda hatırlatmaların
tamamen durmasın diye vardır — birincil yol değildir.

**Saat seçiminin sebebi, ve dikkat edilecek tuzak:** hatırlatma varsayılanı
klinik saatiyle **09:00**'dur, İstanbul'da bu **06:00 UTC**'ye denk gelir.
Günlük cron bundan **önce** koşarsa ("05:00 UTC = 08:00 İstanbul" gibi)
süpürge her seferinde "saati gelmemiş" deyip geçer, bir sonraki koşu 24 saat
sonradır, ve sabah 09:00 gönderimi **yapısal olarak bir gün geç** olur —
hiçbir hata kaydı bırakmadan. 06:15 UTC, gönderim saatinden hemen sonradır.
Klinik başka bir saat dilimindeyse ya da `morningHour` değiştirildiyse bu
hesabı yeniden yapın; yedek cron tek bir saat dilimini kollayabilir, dış
zamanlayıcı hepsini kollar.

**Yerelde:** `npm run sweep` süpürgeyi bir kez çalıştırır ve ne yaptığını
insan okunur biçimde yazar (kaç aday vardı, kaçı hangi sebeple elendi, kaç
mesaj yazıldı). `npm run sweep:watch` aynı şeyi 15 dakikada bir yapar ve
terminalde durur; Ctrl-C ile biter. Geliştirme sırasında zamanlayıcı yerine
bu geçer — arka planda bir şey kurmaz, çalıştığı ekranda görünür.

Gönderimler tekrarlanmaz; başarısız olanlar en fazla 3 kez, aralarında en az
6 saat bırakılarak yeniden denenir. Bu yüzden 15 dakikada bir çağırmak
mükerrer mesaj üretmez.
