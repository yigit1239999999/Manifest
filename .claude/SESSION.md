# Oturumu devralma kılavuzu

Bu dosya, PetTrack ajan ekibiyle çalışmaya nereden devam edileceğini anlatır.
Plan `.claude/BACKLOG.md`'de, çalışma ilkeleri `.claude/TEAM.md`'de.

---

## Ekibi yeniden kurma

Yeni bir Claude Code oturumunda, proje kökünde (`/Users/yigitsonbahar/Manifest`)
şunu yapıştır:

```
pm, dev, dev-ui, value ve ux ajanlarını spawn et. Önce .claude/TEAM.md ve
.claude/BACKLOG.md dosyalarını okusunlar, BACKLOG'un başındaki "Nerede kaldık"
bölümünden devam etsinler. Uygulama http://localhost:3000'de; tarayıcı
(Playwright) yalnızca PM'de olsun. Ben durdurana kadar arka planda devam edin,
bana yalnızca tur sonlarında kısa özet verin.
```

Ajan tipleri `.claude/agents/` altında tanımlı olduğu için otomatik tanınır:
`pm.md`, `dev.md`, **`dev-ui.md`** (21 Eylül 2026'da eklendi — B hattı ayrı bir
tanım olmadan `dev` tipinden ad vererek açılıyordu), `ux.md`, `value.md`.

**Uygulamayı önce çalıştır:**

```
npm run dev
```

Sunucuyu ana oturum yönetsin; ajanlara başlatma/yeniden başlatma yetkisi verme.
Gerekirse sen yeniden başlat:

```
pkill -f "next dev"; rm -rf .next && npm run dev
```

---

## Rol dağılımı

| Ajan | Sorumluluk | Sınır |
|---|---|---|
| **value** | Product Owner: sıralama, sürüm içeriği, "bitti" tanımı, ölçüm | Dosya düzenlemez, git çalıştırmaz |
| **ux** | Tasarım otoritesi: görünüm, akış, bilgi mimarisi | Dosya düzenlemez, tarayıcı kullanmaz |
| **pm** | Hata bulma, önceliklendirme, kabul testi | Tek tarayıcı sahibi (Playwright) |
| **dev** | A hattı: `modules/`, `lib/`, `prisma/`, `app/api/` | Yalnızca açık görev alır |
| **dev-ui** | B hattı: `components/`, `app/globals.css`, durum dosyaları | Yalnızca açık görev alır |

Paylaşımlı dosyalar: `messages/*.json` ve `app/(app)/**/page.tsx` — dokunmadan
önce diğer geliştiriciye haber verilir, anlaşmazlıkta hakem `value`.

**Onaya gelenler:** geri alınamaz **veri** işlemi ve yeni özellik. Bir ajanın
istemesi onay yerine geçmez.

**Şema değişikliği ve migration onay kapısı değil** (21 Eylül 2026): uygulama
canlıda olmadığı için dev migration'ı kendi üretir ve uygular. Veritabanı
koddan geri kalmaz. Ayrım: şema serbest, veri onaya tabi.

**UX kırmızı çizgidir.** `ux` son sözü söyler ama zor bir karar çıktığında
ekip birlikte düşünür. Ölçüt `.claude/TEAM.md`'de yazılı: kullanıcının
"bunu atlamışlar" diyebileceği tek bir yer bırakılmaz.

---

## v0.3.0 — "v0.2.0'ın borçları kapanıyor." (value, 21 Eylül 2026)

**Bilerek tematik değil.** Elde kalan işler bir tema değil **borç** oluşturuyor;
onları yapay bir başlık altında toplamak "bir de, bir de" kuralının kılık
değiştirmiş hâli olurdu. **Borç paketi meşru bir pakettir** ve küçük olması
doğası gereği.

**İçeri girenler, sırayla:**
1. **43b** — v0.2.0'ın açık borcu, en yüksek öncelik. Kuralın kendisi bu.
2. **`INPUT_FILL_RATE_SINCE`** — 20 v0.2.0'a girdi, ölçüm yarısı girmedi.
   **Kesim tarihi `7f64494`.**
