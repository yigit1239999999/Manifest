# PetTrack — sürüm planı ve sıralama

Sahibi: `value` (Product Owner). Sıralama, "bitti" tanımı, sürüm içeriği ve
hat dağılımı buradan yönetilir. Bir iş kapandıkça durumu burada güncellenir.
Ekip ilkeleri: `.claude/TEAM.md`.

---

## Nerede kaldık (20 Eylül 2026 — önce burayı oku)

**1. Durum.** Sürüm "Güvenilir döngü", Katman 0'dayız. Kapanan işler: gün
planı (27), saat dilimi (13), `Callout` primitifi + sekiz formun süpürülmesi
(9), hayvan uyarısının doğru ekranlara taşınması (10), panel grafiklerinde
sıfırın çubuk çizmemesi (11), rızanın varsayılanının kapatılması (14'ün
yarısı). **İki deploy blokeri hâlâ açık:** tahsilat tutarının 100 kat küçük
kaydedilmesi (2) ve para biriminin USD olması (29). İkisi de A hattında ve
ikisi de "sessiz yanlış" sınıfından — sürüm bunlarla çıkamaz.

**2. Sırada ne var.**
- **A hattı (`dev`):** (1) tıbbi kaydın sessizce kaydedilmemesi → (2)
  tahsilat 100 kat + (3) `parseMoneyInput` birlikte → (4) panelin kalan
  borcu.
- **B hattı (`dev-ui`):** kalan iki formun `Callout`'a geçmesi
  (`reminder-form.tsx`, `invoice-form.tsx`) → DESIGN-3 `StatusBadge` (18) →
  DESIGN-4 durum bütünlüğü (19). Son ikisi **A hattının R4a'sını bekletiyor**,
  geciktirmesin.

**3. Yarım kalanlar.**
- **`Callout` süpürmesi yarım:** sekiz form geçti, `reminder-form.tsx` ve
  `invoice-form.tsx` hâlâ ham `border-destructive/30` kutusu taşıyor.
  DESIGN-1 "bitti" sayılmaz: eşik primitif değil, **15 çağrı yeri + form
  hatasının ekran okuyucuda duyurulması.**
- **Rıza işi yarım:** varsayılan kapatıldı ve mevcut kayıtlar migration ile
  kapatıldı (`_whatsapp_opt_in_backup` tablosunda geri alma verisi var), ama
  alan adı hâlâ `whatsappOptIn`. `messagingOptIn`'e dönüşü ayrı migration
  olarak duruyor; alan adının geçtiği **her** filtre taranmalı, yarım
  kalırsa otomatik gönderim sessizce durur.
- Çalışma ağacında commit edilmemiş değişiklikler var (sayfa dosyaları,
  `globals.css`, form bileşenleri).

**4. Bekleyen kullanıcı cevapları.** Beş soru açık, tamamı "Kullanıcıya
sorulacaklar" bölümünde. **En kritiği: ortalama vizit tutarı** — para
sürümünün büyüklük sırası ona bağlı, o gelene kadar tahmin üretilmeyecek.

**5. Karar verilmiş, uygulanmamış.**
- Performans bütçesi rota başına konacak ve kademeli indirilecek; pm'den
  rota başına gerçek süreler bekleniyor (6000 ms bir bütçe değil, tavan).
- `fullName()` ve `format.ts` ternary temizliği **para sürümünün ilk ekranı
  yazılmadan önce** inecek.
- `--destructive` kontrast düzeltmesi, kalan iki form taşınmadan önce.
- Panel grafiklerinde son çubuğun kısmi dönem olduğunun görünmesi.
- İptal/tamamlanmış randevuda gönderim kartının gizlenmesi (8b).

