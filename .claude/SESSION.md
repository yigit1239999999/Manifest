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

## DURUM — tartışmasız hâl (21 Eylül 2026)

**`v0.3.0` KESİLDİ, ETİKETLENDİ VE PUSH EDİLDİ.** Etiket **`454f02c`**'de,
main de oraya getirildi.

> **DÜZELTME — etiket metninde iki yanlış var, kayda geçiyor:**
> Ana oturum etiketi **`HEAD`'e vurdu, belirli bir commit'e değil**, ve
> ajanlar o sırada commit atmaya devam ediyordu. Sonuç: `454f02c`
> (`INPUT_FILL_RATE_SINCE`) etikete **girdi**, ama etiket metni onu
> *"YOK, ikinci sürümdür"* diye eksik listesinde sayıyor. Aynı şekilde
> main bir süre etiketin **bir commit gerisinde** kaldı; düzeltildi.
> **Etiket yeniden yazılmıyor** (kural), yanlışı burada duruyor.
> **Ders TEAM.md'ye yazıldı: ajanlar canlıyken etiket `HEAD`'e vurulmaz,
> kapıların koşulduğu commit'e vurulur.**
Bundan sonraki her commit **v0.4.0'a aittir.** "Kesmeden önce şunu ekle"
diyen mesajlar v0.3.0 için **geç kalmıştır**; içerikleri v0.4.0'a taşınır.
Mesajlar geç geliyor ve sırası karışıyor — **çelişkide bu dosya geçerli.**

**v0.3.0 sonrası inenler (= v0.4.0'ın bugünkü içeriği):**
`2ed1094` kapsam notu · `454f02c` **`INPUT_FILL_RATE_SINCE`** ·
`e709bf1` **42a'nın ekran yarısı**.

---

## v0.4.0 — "Ekran, yapmadığı şeyi vaat etmiyor." (value)

**Ad üç kez değişti, geçerli olan bu.** ~~"Ölçebildiğimiz ve
kapatabildiğimiz"~~ · ~~"Söz verdiğimizi gösteriyoruz"~~ · ~~"Hata,
kullanıcının baktığı yerde görünür"~~ (paket tek işken doğruydu, 45
eklenince değişti) · ~~"Ekran doğruyu söyler"~~.

**ux "tek cümle" kuralını ölçülebilir hâle getiren bir test önerdi ve
TEAM.md'ye değer:** *paketten bir işi çıkarınca cümle eksik kalıyor mu?*
Burada kalıyor — *"E2 olmadan düğmeler dürüst ama form yalan söylüyor;
45 olmadan form dürüst ama düğme veremeyeceğini teklif ediyor."*

**ETİKETE GİRECEK DÜZELTME SATIRI (value'nun isteği, unutulmayacak):**
> `INPUT_FILL_RATE_SINCE` v0.3.0'ın **içindeydi**; o etiketin eksik listesi
> yanlış.

Gerekçe: **yanlış bir kayıt, düzeltmesi başka bir yerde duruyorsa hâlâ
yanlış kayıttır.** 14 gün sonra ölçümü okuyan kişi etikete bakıp "bu ölçü
daha yoktu" diye yanlış sonuç çıkarır.

### Şekil kararı: hata kutusu `ActionForm`'a GÖMÜLMEDİ (dev-ui kazandı)

value-2 kök neden gerekçesiyle gömülmesini istemişti (13 kopya yerine tek
kaynak). **dev-ui karşı çıktı ve gerekçesi üstündü:** üç form (`sign-in`,
`sign-up`, `species-settings`) `ActionForm` **kullanmıyor** — gömülseydi
kuralın **kapsamadığı üç form** kalırdı. value-2 pozisyonunu değiştirdi:
**"kopya sayısını azaltmak, kapsamı daraltmaya değmez."**
"Garanti kaydırma hedefi" şartı başka yoldan karşılandı: sabitlenen şey
kutunun **yeri** değil, **`[role="alert"]` sözleşmesi.**

### `ForbiddenState`'in metni DOKUZ ROTA İNMEDEN ÖNCE düzelmeli (ux)

`messages/tr.json:704` bugün diyor ki: **"Bu bölüm yalnızca yöneticiler
içindir."** Yazıldığı iki yer (`/staff`, `/settings`) için doğruydu.
**Bugün bile yalan söylüyor ve kanıtı elimizde:** `/audit` kapıyı
`audit.read` ile kuruyor ve o izin **`VETERINARIAN`'da da var** (ana oturum
doğruladı) — yani dört çağrı yerinden birinde cümle şu an yanlış.
Dokuz yeni çağrı yeri eklenince `/visits/new`'den çevrilen bir `VET_TECH`
*"demek ki yönetici olmam lazım"* diye okuyacak, oysa **yanındaki veteriner
iki saniyede yapabilir.**

