# PARTİ: "Hekim kendi Excel'ini onboarding'de yükleyebiliyor."

**Sahibi:** ana oturum (lead). **Kullanıcı kararı, 26 Eylül 2026:**

> *"exceli almak lütfen. yapılsın. onboardingde excel yükleyebilmeli.
> Bu arada task list yap lead. ajanları aç. Task listen harici ek
> geliştirmeler yapılmasın. Biten her 10 taskta 1 sürüm çıkılıp tüm
> ajanlar durdurulsun. Bana sunulmadan önce pm playwright üzerinden test
> etmeli. World-class bir takım ruhu kurmalıyız."*

Bu dosya bu partinin **tek kaynağıdır**. `.claude/BACKLOG.md` 23 Eylül
11:59'da durdu ve ondan sonra 56 commit indi — parti sırası için o dosyaya
değil buraya bakılır.

---

## PARTİNİN CÜMLESİ

*"Hekim kendi Excel'ini onboarding'de yükleyebiliyor."*

Bir iş bu cümleden çıkarıldığında cümle eksik kalmıyorsa o iş bu partide
değildir (TEAM.md, "tek cümle" kuralının ölçüsü).

## AÇILIŞ ÖLÇÜMÜ (lead, 26 Eylül 2026, HEAD `10ca46a`)

- `grep -rn '/import' app components modules lib` → kendi dosyaları
  dışında **sıfır** eşleşme. `/import` uygulamanın hiçbir yerinden
  erişilemiyor: kenar çubuğunda yok, panelde yok, `first-step-card`'da
  yok, `preview-panel`'de yok.
- Yetki kapısı **var ve tek yerde**: `modules/import/request.ts:30`
  (`clients.write` + `pets.write`), `plan` · `commit` · `undo`
  rotalarının üçü de `importContext()`'ten geçiyor; sayfa
  `app/(app)/import/page.tsx:37` `ForbiddenState` veriyor. **Burada iş
  yok** — bu satır "bakıldı, temiz" diye yazılıyor.
- **Kısıt, ve partinin ilk işinin sebebi:** `components/first-step-card.tsx`
  yorumu kartın **tam olarak iki hâli** olduğunu, üçüncü bir satırın onu
  kurulum sihirbazına çevireceğini yazıyor. Excel girişi oraya konursa o
  kısıt çiğnenir. Kararı `ux` verir, lead vermez.

## ZEMİN (parti boyunca geçerli)

- **Dal `main`.** `next` tamamen main'in içinde (main 393 önde, next 0).
  Son 393 commit main'e indi; parti de main'de yürür, etiket main'e atılır.
- **3005'te üretim derlemesi `a259d5c` sunuyor — HEAD'in 4 commit
  gerisinde.** Ölçüm alan herkes `SERVED_COMMIT.txt`'in `commit:` satırını
  `git rev-parse HEAD` ile karşılaştırır.
- `BUILDING` dosyası ağaçta duruyor, `pid=86435` **ölü** — ama bu kilit
  **bayat değil, TEMİZLENMEMİŞ** (sebebi E7).
- Zemini oynatan her iş (tazeleme, paket kurma, commit, paylaşımlı dosya)
  **önce `E2E_RUNNING`'e ve PID'ine bakar**, sonra haber verir. **Ve 26
  Eylül'ün dersi: yazmaya başlamadan HEMEN ÖNCE bir daha bakar** — kilidi
  koşudan önce okuyup yazarken tekrar okumamak bugün iki koşu bozdu.

### PORT → AĞAÇ EŞLEMESİ (26 Eylül'de ölçüldü — üçü aynı gün yanlış okundu)

`SERVED_COMMIT.txt` "PORT 3005" diyor ve **doğru** diyor; ama aynı ağaçtan
birden fazla port sunuluyordu ve damga yalnız birini tanıyor. `ux`
neredeyse 3001'de ölçüyordu, ve 3011 aynı tuzağın daha sinsisiydi çünkü
**aynı ağaçta** duruyordu — `cd` ettiğin yer doğru olsa bile port yanlış
olabilir.