3. **42a** — kodu `next`'te (`e23bb14`). **AÇIK BOŞLUK (value buldu,
   ux'te):** servis yarısı şartnamenin üstünde (kesimin **başlangıç** saati
   olması; aynı kontrolün gönderimi + elle kaydı + önizlemeyi birden
   koruması — *"sunulan ile kabul edilen ayrışamaz"*; testte saatin
   sabitlenmesi). **Ama ekran yarısı işi asıl yapan parçayı düşürmüş:**
   ux'in cümlesi ve **"Sonucu kaydedin" → `/appointments/[id]/edit`
   eylemi inmedi**; yerine düğmelerin neden gittiğini açıklayan ve
   *"yeni bir randevu oluşturursanız..."* diyen bir metin var.
   **Ölçüyü götürüyor:** 42a'nın üçüncü kabul eşiği *"14 gün sonra
   `SCHEDULED` oranı, taban 40'ta 39"*ydu ve **oranı hareket ettirecek
   mekanizma tam olarak o davetti.** Davet inmezse 14 gün sonra yine 39
   bulunur ve hiçbir şey öğrenilmez — **TEAM.md 17b'nin kendisi: görünür
   parça indi, işi yapan parça kesildi.** (value bunu 20 için önceden
   yazmıştı, 42a için yazmamıştı; aynı şey oldu.) Ayrıca "yeni randevu
   oluşturun" **yanlış eyleme yönlendiriyor**: hayvanı gelmiş, sonucu
   kaydedilmemiş bir randevuda veterinerin işi yeni randevu açmak değil,
   **ne olduğunu yazmaktır.** Son söz ux'te; **sürümü bekletmiyor.**
4. **`SENT` kaydı (§10)** — artık bir vaadin kapısı değil, **kapanmamış
   borç**; etiket "bu sürümde de gösterilemedi" dedi ve ikinci kez öyle
   denmeyecek. Pencereye düşen randevu yoksa pm bir randevuyu o pencereye
   **taşısın**, tanınabilir bir kayıtla.
5. **`shadow-sm` ölçümü** — aşağıdaki kapı.

**Kesim şartı TEK: 43b.** `INPUT_FILL_RATE_SINCE` onunla birlikte inmezse
**o da eksik yazılır** — 20 zaten v0.2.0'a girdi ve **kesim tarihi `7f64494`
yazılı olduğu sürece geriye dönük hesaplanabilir.** §10 ve `shadow-sm`
ölçümü pakettedir ama **kesimi bekletmez**; ikisi de pm'de, gelirse girer,
gelmezse eksik yazılır. `33e8cc6` (vitals pair wrap) de pakette.

**Girmeyenler, adıyla:** 40'ın silmeleri + tarama testi · 7'nin kalanı · 38 ·
**21** (en büyük iş, **kendi paketi olacak: "döngü kapanıyor"**).

### Yeni bulgu (ux, 21 Eylül) — eylem düğmeleri yetki kontrolsüz (44)

`app/(app)/appointments/[id]/page.tsx:88` "Düzenle" düğmesi **yetki
kontrolü taşımıyor** ve `VET_TECH`'te `appointments.write` **yok** — o rol
bugün **dolduramayacağı bir forma varıyor.** 43'ün sınıfı, yeni bir yerde:
sayfa değil **düğme** tarafında.

**ux 42a'nın yeni düğmesini bilerek aynı şekilde yetkisiz bıraktı** ve
gerekçesi doğru: tek başına gizlemek, **aynı rotaya giden iki düğmeden
birinin gizli birinin açık olması** olurdu. **İkisi birlikte düzelir.**

**Kapsam açıkça yazıldı (TEAM.md 30c):** diğer ekranların düzenleme/silme
düğmelerinin rol kontrolü **taranmadı** — "bakıldı, temiz" sanılmasın.
Tarama 43b ile aynı aileden; sıralamayı `value` verecek.

### `shadow-sm` kapısı — ölçüm ucuzladı, bloke değil

> **DÜZELTME (21 Eylül akşamı, dev-ui yakaladı, ana oturum doğruladı):**
> **`7ff7c9a` gölgeyi KALDIRMADI.** `components/ui/card.tsx:19`
> `cn(surface, "shadow-sm", className)` — **`Card` gölgeyi hâlâ uyguluyor.**
> `app`+`components` altında sayı 19'dan 9'a düştü ama sebebi elle yazılmış
> **25 kart dizgisinin `<Card>`'a inmesi.** Hiçbir yüzey gölgesini
> kaybetmedi, **ux'in şartı çiğnenmedi.** Hem value hem ana oturum
> **diff satırı saydı** — bir gün önce yazılan dersin ters yönü
> (TEAM.md 32d). **Paketin `d49f4ec`'te kesilmesi yine de doğru oldu ama
> gerekçesi yanlıştı.**

