# PetTrack — sürüm planı ve sıralama

Sahibi: `value` (Product Owner). Sıralama, "bitti" tanımı, sürüm içeriği ve
hat dağılımı buradan yönetilir. Bir iş kapandıkça durumu burada güncellenir.
Ekip ilkeleri: `.claude/TEAM.md`.

---

## Sürüm: "Güvenilir döngü"

**Vaat (tek cümle):** Klinik uygulamayı açtığında yanlış bilgi görmüyor,
yanlış mesaj göndermiyor ve hatırlatmaları gerçekten gidiyor.

**Ürün tezi:** Kliniğin kaybettiği yer kayıt değil, **dönüş** — aşısı gelmeyen
hayvan, dikişi alınmayan hasta, kontrolü atlanan kronik. Kayıt tarafı (SOAP,
vitaller, aşı, reçete, teşhis) zaten iyi kurulmuş. Bu sürüm hayvanı geri
getiren döngüyü kapatır; ön şartı döngünün **güvenilir** olmasıdır, çünkü
güvenilmeyen bir döngü olmayandan kötüdür.

**Sıralama ilkesi:** önce yanlış veri ve yanlış mesaj üretenler → sonra
döngüyü hiç çalışmaz halde tutanlar → sonra döngünün girdisi ve kanalı →
en sonda görünürlük ve yapı borcu.

---

## İki hat ve sınırları

- **A hattı — `dev`:** `modules/**`, `lib/**`, `prisma/**`, `app/api/**`.
- **B hattı — `dev-ui`:** `components/ui/**`, tasarım primitifleri,
  `app/globals.css`, durum dosyaları (`loading`/`error`/`not-found`).
- **Paylaşımlı:** `messages/*.json` ve `app/(app)/**/page.tsx`. Dokunmadan
  önce diğerine haber verilir; anlaşmazlıkta hakem `value`.

**Hakem kuralı (value, bu turda kondu):** `components/forms/**` **A
hattınındır.** Form, verinin girdiği yoldur; doğrulama, alan adları ve
gönderim mantığı veri işidir. `components/ui/**` ve tasarım primitifleri B
hattınındır. Bir formun *görünümü* B'yi, *davranışı* A'yı ilgilendiriyorsa
B primitifi verir, A formda kullanır.

Katmanlar tek hat varsayımıyla dizilmişti; **artık iki hat paralel akar.**
B hattı Katman 0'daki para/veri işlerini beklemez. Aşağıdaki tablolarda
"Hat" sütunu bunu gösterir; hatlar arası bekleme yalnızca "Bekler" sütununda
yazanlarla sınırlıdır.

---

## Katman 0 — yanlış veri, yanlış mesaj, geri alınamaz

| # | İş | Hat | Durum | Bekler | Neden bu katmanda |
|---|---|---|---|---|---|
| 1 | Tıbbi kaydın sessizce kaydedilmemesi (P0) | A | açık | — | Kullanıcı kaydettiğini sanıyor; veri yok. |
| 2 | Tahsilat tutarının 100 kat küçük kaydedilmesi (P0) | A | açık | — | Ödeme formu ham kuruş gönderiyor; sessiz para kaybı. |
| 3 | `parseMoneyInput` yerelleştirilmiş girdiyi bozuyor (C2) | A | açık | — | "1.234,56" → binde bir. 2 ile aynı aile, birlikte ele alınır. |
| 4 | Panelin kalan borcu yanlış göstermesi | A | açık | — | Tahsilatlar düşülmüyor; alacak olduğundan yüksek. |
| 5 | Liste yeniden doğrulama kök nedeni | A | açık | — | Kullanıcıya mükerrer kayıt düşürttüğü için görünüm değil veri sorunu. |
| 6 | Telefon: doğrulama yok + ülke dışı biçimler bozuk | A | açık | — | "sabit hat yok" numara olarak kaydediliyor; BAE numarası ülke kodsuz kabul ediliyor. Tek yoldan geçsin. |
| 7 | Vefat/arşiv/sahip değişikliği hijyeni | A | açık | — | Ölen hayvan için sahibine hatırlatma gidiyor. Tek mesaj güveni bitirir. |
| 8 | `setStaffActive` sunucu tarafında korumasız | A | açık | — | Son yönetici kliniği kilitleyebiliyor; geri dönüşü elle müdahale. |
| 8b | İptal/tamamlanmış randevu hâlâ gönderime hazır duruyor | A | açık | — | İptal edilmiş randevuda "randevunuz oluşturulmuştur" mesajı tek tıkla gönderilebiliyor. Yanlış mesaj ailesi; şablon işinden bağımsız, şablon hiç eklenmese de kapanmalı. |
| 9 | DESIGN-1 `Callout` primitifi | B | açık | — | Uyarı kutusu 13 yerde kopyalanmış; koyu tema karşılığı yok. |
| 10 | DESIGN-1/2. aşama: hayvan uyarısının doğru ekranlara taşınması | B | açık | 9 | "Isırır/alerjik" yalnızca hayvan detayında. Risk insana fiziksel zarar. Sayfa dosyaları paylaşımlı: A'ya haber ver. |
| 11 | DESIGN-6 panel grafikleri | B | açık | — | Boş klinikte sıfır çubuk çiziyor; `Math.max(pct,2)` yüzünden dolu klinikte de 0 ile 1 aynı görünüyor. |