| port | ağaç | ne | damga |
|---|---|---|---|
| 3000 | `Manifest` | `next dev` | yok, damgalanmaz |
| 3001 | `Manifest-prod` (ayrı worktree, detached) | `next start` | **kendi** `SERVED_COMMIT.txt`'i, kendi `refresh-prod.sh`'ı |
| 3005 | `Manifest` | `next start`, `.next-prod`'dan | `Manifest/SERVED_COMMIT.txt` — **ölçümlerin zemini budur** |
| ~~3011~~ | ~~`Manifest`~~ | **26 Eylül'de kapatıldı, kullanıcı kararı** | — |

**Ölçüm raporu üç terim taşır: port + ağaç + BUILD_ID.** İkisi yetmiyor,
çünkü `cat SERVED_COMMIT.txt` hangi dizinde çalıştığına göre iki farklı ve
**ikisi de doğru** cevap veriyor.

**3011 neden kapatıldı, ve neyi kaybettik:** 21 Eylül'den beri (4 gün 19
saat) ana ağaçtan sunuyordu, **artık kurulu olmayan** `next-server v16.2.6`
ile, ve sunduğu derleme **diskte yoktu** — `.next/BUILD_ID` 23 Eylül'de
üzerine yazılmıştı. Cevap veriyordu (200, 0,41 sn), yani oraya bakan biri
**çalışan bir ürün** görürdü; hangi commit olduğu ise hiçbir yerden
okunamıyordu (silinmiş dosya tutmuyordu, Next 16 statik yollara BUILD_ID
gömmüyor). Kapatmakla o derleme **bir daha üretilemez** hâle geldi; bedeli
bilerek ödendi, çünkü ölçüm turunda yanlış cevap verebilecek en hazır yer
odur. `dev-ui` buldu, `serve-prod.sh`'ın kendi yorumu tehlikeyi zaten
yazıyordu: *"next dev ve next start ikisi de `.next`'e varsayılıyor."*

### AÇIK BORÇ: SINAV VERİSİ TEMİZLENMİYOR (26 Eylül, `dev` ölçtü)