**Çözüm tek genel metin, prop yok:** *"Bu bölüm rolünüze açık değil.
Erişmeniz gerekiyorsa klinik yöneticinizle görüşünüz."* Başlık zaten olguyu
söylüyor; açıklama **nedeni ve kime gidileceğini** söylüyor ve on rotanın
onunda da doğru.
**`description` prop'u açılmıyor** (ux + value): kaybedilen özgüllük zaten
ikinci cümlede duruyor, ve tek cümle için iki varyantlı bir yüzey açmak
**dokuz çağrı yerinde kullanılmayan bir prop** bırakır (madde 30).

**ZAMANLAMA ŞARTI, bağlayıcı:** metin **kapılardan önce ya da aynı
commit'te** iner. Sonra inerse arada dokuz ekran yanlış cümle gösterir — ve
bu, *"ekran, yapmadığı şeyi vaat etmiyor"* diyen bir sürümde **ekranın
olmayan bir kısıtı vaat etmesi** olur.

### 45 genişledi: sayfa kapıları da taranacak (ux, üçüncü vaka)

**İki ajan bağımsız olarak aynı kusura vardı ve ana oturum doğruladı.**
dev: *"`pets/new/page.tsx` tarama testini **yanlış nedenle** geçiyor —
geçiren `can()`, başka bir şeyi koruyan `settings.manage`."*
ux: *"asıl kusur bir satır yukarıda: sayfa hiç `pets.write` kapısı
taşımıyor."* **Doğrulandı:** `app/(app)/pets/new/page.tsx`'teki tek `can()`
çağrısı `:64`'te ve `settings.manage` için.

**Bugünkü davranış:** `VET_TECH` o sayfaya **giriyor** ve klinikte müşteri
olsun ya da olmasın **hiçbir zaman bitiremiyor** — müşteri varsa `PetForm`
açılıyor, dolduruyor, gönderiyor, **servis reddediyor.** Paketin cümlesinin
tam ihlali.