## Katman 1 — döngü hiç dönmüyor

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 12 | R1: cron saatlik (`vercel.json`) | A | açık | — | Günde tek çalışma 05:00 UTC = İstanbul 08:00; varsayılan mod "gün içi 09:00" olduğu için hatırlatma hiç bulunmuyor. Tek satır. |
| 13 | Saat dilimi doğrulaması | A | açık | 12 | `morningOf` klinik saatine göre; R1 tek başına yetmez, ikisi birlikte doğrulanır. |

## Katman 2 — güvenilirlik ve kimlik

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 14 | Rıza: `messagingOptIn` + kapalı varsayılan (tek migration) | A | devam | — | Varsayılan kapatıldı ve form metni "Müşteri WhatsApp mesajlarına onay verdi" olarak yeniden yazıldı. Kalan: alan adının `messagingOptIn`'e dönmesi ve mevcut satırların aynı migration'da kapatılması. |
| 15 | Şifre değiştirme | A | açık | — | Şifreler yöneticideyken hesaplar kişiye özel değil; denetim kaydı kimi yazdığını bilmiyor. |
| 16 | R2: başarısız gönderimin yeniden denenmesi | A | açık | — | FAILED kaydı adayı kalıcı bloke ediyor; en fazla 3 deneme, aralarında ≥6 saat. |
| 17 | Onay dialogu primitifi | B | açık | — | A hattı R4a'daki "tekrar tarihini temizle" eylemini buna bağlayacak. |
| 18 | DESIGN-3 `StatusBadge` | B | açık | — | **R4a'dan önce bitmeli**: rozet ayrımı olmadan otomatik ve elle hatırlatmalar ayırt edilemez doğar. |
| 19 | DESIGN-4 durum bütünlüğü | B | açık | — | **R4a'dan önce bitmeli**: `/reminders` ile aynı dosyaya dokunuyor. |

## Katman 3 — döngünün girdisi ve kapanışı

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 20 | R4a-1: girdinin kendiliğinden dolması | A | açık | — | Ölçüldü: son 90 günde aşıların %20'sinde tekrar tarihi dolu. Asıl iş üretim değil, alanın dolması. |
| 21 | R4a-2: türetme + kapanış + durum modeli (eski R4b dahil) | A | açık | 17, 18, 19, 20 | Kapanış kavramı olmadan "bitti" ölçülemez. Bağ kesilmez: bağ ucuz, geçmiş veri geri getirilemez. `/reminders` sayfası paylaşımlı. |

## Katman 4 — kanal (çekirdek)

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 22 | S1: `lib/sms/` + `MessageChannel.SMS` + Netgsm adaptörü | A | açık | — | **Kritik:** `.env` yalnızca `AUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL` içeriyor; WhatsApp hiç yapılandırılmamış, `runReminderSweep` erken dönüyor. Bugün hiçbir otomatik mesaj gidemez, R1 düzelse bile. |
| 23 | S2: SMS şablonları + segment hesabı | A | açık | 22 | En fazla iki segment, Türkçe karakter bozulmaz, satış dili yok. Doğum günü otomatik SMS'e girmez. |
| 24 | S4: sweep'in kanal seçimi | A | açık | 22, 23 | Otomatik yol SMS'e taşınır; manuel WhatsApp aynen kalır. |
| 25 | S3: SMS ayar yüzeyi (gönderen başlığı, segment/maliyet göstergesi) | B (+A kaydetme) | açık | 22 | **Kesilebilir**: adaptör env ile çalışır, ayar yüzeyi olmadan da gönderim mümkün. |

## Katman 5 — görünürlük ve kurulum

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 26 | DESIGN-2 `DataTable` | B | açık | — | Gün planı sunumundan önce: yoksa dokuzuncu kopyala-yapıştır tablo doğar. |
| 27 | Gün planı — "Tüm tarihler" regresyonu | A | açık | — | Düğme çalışmıyor; çalışmadığı sürece kullanıcı gün gün tıklamaya mahkûm. |
| 28 | Gün planı — tablo sunumu | B | açık | 26 | Varsayılan gün görünümü kararı kalıcı; "Tüm tarihler" ikincil görünüm. |
| 29 | C1: ülke alanı + türetilenlerin görünmesi + klinik yazma tarafı | A | açık | — | `modules/clinics/` altında yazma tarafı hiç yok; yanlış varsayılan bugün düzeltilemiyor. |
| 30 | Kurulum ekranı (boş klinikte panel yerine sıralı liste) | B | açık | — | 29 ile aynı paket ama farklı dosyalar; paralel gidebilir, panel sayfası paylaşımlı. |
| 31 | DESIGN-5 mobil gezinme erişilebilirliği | B | açık | — | Küçük. |