Paylaşımlı üretim veritabanında **3569 klinik** var; **son üç saatte 304**
eklendi. Süit her testte `signUp()` çağırıyor, yani **her koşu ~57 klinik
bırakıyor ve hiçbiri silinmiyor.** Aynı gün süit süresi **5,2 → 7,1 → 8,5**
dakikaya çıktı (`dev-ui`'nin koşusu 9,4), ve dört koşunun kırmızı kümeleri
**birbiriyle kesişmiyor** — hepsi 20+ sn zaman aşımı, hiçbiri iddia hatası
değil, çoğu `signUp` yardımcısında.

**Bu kırmızıların kanıtlanmış sebebi DEĞİL** (boşta `select 1` 73 ms, aktif
bağlantı 13–15, `auth/service.ts` O(1) ve klinik sayısıyla büyümüyor) — ama
ölçümlerin üstünde durduğu zemin, ve **tek yönde büyüyor.** Etiket mesajına
bu haliyle yazılır, gizlenmez. Parti 2 kalemi: süit kendi kliniklerini
toplasın, ya da testler tek klinik paylaşsın.

## İŞLEYİŞ — bu partinin kuralları

1. **Liste dışında iş yapılmaz.** Yol üstünde bulunan kusur **düzeltilmez**,
   lead'e bildirilir ve sonraki partiye yazılır. Kapı maddeleri
   (`tsc`/`eslint`/`vitest`/erişilebilirlik) bu kuralın dışındadır.
2. **Her iş kendi kapılarından geçer**, commit eder, lead'e **ne yaptığını
   VE ne yapmadığını** yazar.
3. **`pm` sonda ölçer**, tek koşuda tüm listeyi alır (TEAM.md, 22 Eylül
   kullanıcı kararı). Kullanıcıya sunumdan önce **Playwright zorunlu**.
4. **10 iş bitince sürüm.** Es → kapılar → pm kabulü → etiket `v0.12.0` →
   **tüm ajanlar durdurulur.** Sonra yeni parti.
5. **Ölçüm hash taşır.** Zemin değişince o zeminde alınmış açık ölçüm
   işaretlenir, silinmez.

---

## LİSTE — 10 iş

| # | Sahip | İş | Bağlı |
|---|---|---|---|
| E1 | `ux` | Excel girişi onboarding'de **nerede** durur | — |
| E2 | `dev-ui` | Onboarding'de Excel yükleme girişi | E1 |
| E3 | `dev-ui` | Kalıcı erişim yolu (`/import` bir yerden görünür) | E1 |
| E4 | `dev` | #42 — tür sütunu yoksa *"hepsi kedi"* diyebilmek | — |
| E5 | `dev` | #45 — "Karma serisi: 2/3, gecikmiş" (sürmekte) | — |
| E6 | `dev-ui` | #12 — cila, dört madde (sürmekte) | — |
| E7 | `dev` | Kırık kilit: `e2e.sh` + `serve-prod.sh` | — |
| E8 | `dev` | e2e: onboarding → Excel → geri alma yolu, TR **ve** EN | E2 |
| E9 | `dev-ui` | `/import` 390px + koyu tema (hiç taranmadı) | — |
| E10 | `pm` | Playwright kabul turu + sürüm kapısı | hepsi |

### E1 — `ux`: Excel girişi onboarding'de nerede durur (KARAR İŞİ)

Kod yazılmaz. Çıktı: E2 ve E3 için **tek cümlelik yer kararı + kırmızı
çizgi**. Cevaplanacaklar:

- `first-step-card` iki hâlle sınırlı ve yorumu bunu gerekçesiyle yazıyor.
  Excel girişi **o kartın içinde mi**, kartın **yanında** mı, boş klinik
  ekranının **ayrı bir yerinde** mi? Üçüncü satır kısıtı çiğnenecekse
  gerekçesi yazılır; çiğnenmeyecekse alternatif yer gösterilir.
- Hekimin cümlesi zeminde: *"ben veri girmek için oturmuyorum, iş
  yapıyorum"* — ve #23: *"belki de evde çayını yudumluyor."* Excel
  yüklemek hangisine ait?
- **Yetki:** `clients.write` + `pets.write` olmayan rol girişi görmeli mi,
  yoksa cümleyi düğmesiz mi okumalı (kartın bugünkü `WAITING` deseni)?
- Boş olmayan klinikte giriş ne olur — kaybolur mu, kalır mı?

### E2 — `dev-ui`: Onboarding'de Excel yükleme girişi

E1'in kararını uygular. Yeni akış icat edilmez: `/import` ekranı hazır,
bu iş **oraya giden yolu** açar. Metin `messages/*.json`'a girer (TR+EN);
o dosya paylaşımlı, tek satır sahnelemesi `git apply --cached` ile yapılır.

### E3 — `dev-ui`: Kalıcı erişim yolu

Onboarding bir kez görünür; hekim ikinci Excel'ini altıncı ayda yükler.
`/import`'a kalıcı bir yol açılır (kenar çubuğu en muhtemel yer,
`components/sidebar.tsx:35-53` deseni: `permission` alanı var ve
`audit`/`staff` bunu kullanıyor). Doğru izin **yeni bir izin icat etmeden**
bugünkü ikiliyle hizalanır.

### E4 — `dev`: #42 — tür sütunu yoksa *"hepsi kedi"*

Görev kaydı `~/.claude/tasks/session-9ec20d33/42.json`. Ekran bugün
*"N satırda tür yok, Diğer olarak kaydedilecek"* diyor — **bildiğini
söylüyor, yapılabileni sunmuyor.** Hekim tek seçimle "hepsi kedi"
diyebilmeli. Kırmızı çizgi #20'den: **ürün önerir, karar vermez.**

### E5 — `dev`: #45 (sürmekte)