**ux bir metin yazmayı REDDETTİ ve gerekçesi TEAM.md 30'un uygulaması:**
value-2 boş hâl için bir cümle istemişti ("hayvan ekleyebilir ama müşteri
ekleyemez" kullanıcısına). ux ölçtü: `lib/permissions.ts`'te **`pets.write`
ve `clients.write` birlikte hareket ediyor** — ADMIN, VETERINARIAN ve
RECEPTIONIST'te ikisi de var (`:44/:47`, `:69/:72`, `:103/:105`),
`VET_TECH`'te ikisi de yok. **O rol bu uygulamada mevcut değil**, yani
cümlenin **sıfır çağrı yeri** olurdu. *"Kullanılmayan bir çeviri anahtarı
da kullanılmayan bir prop kadar borçtur."* Boş hâlin metni **semptom**;
düzeltilecek şey sayfanın `ForbiddenState` kapısı (`session` `:24`'te,
`can` `:5`'te zaten var).

**Yan etki, atlanmasın:** sayfa `pets.write` ile kapandıktan sonra dev'in
indirdiği düğme kapısı **ölü koda dönüşür** — oraya ulaşan herkesin
`clients.write`'ı da vardır. **Kaldırılmalı**, yoksa okuyana **var olmayan
bir vakayı varmış gibi** anlatır.

**SAYIM — value-2 sekiz dedi, ana oturum saydı: DOKUZ.** (`next` @ `e2bfc47`)
On yazma rotasının **dokuzunda** sayfa izin kapısı yok:
- **Yedisinde `can(`/`requirePermission` hiç yok:** `appointments/new` ·
  `appointments/[id]/edit` · `clients/new` · `clients/[id]/edit` ·
  `invoices/new` · `visits/new` · `visits/[id]/edit`.
- **İkisinde `can()` var ama YANLIŞ izni koruyor** —
  `pets/new:64` ve `pets/[id]/edit:51`, ikisi de
  `can(session.user.role, "settings.manage")`, yani ayarlar bağlantısını
  gösterip göstermemeye karar veriyor; sayfanın kendisiyle ilgisi yok.
  **İkisi de dev'in tarama testini bu yüzden geçiyor** — `pets/new` için
  dev'in bildirdiği "yanlış nedenle geçiyor" vakası **tek değil, çift.**
- **Doğru kapılı tek rota: `staff/new:12`** —
  `can(session.user.role, "users.manage")` + `ForbiddenState`. Desen bu.
**45'te düğmeleri kapattık, kapıların kendisi açık kaldı.**

**45'in kapsamı genişledi (ux):**
1. Yalnızca düğmeler değil, **sayfa kapıları** da taransın — **tüm `new/`
   ve `edit/` rotaları.**
2. Kural teste bağlansın: **yazma yapan her rota bir izin kapısı taşır.**
   *"Dördüncü ekranı elle bulmak istemiyorum."*

**Üçüncü vaka olması kayda değer:** `/audit` (43) → `appointments/[id]`
(45'in doğuş yeri) → `/pets/new`. **Üçünde de tek ekran düzeltildi, sınıf
kapatılmadı, sınıf yan ekranda yeniden çıktı.**

**Kapsam notu (ux, 30c):** yalnızca bu izin çifti ölçüldü. Başka bir
sayfada "X yapabilir ama Y yapamaz" boşluğu **gerçek olabilir** ve orada
gerçekten bir metin gerekir; 45'in taraması çıkarırsa o zaman yazılır.
*"Bugün yazarsam hangi rol için yazdığımı bilmeden yazmış olurum."*

### Fatura iptali: `invoices.void` ADMIN'de KALIYOR (value kararı)

dev, 45 düğmeyi gizlemeden **önce** sordu — 30c'nin doğru uygulaması:
*gizlenince görünmez olacak bir ürün sorusu, kapanmadan önce sorulur.*
**Artık varsayılan değil, karar.** Gerekçe koddan: `VETERINARIAN` ve
`RECEPTIONIST` **ikisi de** `invoices.read` + `invoices.write` taşıyor,
**ikisi de `void` taşımıyor** — desen tutarlı: **fatura kesmek evet, iptal
etmek hayır.** Tek veterinerli klinikte bedeli sıfır (o veteriner zaten
ADMIN), çok veterinerli klinikte istenen ayrım.

### Önleyici kayıt: 39 bu konuda EMSAL DEĞİLDİR

`voidInvoice`'ın **geri dönüşü yok** (`modules/invoices/service.ts:163`;
`unvoidInvoice` diye bir şey yok) ve bu **39'un arşiv kusuruyla aynı şekle
sahip ama aynı sınıf değil.**
**İptal geri alınamaz ve bu kasıtlıdır:** iptal edilmiş fatura bir
**muhasebe kaydıdır**, düzeltme yolu **yenisini kesmektir**. Arşivdeki
kusur, *yumuşak bir kelimeyle sunulan geri alınamaz bir eylemdi*; burada
eylem gerçekten geri alınamaz ve öyle olmalı.
**Yazılma sebebi (30b'nin önleyici hâli):** yazılmazsa biri altı ay sonra
**39'u emsal gösterip "iptali de geri alalım" der.** Aynı not koda da
yorum olarak giriyor.

### Bir sonraki sürümde ölçülecek kural (32c, value dev'in adayını kabul etti)

> **"Kesme sırası her işin kendi metnine yazılır; bir kez kural olarak
> konması yetmez."**

İddia ölçülebilir ve bu turda **iki gözlemi var:** 20'de yazıldı ve
**tuttu**, 42a'da yazılmadı ve **tutmadı**.

**İki hat, tek cümle:**
- *Yapamayacağın eylem sana teklif edilmez* — **45**
- *Yaptığın hata baktığın yerde görünür* — **E2 + kaydırma**

~~Önceki adı: "Hata, kullanıcının baktığı yerde görünür"~~ — tek hatlıydı,
aşağıdaki gözlem tam da onu anlatıyor.

### Kesim şartı (ikisi de gerekli, sırası önemsiz)
1. ~~**dev:** `app/route-states.test.ts`'e **45'in tarama testi.**~~
   **İNDİ `e2bfc47`** — kural: `/edit` ya da `/new`'e giden `href` taşıyan
   her `page.tsx` bir yerde `can(` çağırmak zorunda. **11/11 geçiyor**,
   geriye dönük iş yok. dev testi `prescriptions/page.tsx`'e korumasız bir
   bağlantı ekleyerek **bozup düşürdü**, rotayı adıyla bildirdiğini gördü,
   geri aldı. Kapılar: **461 test / 49 dosya.**
   **Tarif dışı iki ekleme, ikisi de doğru:**
   (a) **Regex bir gün eşleşmeyi bırakırsa liste boşalır ve asıl test
   SESSİZCE YEŞİL kalırdı** — ikinci bir test (`withWriteRoute.length > 5`)
   bunu yakalıyor. Testin kendi sessiz yanlışına karşı test.
   (b) **Testin neyi KONTROL ETMEDİĞİ yorumda yazılı** (TEAM.md 30c):
   sayfanın o bağlantı hakkında sorup sormadığı ve **doğru** izne bakıp
   bakmadığı.
   **Somut açık vaka, value'ya karar için bildirildi:**
   `app/(app)/pets/new/page.tsx` boş hâlinde `/clients/new`'e bağlanıyor ve
   testi **yanlış nedenle** geçiyor — geçiren `can()`, başka bir şeyi
   koruyan **`settings.manage`.** Düzeltilmedi, kapsam dışıydı.

1b. (eski madde metni, kayıt için) `app/route-states.test.ts`'e 45'in tarama testi. Kural bugün
   **11 sayfanın 11'inde** tutuyor, yani test **yeşil inecek** — sınıfı
   geri gelmekten koruyan şey bu (TEAM.md 6).
2. **dev-ui:** E2 süpürmesi **VE** `action-form.tsx` kaydırma ayağı —
   **tek görev, ayrılmaz.**
   **Neden ayrılmıyor (value, TEAM.md 17b):** toast'ı silip hatayı formun
   başına koyarsak ve **alta kaymış kullanıcıya kutu gösterilmezse,
   kullanıcı bugünkünden AZ bilgi görür.** Görünür parça (toast'ın gitmesi)
   inip işi yapan parça (hatanın göze girmesi) kesilirse süpürme
   **gerileme** üretir.

### Hata bölgesi `ActionForm`'a giriyor (ux kararı, value'nun itirazı ölçümle karşılandı)

value "13 dosyaya kopya mı, tek kaynak mı" diye sordu ve tek kaynağı
savundu; ux **ölçtü ve onayladı:** bugün `Callout` taşıyan **on formun
onunda da** kutu `<ActionForm>`'un **ilk çocuğu**, istisnasız
(`appointment:56`, `invoice:57`, `sign-in:19`, `sign-up:19`, `visit:43`,
`reminder:61`, `client:37`, `payment:62`, `pet:111`, `staff:22`) —
`client-form` ve `pet-form`'da `FormSection`'lardan önce, `payment-form`'da
gizli input'tan bile önce. Yani *"form başına ayarlanabilirlik" korunacak
bir şey değil: gömmek hiçbir esnekliği öldürmüyor, yalnızca on ikinci
formun farklı karar verme ihtimalini öldürüyor.*

**Üç uygulama şartı (ux):**
1. Kutu **ilk çocuk**.
2. Sınıfı **`sm:col-span-2`** içerir — ızgaralı formlarda (`reminder-form`)
   gerekli, flex'te etkisiz.
3. **Kaydırma hedefi bileşenin kendi ref'i**, `querySelector('[role="alert"]')`
   **değil** — o arama ikinci bir alert varsa yanlış hedefi bulur.

**ux'in yakaladığı çakışma, dev-ui kontrol edecek:** `invoice-form:58-60`
`state.fieldErrors.lines` için **ikinci bir `Callout`** çiziyor; `lines` bir
form elemanı adı olmadığı için `reportHomelessErrors`
(`action-form.tsx:147-161`) onu zaten `state.error`'a katlıyor olabilir —
o hâlde **aynı mesaj iki kutuda** çıkar.

**Odak taşımama kararının yorumu, hangi gözlemin kararı değiştireceğini de
yazacak:** pm "sayfa zıpladı, düğmemi kaybettim" bildirirse **odak taşıma +
`live={false}` birlikte** gider.

**Sayı düzeltmesi:** ux'in listesi 12 form diyor, bugün `next`'te
**13 dosyada** `toast.error` var — `reminder-form.tsx` listede yoktu.
**Kabul kriteri dosya sayısı değil, grep'in temiz çıkması.**

**Duran kapılar — DÖRDÜNCÜ sürüme giriyor:** §10 `SENT` kaydı · 390px turu.
İkisi de pm'de, ikisi de paketi **bekletmiyor**; gelmezlerse etikete
**sayısıyla** yazılır. value pm'e 390px için öncelik verdi: **önce bu
paketin dokunduğu ekranlar.**

**Girmeyenler, adıyla:** 40'ın silmeleri · 38 · 21.

**Etiket hatırlatması:** `HEAD`'e değil, **kapıların koşulduğu hash'e**
(v0.3.0'ın hatası, TEAM.md'de kural).

**Tek iş: E2 süpürmesi.** ux ölçtü: **18 formun 12'sinde kendi koyduğumuz
kural tutmuyor** — 4'ü hem `Callout` hem toast (`client-form:38`,
`payment-form:43`, `pet-form`, `staff-form`), **8'i yalnızca toast**
(`clinic-settings`, `diagnostic`, `note`, `notification-settings`,
`prescription`, `species-settings`, `treatment`, `vaccination`).

**Seçilme gerekçesi (ux, value kabul etti):** 32c'yi bu turda yazdık
("konan kuralın tuttuğu ölçülür") ve **ilk ölçtüğümüz kural tutmamış
çıktı.** Bunu kapatmadan yeni bir tasarım alanı açmak, **ikinci bir
tutmayan kural üretmek** olur. Kural **kaldırılmıyor, güçlendiriliyor** —
gerekçesi hâlâ geçerli.

**Ağırlaştırıcı sebep:** sekizden beşi (`diagnostic`, `note`,
`prescription`, `treatment`, `vaccination`) `/visits/[id]` ve `/pets/[id]`
içinde **katlanır `<details>` bloklarının içinde.** Kullanıcı açtığı bloğa
bakıyor, toast **sayfanın köşesinde** beliriyor ve kayboluyor. "Kaçırılan
toast" argümanı burada en ağır hâlinde.

**Ölçülebilir kabul:** `grep -c 'toast.error' components/forms/*.tsx` →
yalnızca yorum eşleşmeleri. **Kural teste bağlanır** (TEAM.md 6), yani geri
gelmez. **`toast.success` hiçbir yerde silinmez** — başarı toast'a, hata
forma.

**Kesim şartı:** E2 süpürmesi biter, `grep` temiz, test yazılır.
**Tek hat (dev-ui), tek iş, tek cümle.**

**Ayrıca pakette (v0.3.0'dan düşen açık borç):** `5530acb` yetki kapısı —
`appointments/[id]/page.tsx:73` `can(session.user.role,
"appointments.write")`, servisin zorladığı iznin aynısı; "Düzenle" (`:94`)
ve "Sonucu kaydedin" (`:203`) aynı kapının arkasında, kapanış cümlesi
`VET_TECH`'e görünmeye devam ediyor. **Paketin cümlesine uymuyor ama açık
borç taşımama kuralı cümle kuralının önünde.**

**Girmeyenler, adıyla:** **45** (eylem düğmelerinin rol kontrolü, tüm
ekranlar + test) → **v0.5.0** · 40'ın silmeleri + tarama testi · 38 · 21.

**DURAN KAPILAR (paket içeriği değil — TEAM.md, Sürüm ritmi):**
§10 `SENT` kaydı · 390px turu. Gelmedikleri her sürümde sayısıyla yazılır.

**Açık soru (dev-ui'de):** uzun ayarlar formlarında hata kutusu formun
başındayken alta kaymış kullanıcı onu da kaçırabilir. `ActionForm` zaten
hataya kaydırıyorsa soru düşer; kaydırmıyorsa ux ayrı karar verecek ama
**B-5'i bekletmeden.**

---

## v0.4.0'ın önceki iki adı (ikisi de düştü)

**Vaat değişti**, çünkü ölçüm borçlarının **ikisi kapandı**:
`INPUT_FILL_RATE_SINCE` (`454f02c`) ve 42a'nın ekran yarısı (`e709bf1`).
value ikisini de doğruladı: ölçüm satırı `cutoff 2026-09-21T09:02:50Z ·
before 11/2 · after 0/0` veriyor, yani **donmuş tabanı ayrı alanda taşıyor**
ve 14 gün sonraki karşılaştırma tek bakışta okunacak; `messages/tr.json:289`
ux'in birleşik cümlesini birebir taşıyor, `:290` "Sonucu kaydedin".
**42a'nın ölçüm eşiği artık ölçülebilir** — mekanizma yerinde.

**Sıra: §10 `SENT` kaydı → 390px turu → 45 → 40'ın silmeleri.**
**İlk ikisi pm'de ve ikisi de ÜÇ SÜRÜMDÜR devrediyor — v0.4.0 esasen
pm'in paketi.**

### 45'in birinci ayağı: uygulanmamış bir karar

**Bu bir unutma değil.** `app/(app)/appointments/[id]/page.tsx`'te `can(`
**hiç geçmiyor** — ne `:92`'deki "Düzenle"de, ne `:198`'deki yeni "Sonucu
kaydedin"de. ux önce yeni düğmeyi bilerek korumasız bırakmıştı, value karşı
çıktı, **ux pozisyon değiştirdi ve ikisinin aynı commit'te korunmasına
karar verdi.** Karar uygulanmadı, yani **bilinen bir kusurun ikinci örneği
bile bile eklendi** — tam olarak eklememeye karar verilen şey. dev'e ux'in
"evet"i iletildi; tek `can` importu, `:44`'te `session` zaten elde.
**Yazılmazsa etikete yumuşatılmadan yazılır:** *"aynı sayfada aynı rotaya
giden iki düğme de yetki kontrolsüz; ikisinin birlikte korunmasına karar
verilmişti, uygulanmadı."* **Kararın uygulanmaması, kusurun kendisinden
daha kayda değerdir.**

**`shadow-sm` ölçümü eksik sayılmıyor** (value): gölge ayağı **yazılmadı**,
yani yazılmamış bir şeyin ölçümü eksik değil — sırası gelmemiş.

---

## v0.4.0'ın eski vaadi — "Ölçebildiğimiz ve kapatabildiğimiz" (düştü)

**Neden bu vaat:** üç eksik tek tek küçük ama **aynı yöne bakıyorlar —
kod iniyor, cevap inmiyor.** `INPUT_FILL_RATE_SINCE` **ikinci sürümdür**
inmedi; 42a'nın ekran yarısı olmadığı için **onun ölçüm eşiği de
ölçülemez** durumda; `SENT` **üçüncü kez** sıfır. Bu paket onları
kapatmak için var.

**Sıra:** `INPUT_FILL_RATE_SINCE` → **42a'nın ekran yarısı** → §10 `SENT`
kaydı → **45** → 40'ın silmeleri. **38 ve 21 ayrı pakette.**

**(45) — eylem düğmelerinin rol kontrolü, tüm ekranlar + kuralı sabitleyen
test.** 43'ün dersi tam burada işliyor: *orada vakayı kapattık, sınıfı
kapatmadık, sınıf hemen yan ekranda çıktı.*
**Sınıflandırma kesinleşti (ux + value):** servis aynı izni zaten zorluyor
(`modules/appointments/service.ts:22,58,95`), yani **güvenlik açığı yok —
dürüst olmayan bir arayüz var.** 43'ten farkı bu: orada veri sızıyordu,
burada boşa giden bir tıklama var.
**Uygulama şartı:** kapı `can(session.user.role, "appointments.write")`
ile kapanır — arayüz **başka bir izne bakarsa iki yer ayrışır.**
**ux pozisyon değiştirdi ve gerekçesi kayda değer:** *"tutarsızlığı
önlemeyi hedefliyordum, kusuru korumayı değil; aynı fiyata daha iyi sonuç
varken pahalı olanı seçmişim."* İki düğme (başlıktaki "Düzenle" ve yeni
"Sonucu kaydedin") **aynı commit'te** korunacak.
**`VET_TECH`'in göreceği ekran kayda geçti:** kapanış cümlesi durur,
altındaki eylem olmaz — *yapamayacağı bir işi ona teklif etmiyoruz ama
olan biteni de saklamıyoruz.*

**Açık süreç notu (dev bildirdi):** `app/(app)/{pets,visits,appointments}/[id]/page.tsx`
değişikliklerinin bir kısmı dev-ui'nin commit'lerinin içinde kaldı —
paylaşımlı dosya `git add <dosya>` ile alınmış. **Kod doğru, yalnızca
commit atfı karışık.** Düzeltilmiyor (churn), ama paylaşımlı dosya
kuralının neden hunk seçimi istediğinin somut örneği.

---

## v0.3.0 — KESİLDİ (`v0.3.0`, 21 Eylül 2026)

**Etikette vaat "v0.2.0'ın borçları kapanıyor" olarak yazıldı; value'nun
onayladığı cümle "Doğru bilgi, doğru kişiye, doğru yerde"ydi ve "es"i
kesimden sonra ulaştı.** Etiket yeniden yazılmıyor (kural), ama ikisi de
aynı paketi tarif ediyor. **Value'nun etikete istediği ve oraya
yetişemeyen not buraya yazılıyor:** *"bir paket bir öncekinin açık borcunu
taşımaz" kuralının ilk gerçek sınavı 43b'ydi ve **tuttu**.* TEAM.md'ye de
işlendi.

### Plan (kesimden önceki hâl)

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