**6. Bir sonraki oturumda ilk yapılacak tek şey:** **tahsilat tutarının 100
kat küçük kaydedilmesi ile `parseMoneyInput` birlikte düzeltilecek** — para
sessizce yanlış kaydedildiği sürece diğer hiçbir işin sırası tartışılmaz.

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
| 7 | Vefat/arşiv/sahip değişikliği hijyeni | A | açık | — | Ölen hayvan için sahibine hatırlatma gidiyor. Tek mesaj güveni bitirir. **Üçü farklı davranır:** vefat ve arşiv **durum** (ekranın ağırlığını düşürür, otomatik gönderimi durdurur), sahip değişikliği **olay** (yalnızca akışa satır ekler; durum olarak gösterilirse hayvanın şu anki sahibi belirsizmiş gibi okunur). **Sıra uyarısı:** hayvan kartındaki "bu hayvan için hatırlatma oluşturulmaz, mesaj gönderilmez" cümlesi bu iş inmeden yayına girmemeli — yoksa ekran görünür bir vaat verip arkasını tutmaz. |
| 8 | `setStaffActive` sunucu tarafında korumasız | A | açık | — | Son yönetici kliniği kilitleyebiliyor; geri dönüşü elle müdahale. |
| 8b | İptal/tamamlanmış randevu hâlâ gönderime hazır duruyor | A | açık | — | İptal edilmiş randevuda "randevunuz oluşturulmuştur" mesajı tek tıkla gönderilebiliyor. Yanlış mesaj ailesi; şablon işinden bağımsız, şablon hiç eklenmese de kapanmalı. |
| 9 | DESIGN-1 `Callout` primitifi | B | kısmen (dev-ui) — `0bf959f` primitif+`--warning`+`Field`, `373ad28` 8 form kutusu, `38d610b` 2 sayfa uyarısı, `7259681` `--destructive` AA. Kalan 4 çağrı yeri A hattında: `invoice-form:49,:54`, `reminder-form:57`, `appointments/[id]:113` | — | Uyarı kutusu 13 yerde kopyalanmış; koyu tema karşılığı yok. |
| 10 | DESIGN-1/2. aşama: hayvan uyarısının doğru ekranlara taşınması | B | kısmen (dev-ui) — `5efbd84` `pets/[id]` (gömülü kopya kaldırıldı, `PageHeader` altına taşındı) + `visits/[id]`. Düğme etiketi de düzeldi (`7259681`). Kalan: `appointments/[id]` (A hattında açık) ve randevu listesi (`modules/appointments/queries.ts` select'ine `alerts` eklenmesi A hattından istendi) | 9 | "Isırır/alerjik" yalnızca hayvan detayında. Risk insana fiziksel zarar. Sayfa dosyaları paylaşımlı: A'ya haber ver. **Aynı dosyada iliştirilecek küçük kusur:** `pets/[id]/page.tsx:115-120`'deki düğme "Vizitler" (`t("tabs.visits")`) adını taşıyor ama yeni vizit formunu açıyor — sekme etiketi düğme etiketi olarak kullanılmış, eylem olduğu bile okunmuyor (TEAM.md 25). "Yeni vizit" olacak. Ayrı iş açılmadı; aynı dosyaya ikinci kez gitmeyelim. |
| 11 | DESIGN-6 panel grafikleri | B | kısmen (dev-ui) — `b5bc062` sıfır kova çizilmiyor, boş durum toplam üzerinden, grafiğe `role="img"` + seri adı. Kalan: gelir grafiğinin boş durum metni (ux'te) | — | Boş klinikte sıfır çubuk çiziyor; `Math.max(pct,2)` yüzünden dolu klinikte de 0 ile 1 aynı görünüyor. |

## Katman 1 — döngü hiç dönmüyor

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 12 | R1: cron saatlik (`vercel.json`) | A | açık | — | Günde tek çalışma 05:00 UTC = İstanbul 08:00; varsayılan mod "gün içi 09:00" olduğu için hatırlatma hiç bulunmuyor. Tek satır. |
| 13 | Saat dilimi doğrulaması | A | **çıktı, testte** | 12 | `f072e90` + `1d4046b`: girdi, saklama, ekran ve mesaj aynı saati söylüyor; klinik varsayılanı `Europe/Istanbul`. R1 inince birlikte doğrulanacak. |

## Katman 2 — güvenilirlik ve kimlik

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 14 | Rıza: `messagingOptIn` + kapalı varsayılan | A | devam | — | `f072e90`: varsayılan kapatıldı, mevcut kayıtlar `20260920100100_whatsapp_opt_in_default_off` ile kapatıldı (eski değerler `_whatsapp_opt_in_backup` tablosunda, geri alma SQL'i yorumda), form metni rıza kaydı gibi okunuyor, ana anahtar metni netleşti. **Kalan:** alan adının `messagingOptIn`'e dönmesi — artık ayrı bir migration, çünkü varsayılan işi indi. |
| 14b | Rızanın ne zaman ve hangi yolla alındığının kaydı | A | açık | 14 | Bugün çıplak boolean; rızanın ispatı zaman ve kaynaktır. Eklemeli kolon, veri dönüşümü yok. Global (a) sınıfı. |
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
| 21b | R4a-3: `Visit.followupAt` aynı kalıba bağlanır | A | açık | 21 | **Kesme çizgisinin altında.** R4a ile aynı bileşen ve aynı desen; tasarım sıcakken ek maliyeti sıfıra yakın. **Gerekçe kullanıcı cevabıyla güncellendi:** veteriner takibi bugün *fark etmiyor* değil — **aklında tutuyor ya da deftere/telefona not alıyor.** Yani alışkanlık var, kayıt yok. Bu üç şeyi değiştiriyor: (1) tasarımın işi alışkanlık kurmak değil, var olanı uygulamaya taşımak — en pahalı tasarım işinden kaçınıyoruz; (2) kabul oranı yüksek, çünkü veterinerden yeni davranış istemiyoruz; (3) **klinik sahibine söylenecek cümle:** o takipler bugün hiçbir yerde kayıtlı değil — veteriner izin alır, hastalanır ya da ayrılırsa hepsi kaybolur. **Risk:** kişisel hafızadan sisteme geçiş, ancak sistem en az hafıza kadar güvenilirse tutar; uygulama bir kez unutursa veteriner defterine döner ve bir daha dönmez. Yerleşim: yeni ekran değil, sabah gün planına iliştirilir (kurulu tek günlük alışkanlık o). **Akış kuralları (ux):** giriş noktası **vizitin sonu** — veteriner niyeti zaten orada oluşturuyor, sonradan hatırlatılıp doldurulan alan aklında tutmaktan zahmetli olur ve terk edilir; çıkış noktası sabah gün planı; ve ilk haftalarda hedef otomasyon değil **doğrulanabilirlik**: veteriner listeyi kendi defteriyle karşılaştırabilmeli, yani gizli filtre ve sessiz eleme yok. **Geçmiş tarih sessizce kaybolmaz** — takip tarihi geçtiyse satır listeden düşmez, daha görünür olur. Kaybolan tek bir satır "uygulama unuttu" demektir ve o noktada defter geri gelir. |

### R4a-2 ile R4a-3'ün kapanışı aynı değil (yazılmazsa yanlış uygulanır)

İki akışın **kapanış olayı** farklı, o yüzden kapanış yolu da farklı:

- **Aşı tekrarı (R4a-2):** kapanış nesnel ve zaten kaydediliyor — hayvan
  gelir, aşı kaydı düşer. Türetecek bir olay var, **kapanış türetilir**,
  kimseden emek istenmez.
- **Takip (R4a-3):** kapanış çoğu zaman **klinik kayıt üretmiyor.** "Aradım,
  dikiş iyiymiş, gelmesine gerek yok" bir vizit değil, bir telefon. Yalnızca
  türetmeye güvenilirse o satırlar hiç kapanmaz, liste bayatlar ve veteriner
  listeye güvenmeyi bırakır.

**Kural: türetilmiş kapanış önceliklidir, elle kapanış tamamlayıcıdır.**
Klinik kayıt varsa (vizit, aşı, tedavi) satır kendiliğinden kapanır, nedeni
"geldi". Klinik kayıt yoksa veteriner tek dokunuşla kapatır ve nedenini
seçer: **geldi · telefonla halloldu · gerek kalmadı.** Üç seçenek, serbest
metin değil — neden alanı ölçülebilir kalmalı ve tek dokunuşla geçilecek
kadar ucuz olmalı.
Bu, TEAM.md 15'i ihlal etmez: 15 ölçülebilirliği personelin disiplinine
bağlamayı yasaklar; burada elle kapanış bir ölçüm alanı değil **eylemin
kendisi**, ve alternatifi (satırın sonsuza kadar açık kalması) ölçümü
tamamen bozar.

**Ölçüm notu (value):** "telefonla halloldu" bir başarısızlık değil,
**kayıpsız kapanmış bir döngüdür** — takip amacına ulaşmış, hayvanın gelmesi
gerekmemiştir. Dönüş oranı hesaplanırken bu neden "gelmedi" sayılmayacak,
yoksa döngünün başarısını olduğundan düşük ölçeriz.

**Yetki kararı (value):** takip şeridini **resepsiyon da görür ve
kapatabilir.** Yeni bir yetki kademesi icat edilmiyor — `RECEPTIONIST` rolü
bugün zaten `reminders.write` ve `appointments.write` taşıyor
(`lib/permissions.ts:101-114`), yani mevcut model bu işi ona açmış durumda.
Pratikte "Ara" eylemini yapan da o; listeyi ondan gizlersek iş yapılmaz.
"Gerek kalmadı" seçeneğinin klinik bir yargı olması yasakla değil
**atıfla** çözülür: kapatan kişi ve neden denetim kaydına yazılır
(`writeAudit` deseni zaten var). Yasak koymak yerine kimin kapattığını
bilmek, hem ucuz hem geri dönülebilir.

**Erteleme: var, ama sessiz değil.** Erteleme tasarımın en kolay kaçış yolu;
satır sonsuza kadar itilebilir ve döngü sessizce ölür, üstelik liste temiz
göründüğü için fark edilmez. Kural: **erteleme tarihi taşır ve kendini
sayar** ("2 kez ertelendi"); üçüncüden sonra hâlâ açıksa satır gizlenmek
yerine daha görünür olur. Erteleme bir kapanış değil, bir gecikmedir.

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
| 27 | Gün planı | A | **çıktı, testte** | — | `2888d97`: bugüne açılıyor, gün okları, `?date=` URL'de, durum sekmeleri günü daraltıyor, "Tüm tarihler" eski listeye dönüyor, telefon `tel:` bağlantısıyla satırda. pm "Tüm tarihler çalışmıyor" demişti; dev çalıştığını söylüyor — **pm doğrulayacak.** |
| 28 | Gün planı — tablo sunumu (`DataTable`'a geçiş) | B | açık | 26 | Varsayılan gün görünümü kararı kalıcı; "Tüm tarihler" ikincil görünüm. |
| 29 | C1: ülke alanı + türetilenlerin görünmesi + klinik yazma tarafı | A | açık | — | `modules/clinics/` altında yazma tarafı hiç yok; yanlış varsayılan bugün düzeltilemiyor. |
| 30 | Kurulum ekranı (boş klinikte panel yerine sıralı liste) | B | açık | — | 29 ile aynı paket ama farklı dosyalar; paralel gidebilir, panel sayfası paylaşımlı. |
| 31 | DESIGN-5 mobil gezinme erişilebilirliği + `PageHeader` taşması | B | açık | — | Küçük. **Sebep bağı:** `PageHeader`'ın 390px'te eylemlerini ekran dışına atmasının kök nedeni, kod tabanında bir **menü/taşma primitifinin olmaması** (bkz. "Tasarım sistemi borcu"). Primitif yokken bu semptom düzeltilse de aynı sınıf yeniden doğar — taşacak eylemin gideceği bir yer yok. |

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
- **Kesme sırası:** önce 21b (`followupAt`), sonra 25 (SMS ayar yüzeyi),
  sonra Katman 6, sonra 31 ve 30, sonra 28. Gün planının sunum cilası kesilse
  de 27 (regresyon) kalır.
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

### Para sürümünün ölçüleri (taban bugünden alındı)

Aynı script'e eklendi; hepsi bugün çalışıyor.

| Ölçü | Bugün | Hedef |
|---|---|---|
| Fatura başına kalem | 1,00 (2 fatura, 2 kalem) | vizit başına yapılan işe yaklaşması |
| Vizit başına yapılan iş | 5 vizit, 2 tedavi + 1 teşhis | — (karşılaştırma tabanı) |
| Vizite bağlı fatura kalemi | **0 / 2** | türetme sonrası çoğunluk |
| Aynı hizmetin fiyat sapması | hesaplanamıyor (tekrar eden açıklama yok) | fiyat listesi sonrası sapma sıfıra yakın |

**Uyarı:** örneklem çok küçük, bunlar oran değil. Tek güvenilir bulgu
**0/2**: `InvoiceLine.visitId` bugün hiç yazılmıyor — vizit ile fatura
arasında veri düzeyinde hiçbir bağ yok. Diğer üçü sürüm öncesi gerçek veriyle
yeniden alınacak.

---

# Sonraki sürüm: "Kliniğin parası uygulamanın içinde kapansın"

**Vaat:** Fiyat kliniğin kendi listesinden gelir; vizitte yapılan iş elle
hatırlanmadan faturaya dönüşür; kimin borcu kaldığı görünür.

**Merkez: fiyat listesi. Türetme onun çıktısı.** (ux'in itirazıyla
değiştirildi — kanıt kabul edildi.) `Treatment` (`prisma/schema.prisma:425`)
ve `Diagnostic` (`:466`) modellerinde **fiyat alanı yok**; `InvoiceLine`'da
fiyat elle giriliyor. Yani bugün "vizitten faturaya türetme" yazarsak
üreteceği şey açıklaması dolu, **fiyatı boş** satırlardır — veteriner fiyatı
yine hafızadan yazar. Bu, R4a'da yakaladığımız kalıbın aynısı: türetme, var
olmayan bir girdinin üstüne kuruluyor. Ölçülerimden biri olan "aynı hizmetin
faturalar arasındaki fiyat sapması"nı da türetme değil, yalnızca fiyat listesi
düzeltir.
Sıra: fiyat listesi → tedavi/teşhis kaydında listeden seçim (`Treatment.code`
alanı zaten var ve boş; aşı formundaki `Combobox freeText` deseni ikinci kez
kullanılır) → türetme neredeyse bedava gelir, satır fiyatıyla birlikte doğar.
İlke R4a ile aynı: **fiyat da kliniğin kendi listesinden gelir, biz fiyat
icat etmeyiz.**

**Türetme yine de kesilmiyor**, çünkü fiyat listesinin çözmediği bir kaybı
o çözüyor: **unutulan kalem.** Yapılan tedavi faturaya hiç yazılmazsa fiyatın
doğru olması bir işe yaramaz. Ölçüsü: fatura başına kalem sayısı ile vizit
başına tedavi/teşhis sayısının karşılaştırılması.

**Neden bu, neden şimdi.** Bu sürüm hastayı geri getiren döngüyü kapatıyor.
Sıradaki doğal döngü paranınki ve bugün her adımında sızdırıyor: vizitte
yapılan tedaviler faturaya **hafızadan** yeniden yazılıyor (`InvoiceLine.visitId`
şemada var, hiç yazılmıyor), fiyat listesi yok (her kalem serbest metin ve
serbest fiyat), vadesi geçmiş alacak görünümü yok (`Invoice.dueAt` var, hiçbir
sorguda kullanılmıyor), müşteri kartında bakiye yok, gün sonu kasa kavramı hiç
yok. Panel "son 6 ay ödenen faturalar" gösteriyor; veterinerin sorusu bu değil,
"bugün kasada ne var".

**Ölçülebilir:** vizit başına fatura oranı, vizit ile fatura arasındaki süre,
aynı hizmetin faturalar arasındaki fiyat sapması, vadesi geçmiş alacak
yaşlandırması. Dördü de bugünkü veriden hesaplanabilir; sürüm öncesi taban
`scripts/loop-metrics.mjs`'e eklenecek.

**Merkez alınmayanlar ve neden:** acil vaka akışı ve çakışma kontrolü günü
yönetmeye ait, paraya değil. **Gün sonu kasa da kesildi** (ux'in itirazı, aynı
testle): kasa mutabakatı günün sonunda, resepsiyonda, **farklı bir kişinin**
yaptığı iş; döngü ise vizit anında veterinerin elinde kapanıyor. "Kimin borcu
kaldığı" (vadesi geçmiş alacak, müşteri kartında bakiye) döngünün içinde
kalıyor — fatura kesildikten sonra parayı takip etmek o döngünün kapanışıdır.

**`Visit.followupAt` kararı verildi (ölçüm beklenmedi):** R4a ile **aynı
bileşeni** kullanıyor — aynı sonuç satırı, aynı "boş bırakmanın bedeli"
metni, aynı öğrenilmiş varsayılan deseni. Tasarım sıcakken yapılırsa ek
maliyet neredeyse sıfır, sonraya bırakılırsa ikinci bir tasarım ve ikinci bir
uygulama turu oluyor. Taban zaten sıfır (0/5 dolu), yani ölçüm yeni bilgi
vermeyecekti. **Mevcut sürüme R4a-3 olarak giriyor ama kesme çizgisinin
altında** — tasarım eşleşmesinden faydalanıyoruz, sürümün vaadini riske
atmıyoruz. Öğrenme anahtarı farklı: aşıda "ad + tür", takipte vizit türü;
akışı ux genişletiyor.

# Global hazırlık envanteri

Soru: **bu ürünü Türkiye dışında bir kliniğe satsak ilk gün neye çarparız?**
Envanteri ikiye ayırıyorum, çünkü ikisi farklı aciliyette.

## (a) Türkiye dışında sessizce YANLIŞ davrananlar — bunlar "sessiz yanlış"
ailesinden, gerçek müşteri beklemeden düzeltilir

| Konu | Bugünkü durum | Nerede |
|---|---|---|
| Telefon | `normalizePhone` yalnızca TR biçimlerini tanıyor; BAE'nin "050…" numarası ülke kodsuz kabul ediliyor, 9 haneli numaralar sessizce eleniyor, ülke boşken 90 ekleniyor | Katman 0 / 6 (açık) |
| Para birimi | Varsayılan USD, seçim yok, düzeltme yolu yok | Katman 5 / 29 (açık) |
| Saat dilimi | Elle yazılmış 10 şehirlik sabit liste; dışında kalan klinik saatini hiç ayarlayamıyor | **yeni — aşağıda** |
| Vergi | KDV fatura başına elle yazılan tutar; oran ayarı yok, ülkeye göre oran kavramı yok | **yeni** |
| Fatura numarası | `INV-<yıl>-<zaman damgasının son 5 hanesi>`; sıralı değil. Türkiye dahil çok ülkede sıralı numara yasal beklenti | **yeni** |
| Rıza kaydı | `whatsappOptIn` çıplak bir boolean: **ne zaman, hangi yolla** alındığı kaydedilmiyor. KVKK/GDPR tarafında rızanın ispatı budur | **yeni** |
| SMS sağlayıcı | Netgsm Türkiye'ye gönderir; yurtdışı klinikte kanal fiilen yok | S1'de arayüz sağlayıcıdan bağımsız tutuluyor, adaptör sonra |

## (b) Eksik ama sessiz — gerçek bir yurtdışı müşteri olmadan yapılmaz

Dil sayısı (bugün TR/EN; üçüncü dil mimari olarak kolay), adres yapısının
ülkeye göre değişmesi (bugün düz `address/city/postalCode/country`), isim
sıralaması (bugün her yerde "ad soyad"), veri saklama süresi ve "verimi sil"
talebi (bugün yalnızca `archivedAt` ile yumuşak silme), yasal metinler
(gizlilik/aydınlatma metni hiç yok).

**Kararım:** (a) maddeleri tek tek bulgu olarak değil, **tek bir "global
doğruluk" işi** olarak ele alınacak ve mevcut sürümün Katman 0/5 işlerine
eklenecek — çoğu zaten orada. (b) maddeleri gerçek bir yurtdışı müşteri
hedefi netleşene kadar **açılmayacak**; spekülatif iş, uygulamayı şişirir.
Aradaki sınır şu: bir davranış yurtdışında **yanlış sonuç üretiyorsa** (a),
yalnızca **eksikse** (b).

## Globalleşmenin tanımı: Almanca testi

"Türkiye dışına da satılabilir" ölçülemez bir iddiadır ve hiçbir zaman
doğrulanmaz. Bunun yerine falsifiye edilebilir bir eşik: **üçüncü dil olarak
Almanca eklendiğinde saat 24'lük çıkıyor, yaş metni doğru çoğullanıyor, düzen
bozulmuyor.**

Almanca seçildi, Arapça değil: Almanca bugün gerçekten bozuk olanı kanıtlıyor
(24 saat, çoğul kuralı, uzun metin, ondalık/binlik ayırıcı, tarih sırası),
Arapça'nın kanıtladığı şey (yön) ise bu ufukta ödenemeyecek kadar geniş —
25 fiziksel yön sınıfı yalnızca başlangıç. Yön için **kural** konuyor
(yeni kodda mantıksal sınıf: `ms-`, `pe-`, `text-start`, `border-s`), Arapça
gerçek bir pazar çıkınca açılıyor.

**Bugün "dil eklemek" bir JSON dosyası eklemek değil** ve asıl bulgu bu:
`lib/format.ts:115` `intlLocale()` = `locale === "tr" ? "tr-TR" : "en-US"`,
`:203` saat biçimi elle 24/12 seçiyor, `:260` süre metni elle yazılmış,
`:343` `AGE_COPY` kod içinde metin tablosu ve çoğul kuralı yok. Yeni bir dil
bu ternary'lerin yanlış tarafına düşüp **sessizce İngilizce gibi** davranır.
Dördünü de `Intl` zaten yapıyor: iş yeni yetenek eklemek değil, yanlış
soyutlamayı kaldırmak — bugün ucuz, her yeni dilde pahalılaşıyor. (a) sınıfı.

Kabul kriteri olarak benimsendi: **bir bileşen en uzun çeviriyle test
edilmeden bitmiş sayılmaz.** Almanca hedefi bu kriteri gerçek kılıyor.

## Sıralamayı belirleyen açık soru

**Elimizde somut bir yurtdışı klinik adayı var mı?**
- **Varsa:** global bir sonraki sürümün merkezi olur, Almanca dahil.
- **Yoksa:** bir sonraki sürüm **para döngüsü** olur; globalin (a) sınıfı
  işleri onun yanında paralel gider, Almanca testi hemen ardına.

Tavsiye: ikincisi. Sıfır müşterisi olan bir pazarı, bugünkü kliniğin her gün
kaybettiği paranın önüne koymak zor savunulur. Karar değil, soru olarak
duruyor — cevabı uydurmuyoruz.

## Global envanterden doğan yeni maddeler (henüz açılmadı, onay bekliyor)

Karara bağlandı — ikisi bu sürümün paralel global hattında, ikisi para
sürümünün malzemesi:

| İş | Karar | Büyüklük |
|---|---|---|
| Saat dilimi listesinin kaldırılması, IANA listesinden seçim | **açılabilir** (global hat) — 10 şehir dışındaki klinik saatini hiç ayarlayamıyor, hatırlatma zamanlamasının tamamı buna bağlı | küçük |
| Rızanın ne zaman/hangi yolla alındığının kaydı | **açılabilir** (global hat, 14b) — eklemeli kolon, veri dönüşümü yok | küçük-orta |
| `lib/format.ts` dil ternary'lerinin kaldırılması | **açılabilir** (global hat). Kabul kriteri: üçüncü bir locale eklendiğinde saat 24'lük çıkmalı, yaş metni doğru çoğullanmalı. Almanca bir sürüm taahhüdü değil, bu işin ölçüsü | küçük-orta |
| `fullName(client, locale)` yardımcısı | **açılabilir** (global hat) | küçük |
| KDV oranının klinik ayarı olması | **para sürümüne** — fatura başına elle tutar hem hataya açık hem ülkeye göre değişen oranı temsil etmiyor | orta |
| Fatura numarasının sıralı üretilmesi | **para sürümüne, orada öne alınır** — muhasebe/uyum tarafında sorulacak ilk şeylerden; bugün zaman damgasından üretiliyor | orta |

**Global hat kuralı:** bu maddeler global iddiadan bağımsız olarak da
hatadır; o yüzden "bir gün globalleşirsek" diye beklemiyorlar. Ama sürümün
vaadini taşımadıkları için Katman 0-4'ün önüne de geçmiyorlar — dev'lerin
kuyruğu Katman 0'ı bitirince açılırlar.

**Bağlayıcı sıra kuralı (ux'in itirazıyla kondu):** `fullName()` ve
`format.ts` ternary temizliği, **para sürümünün ilk ekranı yazılmadan önce**
inmiş olacak. Gerekçe zamanlama: para sürümü çok sayıda yeni ekran getiriyor
(fiyat listesi, fatura türetme, vadesi geçmiş alacak, müşteri bakiyesi) ve
hepsinde müşteri adı yazılacak, hepsinde para/tarih biçimlenecek. Yardımcılar
yerindeyken ek maliyet sıfır; yerinde değilken her ekran bir
`{firstName} {lastName}` daha ekler ve ikinci bir süpürme doğar. "Bedava"
penceresi tam olarak bir sonraki sürüm; sonra kapanıyor.

**"Asla değil, henüz değil" ayrımı** — bekleyen maddeler iki farklı sınıfta:
- **Aynı fiyatta bekleyenler:** adres yapısı, üçüncü dilin çevirisi, yasal
  metinler, veri saklama ve silme. Sonra yapmak bugün yapmaktan pahalı değil.
- **Pahalılaşanlar, şimdi yapılır:** `format.ts` ternary'leri, `fullName()`,
  yön kuralı (kondu). Her yeni ekranla maliyeti artıyor.
| `lib/format.ts`'teki dil ternary'lerinin kaldırılması | Yeni dil sessizce İngilizce gibi davranıyor; dördünü de `Intl` yapıyor | küçük-orta |
| `fullName(client, locale)` yardımcısı | Ad sıralaması kültüre göre değişir; ayrıca aynı birleştirme onlarca JSX'te tekrar ediyor. Şema işi değil, gösterim işi | küçük |
| Yön kuralı (kural, iş değil) | Yeni kodda mantıksal sınıf kullanılır. `dir` özniteliği hiç yok, fiziksel yön sınıfı 25 yerde, mantıksal 0. Bugün konmazsa yazılmakta olan dört yeni bileşen de fiziksel doğar | — |

**Beklemeye alınanlar (b sınıfı, gerekçe):** adres yapısının ülkeye göre
değişmesi (eyalet/il yok, alan sırası sabit — `Client.country` zaten var),
telefon giriş alanının ülke kodu arayüzü olmaması, isim sıralamasının şema
tarafı, veri saklama/silme, yasal metinler. Hiçbiri yurtdışında **yanlış
sonuç üretmiyor**, yalnızca eksik.

**Veri saklama/silme işine şimdiden yazılan kapsam notu:** sahip değişikliği
kaydı eski sahibin adını yeni sahibin hayvan kartında gösteriyor (zaman
çizelgesinde olay satırı olarak — bu tasarım kararı bilerek verildi, klinik
pratiğinde bu kayıt tutulur). Ama "verimi sil" talebi geldiğinde bir kişinin
adının **başka müşterilerin kayıtlarında** durduğu ayrıca ele alınmalı,
yoksa silme yarım kalır.

## Tasarım sistemi borcu (ux'in olgunluk haritası — iş olarak açılmadı)

Dördü de bugün iş değil, ama yazılı olmazsa yarın kaybolur. Biri bir
semptomun sebebi olduğu için sıralamayı da etkiliyor.

**A. Etiket/değer çifti bileşeni yok.** Aynı iş dört yerde, iki farklı adla:
`Detail` (`clients/[id]/page.tsx:169`, `pets/[id]/page.tsx:411`) ve `Row`
(`appointments/[id]/page.tsx:159`, `visits/[id]/page.tsx:279`). Detay
sayfalarının omurgası bu. Küçük.

**B. Menü/taşma primitifi yok — ve bu bir sebep, eksik bileşen değil.** Taşma
menüsü olmadığı için her ekran eylemlerini yan yana diziyor; `PageHeader`'ın
390px'te eylemlerini ekran dışına atmasının sebebi bu. **31 numara semptomu
düzeltiyor, sebebi değil** — primitif gelmezse aynı sınıf, beşinci eylemi
olan ilk ekranda yeniden doğar (TEAM.md 4). Orta (odak tuzağı, klavye,
konumlandırma).

**C. Köşe yarıçapı beş kademeye dağılmış.** `rounded-lg` 60, `rounded-2xl`
32, `rounded-xl` 10, `rounded-full` 9, `rounded-md` 8 — üç rol (yüzey,
kontrol, pil) için beş değer. Ayrıca kartlarda hem kenarlık hem `shadow-sm`
var (19 yer); ikisi aynı işi yapıyor. Küçük, mekanik.

**D. Hareket dili yok.** `globals.css:29-30`'da iki animasyon tokenı tanımlı,
tüm uygulamada üç kullanım. Madde 30'un ters yönü: soyutlama var, çağrı yeri
yok. Ya dil kurulur ya tokenlar kaldırılır. Küçük.

**E. Park edilenler.** Formlarda "Vazgeç" eyleminin hiç olmaması
(`components/forms/` altındaki 18 dosyanın hiçbirinde yok) ve hata geri
bildiriminin üç farklı biçimi (yalnız satır içi / yalnız toast / ikisi
birden).

**Kayıtlı karar — `--destructive` kontrastı DESIGN-1'in içinde düzeltiliyor.**
Açık temada AA'dan kalıyor: kart 4.22, sayfa zemini 3.86, muted 3.49
(dev-ui ölçtü). Ertelenmedi, çünkü bileşenin varlık sebebi okunamayan
uyarıydı ve aynı ölçütle hata kutusu da okunmuyor — üstelik yola çıktığımız
amber'den daha kötü. **11 form kutusu taşınmadan önce** yapılacak ki kutular
doğru tokenın üstüne insin (Katman 0 / 9'un kapsamında).

Bunlar para sürümü ya da global hat açıldığında, ilgili ekrana dokunulurken
ele alınır; ayrı bir "tasarım borcu sürümü" açmıyoruz.

## Kullanıcıya sorulacaklar

**Cevaplananlar:**
- *Somut bir yurtdışı klinik adayı var mı?* → **Yok.** Sonuç: sonraki sürüm
  para döngüsü, global yalnızca "sessizce yanlış" sınıfıyla paralel hatta.
- *SMS sağlayıcı hangisi?* → **Netgsm.** Sonuç: S1-S4 çekirdeğe girdi.
- *Aşı tekrarında kuduz istisnası olsun mu?* → **Hayır.** Uygulama tıbbi
  iddiada bulunmuyor; öneri her zaman kliniğin kendi geçmişinden.
- *Mesajlar bilgilendirme mi, ticari ileti mi?* → **Bilgilendirme.** Sonuç:
  şablonlarda satış dili yasak, mesaj tipi ayarı eklenmiyor.
- *Dikiş kontrolüne gelmeyen hastayı bugün nasıl fark ediyorsunuz?* →
  **Veteriner aklında tutuyor ya da not alıyor.** Yani alışkanlık var, kayıt
  yok. Sonuç: R4a-3'ün işi alışkanlık kurmak değil, var olanı uygulamaya
  taşımak; yeni ekran icat edilmiyor, sabah gün planına iliştiriliyor.
  Satış gerekçesi: o takipler bugün hiçbir yerde kayıtlı değil, veteriner
  ayrılırsa kaybolur.

**Açık sorular — cevapları sıralamayı ya da tasarımı değiştirir:**
1. Aşı tekrarında geri dönüş oranınız kabaca nedir? (Bugün hesaplanamıyor:
   tekrar tarihi geçmiş aşı kaydı yok.)
2. Randevuya gelmeme oranı nedir?
3. Ortalama vizit tutarı nedir? (Para sürümünün büyüklük sırasını bu belirler.)
4. Klinikte gün içinde aynı bilgiyi iki kez yazdığınız yer neresi?
6. "Önümüzdeki hafta doluluk nasıl" diye bakılıyor mu? (Haftalık görünüm
   açılmadı; gün görünümü varsayılan kaldı. Cevap "evet" ise yeniden bakarız.)

## Performans bütçesi — karar ve gerekçe

**Bugünkü bütçe 6000 ms ve bu bir bütçe değil, tavan.** Hiçbir şeyin
çarpamayacağı bir eşik hiçbir şey öğretmez; üstelik `pm.md`'deki kendi
hedefimiz "1 saniye altı", yani bütçe hedefin altı katı. Gün boyu ekranlar
arasında gezinen bir resepsiyon görevlisi için 6 saniye kabul edilemez.

**Karar — sayıyı veriden sonra koyuyorum, uydurmuyorum (TEAM.md 8):**
1. Önce mevcut gerçek süreler okunur: `e2e/performance.spec.ts` zaten
   üretim derlemesine karşı 11 kilit rotada her push ve her PR'da çalışıyor,
   yani sayılar **var**. pm'den istendi.
2. Bütçe **tek global sayı olmaktan çıkar, rota başına** konur — ağır bir
   liste ile boş bir form aynı eşikte ölçülmez.
3. Her rotanın eşiği, gözlenen değerin biraz üstüne çekilir (bugün geçen
   rotalar düşmesin), sonra **her sürümde kademeli indirilir** — hedef
   1 saniye altı.
4. Kademeli indirme bir iş değil, sürüm ritüeli: her sürüm sonunda eşikler
   yeni gözlenen değerlere göre sıkılır. Bir kez sıkılan eşik gevşetilmez;
   gevşetme gerekiyorsa sebebi yazılır.

**Ölçüm kuralı:** performans yalnızca **üretim derlemesinde** ölçülür. Dev
sunucusunda ölçüm anlamsız — pm aynı rotada 0,4 sn ile 81 sn arasında değer
gördü, fark tamamen Turbopack yeniden derlemesi. Dev sunucusundan alınan
hiçbir süre bulgu sayılmaz.

## Doğrulanmış, iş gerektirmeyen

- **Kiracı izolasyonu sağlam.** `modules/` altındaki tüm prisma çağrıları
  tarandı: liste sorguları `clinicId` içeren ortak `where`'den geçiyor, tek
  kayıt güncellemeleri önce `findFirst({id, clinicId})` ile doğrulanıyor.
- **Klinik kaydı (SOAP, vitaller, aşı, reçete, teşhis) iyi kurulmuş.**
  Burada şu an yapılacak iş yok.
- **Klinik izolasyonu ve yetkilendirme temiz (pm, iki tam tur, yeni hata
  yok).** 18 sorgu ve 15 servis dosyası tarandı, kapsam dışı kalan yok. En
  riskli işlemlerde bile desen doğru: kaydın çağıranın kliniğine ait olduğu
  önce doğrulanıyor, değilse **"bulunamadı"** atılıyor — "yetkiniz yok"
  değil, yani kaydın varlığı sızdırılmıyor. `requirePermission` çağırmayan
  tek fonksiyon `createClinicWithOwner` ve o da doğru: kayıt anında henüz
  oturum yok. **Bir sonraki oturumda bu alan yeniden taranmasın.**
- **Performans ölçüm düzeni doğru kurulmuş.** `e2e/performance.spec.ts`
  üretim derlemesine karşı, 11 kilit rotada, CI'da her push ve her PR'da
  çalışıyor; regresyon canlıya çıkmadan build'i düşürüyor. Düzeltilecek olan
  düzen değil, yalnızca eşik değeri (bkz. "Performans bütçesi").