`~/.claude/tasks/session-9ec20d33/45.json`. "Karma serisi: 2/3, gecikmiş" —
hekim *"kaçıncı dozdaydık"* sorusunu ekrandan okusun. Yarım iş sürüme
giremez (TEAM.md 9): bu partinin **es** şartı.

### E6 — `dev-ui`: #12 (sürmekte)

`~/.claude/tasks/session-9ec20d33/12.json`. Dört madde: başlık tekrarı,
ölü satır, görünmeyen link, "Ara…". Aynı gerekçe: yarım iş sürüme giremez.

### E7 — `dev`: Kırık kilit — kanıt hazır

`scripts/e2e.sh` ve `scripts/serve-prod.sh` ağaçta commit'lenmemiş ve
**düzeltme çalışmıyor.** Lead'in ölçümü (26 Eylül, `10ca46a`):

- `tr ' ' '\n' | sed -n '...' "$LOCK"` → `sed` dosyayı okuyor, `tr` stdin'i
  bekliyor. `OWNER_PID` **her zaman boş**; *"başka bir derleme sürüyor"*
  satırı hiç basılamıyor. Kapatılmak istenen kusur aynen duruyor.
- `trap` satırı çalışma anında bölünüyor: `trap: invalid signal
  specification`, çıkışta `unexpected EOF while looking for matching ')'`.
  **Kilit hiç silinmiyor** — ağaçtaki `BUILDING` bu yüzden duruyor.
- **`bash -n` ikisini de temiz geçiyor.** Sözdizimi kapısı bunu yakalamaz;
  kapı **davranış** olmalı.

Doğrusu dosyayı `tr`'ye yönlendirmek: `tr ' ' '\n' < "$LOCK" | sed -n
's/^pid=\([0-9]*\)$/\1/p'` — trap tırnakları temiz kalsın diye bir
`lock_pid()` fonksiyonu tercih edilir. **Kabul ölçütü ölçümle:** canlı
PID'li kilitte `OWNER_PID` dolu gelir, betik çıkınca **kendi** kilidi
silinir, başkasının kilidi silinmez.

### E8 — `dev`: e2e — onboarding → Excel → geri alma

Boş klinikte onboarding girişinden başlayıp yükleme, plan, yazma ve
**geri alma** adımlarını yürüyen kabul testi. **TR ve EN ikisi de** —
bu depoda bir bacağın sessizce ölmesi tek dilde görünmüyor. Süit **tam**
koşulur, dosya adıyla değil.

### E9 — `dev-ui`: `/import` 390px + koyu tema

Mobil düzen bu ekranda **hiç taranmadı** (TEAM.md 24/32 mobili "işin
kendisi" sayıyor). Sütun kartları, eşleştirme tablosu ve özet 390px'te
kolon kesmemeli; koyu temada kontrast eşiği tutmalı.

### E10 — `pm`: Playwright kabul turu + sürüm kapısı

Kullanıcıya sunumdan **önce** zorunlu. Üretim derlemesinde (3005), zemin
tazelenip damga yazıldıktan sonra, TR+EN, açık+koyu, 1280px+390px.

- **Kapı işi iki yönde ölçülür:** Excel girişi yetkili rolde **var**,
  yetkisiz rolde **yok** — ve yetkisiz rol başka hiçbir rotada yanlışlıkla
  `ForbiddenState` almıyor.
- Geri alma gerçekten geri alıyor: yazılan satır sayısı ile silinen satır
  sayısı eşit.
- Her kırmızı **hash + BUILD_ID + port** ile bildirilir.

---

## SÜRÜM KAPISI — 10/10 bitince

1. **Es** — yeni iş başlamaz.
2. `npx tsc --noEmit` · `npx vitest run` · `npx eslint .` · `npm run build`
   — ana oturumda, sonuçlar etikete yazılır.
3. `pm` kabulü (E10).
4. Etiket **`v0.12.0`**, mesajda kapı sonuçları + partinin içeriği +
   **açık kalan her borç adıyla**.
5. **Tüm ajanlar durdurulur.** Sonraki parti bu dosyanın altına yazılır.