`7ff7c9a` **geri alınmıyor** (dev-ui'nin (a) tavsiyesi, value onayladı):
üstüne üç commit indi, 43b'nin `sidebar.tsx`'i `rounded-tile` kullanıyor, ve
commit sürümün vaadiyle çelişen bir şey içermiyor. **Kısmi revert
reddedildi: yarısı geri alınmış bir tasarım sistemi, iki sistemin
kendisidir.**

**pm'in §7'si artık hiçbir şeyi BLOKE ETMİYOR** — ölçüm, **henüz yazılmamış**
bir değişikliğin girdisi. İptal değil, aciliyeti düştü. **§10 ve 390px turu
öne geçti.**

**Asıl sebep:** paketin `d49f4ec`'te kesilmiş olması ölçümü **kurtardı.**
ux'in şartının amacı ölçülmemiş bir düzleşmenin **yayına çıkmaması**ydı;
gölgeli hâl `v0.2.0` etiketinde, gölgesiz hâl `next`'te duruyor. **pm'in
artık "önce"yi kurgulamasına gerek yok — iki adlandırılmış ref
karşılaştıracak.** Şart çiğnendi, zararı oluşmadı.

Düzleşme çıkarsa çözüm **gölgeyi geri koymak değil, `--border`'ı
koyulaştırmak** — ve o da metnin/kenarlığın **gerçekte üstünde durduğu
yüzeye** karşı ölçülür. **Ölçüm v0.3.0 hazır olduğunda gelmemişse kabul
edilir ve risk etikete yazılır:** bir sürümü elde edilemeyen bir ölçüme
rehin vermek, yasakladığımız şeyin kendisi.

---

## v0.2.0'ın kapısı (value, 21 Eylül 2026)

Sürümün vaadi *"hatırlatmalar gerçekten gidiyor"*. Bugün `message_logs`'ta
**iki kayıt var, ikisi de `MANUAL`, `SENT` sıfır.**

> **`SENT` statüsünde en az bir gerçek kayıt olmadan o vaat karşılanmış
> sayılmaz.** Katman 1 kodda kapandı ama eşiği karşılanmadı; kod inmesi
> mesajın gitmesi demek değil.

Ayrıca **43b** (yetkisize hâlâ görünen `/audit` bağlantısı) v0.2.0'a
taşınmamalı, ve **açık bir P0 bir geçişten fazla yaşarsa geçiş geç
kalmıştır** (TEAM.md, Sürüm ritmi).

---

## Sürüm ritmi — ÖNCE BUNU OKU (21 Eylül 2026, kullanıcı kararı)

**İş `next` dalında birikir; `main` yalnızca sürüm geçişlerinde toplu ve
etiketli olarak alır.** Kimse main'e commit etmez, kimse push etmez —
birleştirme ve etiketleme **ana oturumun** işidir. Geçiş sırası ve kapıları
`.claude/TEAM.md`'nin "Sürüm ritmi" bölümünde.

**`v0.1.0` etiketlendi ve main'e alındı (21 Eylül 2026).** Kapılar:
`tsc --noEmit` 0 hata · `vitest run` **416 test / 45 dosya** geçti ·
`eslint .` 0 hata (3 uyarı). Açık P0 etikete yazıldı: **43**.
Çalışma dalı: **`next`**.

---

## Dal durumu (21 Eylül 2026 akşamı)

`main` yerel, **origin/main'in 27 önünde** ve **geride değil**: paralel
oturumun `99e6c1e` ("Align E2E selectors with the merged form labels")
commit'i `02f66cd` ile birleştirildi. Push edilmedi; merge kararı kullanıcınındır.

Birleştirilmeyen tek dal `origin/claude/manifestation-site-t20thx` (11 commit) —
**main ile ortak atası yok**, aynı depoda duran ayrı bir proje (manifestasyon
sitesi). PetTrack'e ait değil, **birleştirilmeyecek**. Bir daha sorulmasın.
`claude/manifest-cleanup-0V3dv`, `claude/magical-ptolemy-mh0T4`, `pm-dev-loop`
ve `backup-pm-dev-loop-1523` main'e tamamen girmiş durumda.

---

## Bu oturumda nereye geldik (21 Eylül 2026)

**Kod:** `main`, yerel. Bu oturumda **24'ten fazla commit** indi (`a3987bb`
sonrası). Kalite kapıları temiz: `tsc --noEmit` hatasız, **371 test / 38
dosya** geçiyor. Push edilmedi.

**Sürüm:** "Güvenilir döngü" — *klinik uygulamayı açtığında yanlış bilgi
görmüyor, yanlış mesaj göndermiyor ve hatırlatmaları gerçekten gidiyor.*