## Katman 6 — para doğruluğu

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 32 | C4 `Invoice.currency` | A | açık | 29 | **C1'den sonra** — ters sırada faturalara eski USD kopyalanır. |
| 33 | C3 `formatMoney` ondalık sabiti | A | açık | — | Kuruşsuz para birimlerinde yanlış görünüm. |

---

## Hatlar arası bekleme noktaları (yalnızca bunlar)

1. **18, 19 (B) → 21 (A).** `StatusBadge` ve durum bütünlüğü, R4a-2'nin
   `/reminders` işinden önce bitmeli. B hattı bu ikisini erken alsın.
2. **17 (B) → 21 (A).** Onay dialogu primitifi, "aşı kaydındaki tekrar
   tarihini temizle" eylemine bağlanacak.
3. **26 (B) → 28 (B), 27 (A) bağımsız.** Regresyon sunumu beklemez.
4. **29 (A) → 32 (A).** Para birimi dönüşümü fatura kolonundan önce.
5. **9 (B) → 10 (B).** Primitif önce, yerleştirme sonra.

Bunların dışında iki hat birbirini beklemez. Paylaşımlı dosyalarda
(`messages/*.json`, `app/(app)/**/page.tsx`) sıra değil, haberleşme kuralı
geçerlidir.

## Kesme çizgisi (iki hatta göre güncellendi)

- **Kesilmez:** Katman 0, 1, 2, 3 ve Katman 4'ün ilk üçü (22, 23, 24).
  Bunlar olmadan sürümün vaadi tutmaz.
- **Kesme sırası:** önce 25 (SMS ayar yüzeyi), sonra Katman 6, sonra 31 ve
  30, sonra 28. Gün planının sunum cilası kesilse de 27 (regresyon) kalır.
- **Katman 0'dan hiçbir şey kesilmez** — iki hat olması bu kuralı değiştirmez,
  yalnızca daha erken bitmesini sağlar.

## Sürüm dışı (bir sonraki sürümün başlangıcı)

- **R3** — hatırlatma kurallarının `notifications`'tan `reminders`'a taşınması.
  Dışarıdan görünmeyen yapı borcu.
- **"Geri dönmeyen hayvanlar" ekranı.** Bağ bu sürümde kuruluyor, ekran sonra.
- **Haftalık doluluk görünümü.** Gün görünümü varsayılan kalıyor; haftalık
  görünümün gerçekten sorulup sorulmadığını bilmiyoruz — kullanıcıya soruldu.
- **Fatura/tahsilat işleri**, **gün sonu kasa**, **randevu çakışma uyarısı**,
  **acil vaka akışı**, **KDV oranı ayarı**, **`Visit.followupAt` döngüsü**
  (R4a'nın kardeşi — aynı kalıp, aynı tedavi).
- **İptal/erteleme mesaj şablonları.** Metinler hazır ve rafta; WhatsApp'a
  yeni yatırım yapılmıyor.

## "Bitti" tanımı

Çoğu işte pm'in kabul testi yeterlidir. Üç işte yetmez:

1. **R1 (12)** — commit yetmez: `message_logs` tablosunda **gerçek bir
   gönderim kaydı** görünmeli. Kanal yapılandırılmadığı için bu 22/23/24'e
   bağlıdır.
2. **R4a (20, 21)** — hatırlatmanın doğması yetmez: müşteriye ulaşmalı ve
   hayvan geldiğinde kapanmalı; kapanış nedeni okunabilmeli.
3. **Rıza işi (14)** — form değişikliği yetmez: alan adının geçtiği hiçbir
   filtre yarım kalmamalı, yarım kalırsa otomatik gönderim sessizce durur.

## Ölçüm noktaları

Yöntem: `node --env-file=.env scripts/loop-metrics.mjs` (salt okuma).
Taban (20 Eylül 2026, sürüm öncesi):

| Ölçü | Bugün | Hedef |
|---|---|---|
| Gönderilmiş mesaj (`message_logs`) | 0 | > 0 (R1 + kanal) |
| Son 90 günde tekrar tarihi dolu aşı | %20 (1/5) | belirgin artış (R4a-1) |
| Takip tarihi dolu vizit | 0/5 | ölçülebilir hale gelmesi |
| Tarihi geçmiş randevuların durumu | hepsi `SCHEDULED` | kapatılan randevu oranı > 0 |
| Hatırlatma kapanış nedeni dağılımı | alan yok | karşılandı / randevu verildi / elle |

Aşı geri dönüş oranı ve kontrol dönüş oranı bugün **hesaplanamıyor** (tekrar
tarihi geçmiş aşı 0, takip tarihi girilmiş vizit 0). Sürüm sonrası ilk kez
ölçülebilir olacak.

## Doğrulanmış, iş gerektirmeyen

- **Kiracı izolasyonu sağlam.** `modules/` altındaki tüm prisma çağrıları
  tarandı: liste sorguları `clinicId` içeren ortak `where`'den geçiyor, tek
  kayıt güncellemeleri önce `findFirst({id, clinicId})` ile doğrulanıyor.
- **Klinik kaydı (SOAP, vitaller, aşı, reçete, teşhis) iyi kurulmuş.**
  Burada şu an yapılacak iş yok.