### Bu oturumda kapananlar (indi; çoğu pm kabulü bekliyor)

Katman 0: A0-money (tahsilat 100 kat + `parseMoneyInput`, **birinci deploy
blokeri**), panelin kalan borcu, telefon doğrulama, `setStaffActive`,
iptal/tamamlanmış randevuda gönderim (8b), vefat hijyeni (7), onay dialogu
(17), panel grafikleri (11), kanal seçimi ve ayarların kaydedilmesi (34),
panel sayacı ile listenin tek kaynağa inmesi (41).

Katman 1 **kapandı**: cron saatlik (12) — ama "bitti" eşiği hâlâ
`message_logs`'ta `status = SENT` bir kayıt, o da kanal yapılandırmasına
bağlı; **kapatma**.

Katman 2'den: başarısız gönderimin yeniden denenmesi (16).

B hattı: `StatusBadge` (18), durum bütünlüğü (19, 19a), dar ekran (31),
`DataTable` (26), `Callout info`, son ham renkler.

### Deploy blokerleri — ikisi de kodda kapandı
A0-money `0a34b01`, para birimi (29a+32) `cd407e9`. **Sürümü açan şey pm
kabulüdür** (TEAM.md 28); on commit kabul kuyruğunda.

### Sıradaki iş (21 Eylül akşamı value tarafından yeniden çizildi)
**A hattı:** **43 (`/audit` HÂLÂ KORUMASIZ — iki tur "yapılıyor" sanıldı,
doğrulandı)** → 42a → **20 (üçüncü turdur kayıyor)** → **43b** (yeni: yetki
kenar çubuğuna üç yoldan giriyor; **sürümde kapanır, kesme çizgisinin altında
değil**) → 7'nin kalanı → 5 → 35 → 36 → 40 → 38 → **21**.
**B hattı:** yarım iş **(+19b içinde)** → A+C paketi → `granularity="day"`
+ `ConfirmDialog choices`. 11 kuyruktan çıktı (indi `692b152`).
**Açık risk:** ux'in tarayıcısı olmadığı için **hiçbir mobil düzen
taranmadı**; 390px turu pm'den, kabul kuyruğu boşalınca istenecek.
Gerekçeler ve ölçüm BACKLOG'un "Sırada ne var" bölümünde; **çelişkide dosya
geçerlidir.**

**Sıralamanın tek kaynağı `.claude/BACKLOG.md`'nin "Sırada ne var" bölümüdür.**
Mesajla çeliştiğinde dosya geçerlidir; mesajlar geç gelir ve sırası karışır.

### Bu oturumda alınan kullanıcı kararları
- **Şema değişikliği ve migration onay kapısı değil** (uygulama canlıda değil).
  Onaya giden: geri alınamaz **veri** işlemi ve yeni özellik.
- **Geçmiş ödemelere dokunulmuyor.** 100 kat küçük kaydedilmiş kayıt sayısı:
  1 (`INV-2026-57336`). Bilinen sonucu: o faturada panel ve alacak rakamları
  tutarsız kalır.
- **Para birimi:** yalnızca şema varsayılanı TRY olacak, mevcut klinikler
  dönüştürülmeyecek — ayardan kendileri değiştirir.
- **R4a (20+21) sürüme girdi.** 42b(i) "Vizit başlat" **sonraki sürüme**
  ertelendi (reddedilmedi; gerekçesi ve tabanı BACKLOG'da). 15 ve 29b
  **sürüm dışı**.

### TEAM.md'ye bu oturumda eklenenler
17b (kesme çizgisi işin kendi parçaları arasında) · 30b (bayat gerekçe) ·
30c (kapsamı yazılmayan not) · 32b (hangi dil uzun — ölçülür) · 32c (konan
kuralın tuttuğu ölçülür) · em işareti kapsamının netleşmesi (TR; yanında
dilden bağımsız bir düzen kısıtı).

### Bilinen açık bulgular (pm'den, henüz iş değil)
- Fazla ödeme uyarısız kabul ediliyor; kaydedilen tahsilat silinemiyor.
- İşlem geçmişi ham kimlik gösteriyor.
- `country` 129 kliniğin **hepsinde NULL** — (6) telefon düzeltmesi pratikte
  devreye girmiyor olabilir; pm bakıyor, çıkarsa (6) yeniden açılır.
- `e2e/performance.spec.ts` içerik doğrulaması yapmıyor: hata sayfası render
  eden bir rota "182 ms" diye geçti. Bozuk uygulama hızlı ölçülüyor (35).
- Ölçüm tabanı pm'in test kayıtlarıyla kirlendi; silinmiyor, hesaptan
  çıkarılıyor. pm bundan sonra tanınabilir tutarlar kullanacak (111,11 gibi).

---

## Kullanıcıdan bekleyen cevaplar

BACKLOG'daki "Kullanıcıya sorulacaklar" bölümünde beş soru açık. En kritiği:

1. **Ortalama vizit tutarı** — para sürümünün büyüklük sırası buna bağlı
2. Aşı tekrarında geri dönüş oranı
3. Randevuya gelmeme oranı
4. Gün içinde aynı bilginin iki kez yazıldığı yer
5. Haftalık randevu doluluk görünümüne ihtiyaç var mı

Cevaplanmışlar (tekrar sorulmasın): yurtdışı klinik adayı yok · SMS sağlayıcı
Netgsm · kuduz için takvim istisnası yok · iletiler bilgilendirme olarak
gönderilecek · dikiş kontrolünü veteriner aklında tutuyor/not alıyor.

---

## Bir sonraki sürüm (hazır, başlatılmadı)

**"Kliniğin parası uygulamanın içinde kapansın."** Merkezi **fiyat listesi**;
türetme onun çıktısı. Gerekçe: `Treatment` ve `Diagnostic` modellerinde fiyat
alanı yok, bugün türetme yazılırsa açıklaması dolu fiyatı boş satırlar üretir.

Bu sürümden önce inmesi bağlayıcı: `fullName()` yardımcısı ve `lib/format.ts`
ternary temizliği — o sürüm müşteri adı yazan ve para/tarih biçimleyen dört
yeni ekran getiriyor, yardımcılar yerindeyken ek maliyet sıfır.

---

## Ölçüm

```
node --env-file=.env scripts/loop-metrics.mjs
```

Salt okuma.

**Aşı tekrar tarihi doluluğu — ölçü yeniden tanımlandı (value, 21 Eylül
2026); ~~%20 tabanı~~ kapandı ve pm'in cevabı beklenmiyor.**
Sebep: aynı gün üç ölçüm **1/10 → 1/10 → 2/11** verdi. Oturum sırasında yeni
aşı kayıtları oluşuyor, yani **hem pay hem payda akıyor**; ömür boyu oran
kayıt aktıkça ömür boyu kirli kalır. Bu, beklenip öğrenilecek bir gerçek
değil, **yanlış tanımlanmış bir ölçüydü.**
- **Kesim öncesi küme, DONDURULDU: %18 (2/11, 21 Eylül 2026).**
- **Başarı ölçüsü: `INPUT_FILL_RATE_SINCE`** — (20)'nin kodunun indiği an
  kesim noktası, başarı o andan **sonra** oluşturulan aşılarda tekrar
  tarihi doluluğu. `scripts/loop-metrics.mjs`'e ikinci satır olarak
  ekleniyor; mevcut satır kalıyor, yeni tablo yok, salt okuma.
- **Neden yalnızca daha temiz değil, daha doğru:** (20) **ileriye dönük** bir
  davranışı değiştiriyor. Ömür boyu oran, değiştiremediğimiz geçmiş
  kayıtlarla seyreltilir — yüz eski kaydın yanında on yeni kayıt kusursuz
  çalışsa bile oran kıpırdamaz ve iş "işe yaramadı" görünür.

Diğer taban değerleri (20 Eylül 2026): gönderilmiş mesaj 0 · takip tarihi
dolu vizit 0/5 · geçmiş randevuların hepsi `SCHEDULED` · fatura
kalemlerinin 0/2'si vizite bağlı.

**Değişmeyenler (21 Eylül akşamı teyit):** geçmiş randevular **39
`SCHEDULED` + 1 `IN_PROGRESS`** (42a'nın tabanı sağlam, "40'ta 39" doğru) ·
`message_logs` **2 kayıt, ikisi de `MANUAL`, `SENT` sıfır.**

**Not:** performans yalnızca üretim derlemesinde ölçülür. Dev sunucusunda aynı
rota 0,4 sn ile 81 sn arasında değişiyor (Turbopack yeniden derlemesi).

---

## Yayımlanmış tasarım önerileri

- Hatırlatma Döngüsü — https://claude.ai/artifact/VQVzSVC549vn2ESV3nWHga
- Hayvan Kartı — https://claude.ai/artifact/JSqT8N3pr5UF84b4QnQwK2

İkisi de karar bekleyen öneri; iş olarak açılmadı.
