# PetTrack — sürüm planı ve sıralama

Sahibi: `value` (Product Owner). Sıralama, "bitti" tanımı, sürüm içeriği ve
hat dağılımı buradan yönetilir. Bir iş kapandıkça durumu burada güncellenir.
Ekip ilkeleri: `.claude/TEAM.md`.

---

## Nerede kaldık (20 Eylül 2026 — önce burayı oku)

**0. Bu backlog temizlendi.** Biten işler satır olarak silindi; aşağıda
yalnızca **yapılacak** olanlar var. Neyin bittiği "Doğrulanmış, iş
gerektirmeyen" bölümünde özet olarak duruyor.

**1. Durum.** Sürüm "Güvenilir döngü", Katman 0'dayız. `main` uzaktaki
paralel çalışmayla birleştirildi ve push edildi (`6b8c2be`): **SMS kanalı,
Netgsm adaptörü, segment hesabı ve kanal seçimi zaten inmiş durumda** —
eski S1-S4 maddeleri bu yüzden silindi. Rıza alanı da `notificationsOptIn`
adına kavuştu ve varsayılanı kapalı.

~~**İki deploy blokeri hâlâ açık:**~~ **ikisi de kodda kapandı (21 Eylül
akşamı).** Tahsilat tutarının 100 kat küçük kaydedilmesi (A0-money) `0a34b01`
ile, para biriminin USD olup değiştirilememesi (29a+32) `cd407e9` ile indi.
**Ama "indi" ≠ "bitti" (TEAM.md 28): sürümü açan şey pm kabulüdür**, ve ikisi
aynı ekranlara dokunduğu için **birlikte** test edilir.

**2. Sırada ne var.** (**21 Eylül akşamı `value` tarafından git kanıtıyla
yeniden çizildi.** Önceki sıranın ilk üç adımı bayat çıktı; aşağıdaki iki sıra
geçerlidir. Bu bölüm sıralamanın **tek kaynağıdır** — mesajla çeliştiğinde
dosya geçerlidir.)

**Her iki deploy blokeri de kodda kapandı.** (A0-money `0a34b01`; 29a+32
`cd407e9`.) Ama TEAM.md 28: sürümü açan şey **pm kabulüdür**, ve kuyrukta on
commit birikmiş. Kabul sırası pm'de; **A0-money ile 29a+32 birlikte test
edilir** (aynı ekranlar).

**Bu turda git kanıtıyla "inmiş" saptananlar** (hiçbiri yeniden yapılmaz,
hepsi pm kabulü bekler): (37) elle gönderim kaçışının kanalı izlemesi —
`b0b0b24`, 34 ile birlikte; (29a)+(32) para birimi tek parça — `cd407e9`;
(11) panel grafikleri — `692b152`; 18'in ton düzeltmeleri — `e367ba3`;
(41) panel sayacı ile listenin tek kaynağa inmesi — ortak
`OPEN_REMINDER_STATUSES` sabiti.

### A hattı (`dev`) — geçerli sıra

**v0.2.0'a girenler (kalan üç iş, hepsi küçük):**
**`INPUT_FILL_RATE_SINCE` → 42a → 43b.** "Es" bu üçü inince verilir.

**v0.2.0'a GİRMEYENLER — kesme çizgisi baskı gelmeden çizildi (TEAM.md 17):**
40'ın silmeleri · 7'nin kalanı · 38 · **21** · **B-1'in C ayağı.**

- **(20) indi `7f64494`** ve kod yarısı eşiğin üstünde: üç kaydın altında
  susuyor, kayıtlar birbirini tutmuyorsa susuyor, alanı **hiç doldurmuyor**
  — çip tek dokunuş ve o dokunuş bir karar (TEAM.md 14'ün eşiğe yazılmış
  hâli). **Eksik olan ölçüm yarısı:** `INPUT_FILL_RATE_SINCE`.
  **Backlog'daki örnek cümle düzeltiliyor:** *"14 Mart 2027'de sahibine
  hatırlatma gönderilecek"* — dev haklı olarak reddetti, **hiçbir şey henüz
  hatırlatma göndermiyor** ve o cümle arkasındaki kod inmeden ekrana
  giremez. Sonraki okuyan şartname sanmasın diye buraya yazılıyor.
- **B-1 "es" şartı olmaktan ÇIKARILDI (value, pozisyon değişikliği).**
  A ayağı indi (`80f783b`); kalan **C ayağı pm'in §7 ölçümüne bakıyor** ve
  pm'i beklemek sürümü süresiz erteler. C bir **tasarım borcu**; taşıdığı
  risk yanlış veri ya da yanlış mesaj **değil**. **v0.3.0'ın ilk işi.**
  §7 esin içinde gelirse alınır, gelmezse beklenmez.
- **(21) v0.2.0'a girmiyor ve gerekçesi sürüm notuna yazılacak.** Sürümün
  vaadi üç cümle: *"yanlış bilgi görmüyor, yanlış mesaj göndermiyor,
  hatırlatmalar gerçekten gidiyor."* **Kapanış bu üçünün hiçbiri değil.**
  Ama `acknowledgeReminderAction`/`dismissReminderAction` yazılmış ve
  **hiçbir düğme çağırmıyor** — yani `/reminders` bugün bir hatırlatmayı
  **kapatamıyor.** Gerçek bir eksik, vaadi bozmuyor.
  **Sürüm notuna açıkça:** *döngü gönderiyor, henüz kapanmıyor; kapanış
  v0.3.0.* Yazılmazsa "güvenilir döngü" adı kapanışı da vaat ediyormuş gibi
  okunur — TEAM.md 33'ün sürüm notu düzeyindeki ihlali.
  **21'in hat bölünmesi onaylandı** (A tek başına: şema + servis + sorgular,
  ekran sonra) ve `closeReason` **eklemeli** gidiyor. **Bölünmeye tek şart:
  servis yarısı inerken ekranda hiçbir vaat doğmaz** (TEAM.md 33).

- **Çipin eşiği gevşetilmedi — value reddetti, gerekçesi ölçüm bütünlüğü.**
  dev, doluluk oranını yükseltmek için aşı aralığı önerisinin eşiğini
  (üç kayıt + kayıtların birbirini tutması) gevşetmeyi sordu.
  **Red gerekçesi kayda değer:** *ölçüm gerekçesiyle eşiği gevşetmek,
  ölçtüğümüz şeyi bozarak sayıyı iyileştirmek olurdu — doluluk yükselir
  ama yükselten şey veterinerin kabul ettiği doğru tarih değil,
  uygulamanın ürettiği tahmindir.* Madde 29'un ("ölçüm işi doğru tarif
  etmek içindir") en keskin uygulaması: ölçüyü memnun etmek için işi
  bozmak, ölçümü de işi de kaybettirir.

**20 ile 42a takas edildi (value onayladı, kendi sebebiyle):** dev 42a yerine
20'ye geçti; value beş mesaj boyunca *"20 kuyruktaki tek vadesi dolan iş"*
diye bastırmıştı ve **dev o sinyali aldı.** Geri çevirmek, value'nun kendi
vurguladığı gerekçeyi çürütmek ve boşuna churn üretmek olurdu; 42a'nın ölçüm
tabanı da değişmedi (hâlâ 40'ta 39), yani beklemekle bir şey kaybetmiyor.

**~~43~~ KAPANDI — `fa3d5f1`** (ana oturum yazdı; dev beş tur boyunca
atladı). `app/(app)/audit/page.tsx:18`:
`if (!can(session.user.role, "audit.read")) return <ForbiddenState />;`
`redirect` değil, `/staff` ile aynı desen. `RECEPTIONIST` ve `VET_TECH`
artık denetim kaydını okuyamıyor. value doğruladı.
**Kalan tek ayak 43b:** bağlantı hâlâ görünüyor, tıklayınca açıklamalı
yetkisiz hâl çıkıyor — bugünkünden iyi ama **v0.2.0'a taşınmamalı.**

**Çıkanlar:** 5 (`a587c2c`), 35 (`b02023d`), 36 (`7a5f739`), 40'ın taraması.

> **Kayda geçen süreç arızası:** 43, **beş tur boyunca** "sıradaki iş"
> işaretiyle açık kaldı; bu sürede kuyrukta 5., 7., 8. ve 9. sıradaki işler
> indi. value'nun *"bir sonraki commit'in 43 olacak"* talimatı dahil, beş
> ayrı yönlendirme tutmadı. value'nun tahmini: **dev sırayı Katman 0
> tablosundan kendi seçiyor ve mesajlar turun başlangıcından sonra
> varıyor.** İşlerin kalitesiyle ilgili bir şikâyet yok — sorun yalnızca
> sıra. Sonuç: açığı ana oturum kapattı. **Ders sürüm ritmine yazıldı:**
> açık bir P0 bir geçişten fazla yaşarsa geçiş geç kalmıştır.

**~~`tsc` kırıklığı~~ çözüldü** (`ea7ff56`); ana oturum teyit etti, çıkış
kodu 0. **~~39~~ indi** (`ea7ff56`, üç varlık birden — müşteri + hayvan +
vizit, **yatay**).

> **DÜZELTME (value, kendi hatası — kayda geçiyor):** önceki iki turda
> "43 ağaçta" denmişti; **yanlıştı, 43 hiç başlamamıştı.** `git status`'ta
> `app/(app)/audit/page.tsx`'in "M" görünmesi 43 sanılmıştı — o dev-ui'nin
> `EmptyState` import yolu taşımasıydı (`8207e7c`). **Ana oturum bağımsız
> doğruladı (21 Eylül akşamı):** dosyada `can()`, `requirePermission`,
> `ForbiddenState`, `redirect` **hiçbiri yok**; `components/sidebar.tsx:30`
> `/audit`'i koşulsuz taşıyor. **`RECEPTIONIST` ve `VET_TECH` şu dakika
> kliniğin tüm değişiklik geçmişini okuyor** ve bu **iki tur boyunca
> "yapılıyor" sanıldı.** Ders: "`git status`'ta M" bir işin yapıldığının
> kanıtı değildir; kanıt dosyanın içeriğidir (TEAM.md 1).

**(20) ÜÇÜNCÜ turdur kayıyor.** value dev'e şunu yazdı: **önüne bir iş
geçecekse gerekçesiyle sorulur, kendiliğinden kaymaz.** Kuyruktaki tek
"vadesi dolan" iş odur.

Önceki listede **43, 42a ve 20 hiç yoktu**; üçü de Katman 0'da açık duruyor.

**Turun sonundaki gerçek durum (21 Eylül akşamı):** 43 ve **39'un tamamı**
çalışma ağacında, **commit'lenmemiş** (33 dosya). dev 39'u **yatay** yaptı,
dikey kesme çizgisini kullanmadı; value itiraz etmedi — *kesme çizgisi baskı
içindi, baskı çıkmadıysa tam iş daha iyi.* **Sıra sapması: (20) atlandı**
(43'ten 39'a gidildi, 42a ux'te beklediği için ortada kaldı). value 20'yi
**sıradaki iş** olarak yazdı; gerekçe tekrarlandı çünkü atlanmaya en müsait
olan tam o: **kuyruktaki tek "vadesi dolan" iş.** 39'un değeri üç gün sonra
da aynı, 20'ninki değil.

1. **(43) `/audit` yetki kontrolü taşımıyor.** `app/(app)/audit/page.tsx:1`
   içinde `can`/`requirePermission` grep'i temiz; `components/sidebar.tsx:30`
   `/audit`'i koşulsuz gösteriyor. Bugün **`RECEPTIONIST` ve `VET_TECH` tüm
   denetim kaydını okuyor.**
   **Öne alınma gerekçesi zamanlama, kusurun yaşı değil (TEAM.md 16b):**
   düzeltmesi, dev-ui'nin çalışma ağacında duran
   `components/ui/forbidden-state.tsx` ile **aynı iki satır** —
   `app/(app)/staff/page.tsx` az önce `redirect("/")`'tan
   `return <ForbiddenState />`'e geçti. Bugün kopyalama; yarın aynı
   dosyaların yeniden açılması. ~~**B hattının yarım işine bağlı**~~ —
   bağımlılık çözüldü, `2949afb` indi.
   **ux onayladı:** `ForbiddenState` kullanılır; **bağlantı gizlenir *ve*
   sayfa yetkisiz hâlini gösterir** (ikisi birden, biri diğerinin yerine
   geçmez).
2. **(42a) geçmiş randevuya "randevunuz oluşturulmuştur" gidebiliyor.**
   Artık teorik değil, ölçüldü: geçmiş randevuların **39'u `SCHEDULED`**,
   1'i `IN_PROGRESS`; hepsine gönderilebiliyor. Sınıf: sessiz yanlış mesaj
   (TEAM.md 2, 12).
   **ux cevapladı — 42a artık açık, bekleyen yok:**
   - **Kart kalır, gönderim kesilir.** 8b kartı kaldırıyor çünkü orada
     uygulama sonucu **biliyor**; burada bilmiyor ve **"bilmiyorum" bir
     kapanış değildir.** Kesilen: otomatik gönderim + elle kayıt. Duran:
     "Mesajı kopyala" ve geçmiş.
   - **Cümle:** *"Bu randevunun tarihi geçti ve sonucu henüz kaydedilmedi."*
     + eylem *"Sonucu kaydedin"* → `/appointments/[id]/edit`.
     **Yeni akış değil:** durum alanı `appointment-form.tsx:110` içinde
     zaten var, yani 42b'nin kapısı aralanmıyor.
   - **Kabul eşiğine ölçüm bağlandı** (TEAM.md 29): taban geçmiş
     randevuların **40'ta 39'u `SCHEDULED`**; ölçüm kod indikten **14 gün
     sonra**, tarihe değil **olaya** bağlı.
   - **ux öncülünü doğruladıktan sonra çözümü bir adım öteye taşıdı
     (son hâli):** kesilecek olan **bir düğme değil, iki mesaj türü.**
     `prisma/schema.prisma:693-697` — randevuya ait iki `MessageKind`'ın
     **ikisi de ileriye dönük** (`APPOINTMENT_CONFIRMATION`,
     `APPOINTMENT_REMINDER`). Dünkü randevu için ikisi de anlamsız:
     **gönderilirse yanlış, kopyalanırsa yanlış, kaydedilirse yanlış bir
     şeyin kaydı.** Bu yüzden tarihi geçmiş `SCHEDULED` randevuda kartın
     **mesaj satırları hiç render edilmez**; yerine kabul edilen cümle ve
     "Sonucu kaydedin" gelir, **kart ve geçmiş mesaj listesi durur.**
     Bu, value'nun gösterdiği sessiz-yanlış tuzağını da kapatır: tıklanıp
     arkada reddedilen düğme kalmaz. Kaybolan niyet kaydı yok — "dünkü
     randevunun oluşturma bildirimini gönderdim" kaydı zaten olmamalı.
   - **ux kendi açık ucunu da geri çekti:** "kopyalayıp elle gönderenin
     kaydedecek yeri kalmıyor" dediği vaka bu ekranda **hiç yok**, çünkü
     "nasıl geçti" diye bir şablon yazılmamış; 37'ye havale gereksizdi.
   - **`MANUAL` = niyet ayrımı duruyor**, kapsamı netleşti: **niyet kaydı,
     niyetin nesnesi geçerliyse anlamlıdır.**
   - **value pozisyonunu değiştirdi ve gerekçesini yazdı (TEAM.md 7):**
     ~~"kopyalama ve kaydı dursun"~~ **düştü.** *"Ben 'niyet kaydı
     korunsun' derken niyetin **nesnesini** sorgulamamıştım. ux'in çözümü
     benim gösterdiğim tuzağı **ve** kendi açık ucunu birden kapatıyor;
     benimki yalnızca birini."* Eski gerekçe 30b gereği silinmedi.
3. **(20) R4a-1 — girdinin kendiliğinden dolması.**
   **Kesme çizgisi önceden çizildi (17b):** gösterişli parça **öneri
   mekanizması**, işi asıl yapan parça **sonucun ekranda görünmesi** —
   *"14 Mart 2027'de sahibine hatırlatma gönderilecek"* satırı. Baskı
   gelirse **öneri kesilir, sonuç satırı kesilmez.** Gerekçe: sonuç satırı
   **ilk günden** çalışır ve alanı **elle** dolduran veterineri de kapsar;
   öneri geçmiş veri gerektirdiği için **yeni klinikte hiç görünmez.**
   **TEAM.md 14 eşiğe yazıldı:** aşı aralığı **icat edilmez**, dayanak
   yoksa alan boş kalır.
   **Başarı ölçüsü değişti:** ömür boyu oran değil, **`INPUT_FILL_RATE_SINCE`**
   (kesim tarihli). Kesim öncesi küme donduruldu: **%18 (2/11).** Katman 0'ın ortasında
   kalmasının gerekçesi **ölçüm zamanlaması**: başarı ölçüsü ancak
   kullanımla değişir, geç inerse sürüm öncesi ölçüm için gün kalmaz.
   Taban tartışmalı, aşağıya bak.
4. **(39) arşivden geri alma.** `components/` ayağı **`dev-ui`'ye aittir**
   (`StatusBadge`'e `archive` kind'ı rider olarak, `restore-button`,
   `archived-filter`); `dev` yalnızca `modules/`, `prisma/`, `app/api/`
   tarafını yazar. **Ton uyarısı:** eski tarifteki "tek ton: `inactive`"
   **bayattır** — `e367ba3` tonları yeniden adlandırdı, `inactive` artık bir
   ton değil, `staff` kind'ının bir durumu. Yerine `quiet` öneriliyor
   ("geçerliliğini yitirmiş, ama hata değil"); **kararı `ux` verir.**
**39'un iki tasarım sapması kabul edildi (kayıt):** (a) rozet tonu `quiet`
— backlog satırı bayattı, gerekçe koda yazıldı. (b) **Arşivlenmiş satır
soluklaştırılmaz; opaklık düşmez, rozet tek sinyal kalır.**
**ux kendi kelimesini geri aldı:** *"'Sönük' kelimesi benimdi ve yanlıştı —
ayırt edilebilirlik istiyordum, görsel ağırlığın düşmesini değil; ikisini
tek kelimeye sıkıştırmam dev'e yanlış bir iş tarif etti."* Kararı
kesinleştiren kod kanıtı: arşivlenmiş satır **yalnızca kullanıcı filtreyi
açtığında** görünüyor (`pets/page.tsx:31`, `visits/page.tsx:27`,
`clients/page.tsx:24`) — istenerek getirilen satırı soluklaştırmak,
**sorunun cevabını küçük puntoyla yazmaktır** (ayrıca TEAM.md 26: kontrast
eşiğin altına iner). dev'in `bg-muted/40` alternatifi de alınmadı, gerekçe
ölçülebilir çakışma: `DataTable` satırları `hover:bg-muted/30` kullanıyor
(`data-table.tsx:100`), kalıcı `/40` zemin satırı **sürekli üzerine
gelinmiş gibi** gösterir ve imleç geri bildirimi ters yöne gider.
**Kapsam dışı bırakılan, bilerek yazıldı (TEAM.md 30c):** karışık listede
tarama zorlaşırsa doğru çözüm soluklaştırma değil **sıralama/gruplama**
olur; bugün açılmadı — "bakıldı, temiz" sanılmasın diye yazılıyor.
**pm'e tek kontrol:** arşiv rozeti **koyu temada ve 390px'te** okunuyor mu;
`clients/page.tsx:89` satırı zaten **iki rozet** taşıyor ve en uzun TR
etiketiyle sarabilir.

5. **(7)'nin kalanı** — vefat/arşiv/sahip değişikliği hijyeni. 39 ile
   bitişik tutulur: aynı arşiv kavramı, aynı liste sorguları, aynı rozet.
6. (5) liste yeniden doğrulama → (35) → (36) → (40) → (38) `/reminders`
   zemini.
7. **(21) R4a-2** — sürümün en büyük işi, **takvim riski burada.**
   `closeReason` kolonu **yok**, yani 21 hiç başlamamış.
   **Kesme çizgisi (önceden çizildi, baskı altında değil — TEAM.md 17):**
   Katman 0 uzarsa kesilecek olan 21 değil, kuyruğundaki küçük işlerdir —
   **35, 36, 40 ve DESIGN-1'in kalanları** o sırada feda edilir.

### B hattı (`dev-ui`) — geçerli sıra

~~**Yarım iş (+19b)**~~ **indi** (`2949afb` + `8207e7c`) →
**B-1 = A (etiket/değer) + C (yarıçap/yüzey)** → **B-2** → **43b**.
`numeric` de indi (`8207e7c`), tabular figures `a6898fc`. (`ux` dört paket şartnameledi, `value` iki noktada düzeltti:
**11 kuyruktan çıktı** ve **19b yarım işin içine alındı.** B-1/B-2 sırası ve
içeriği ux'in yazdığı gibi duruyor.)

1. ~~**Yarım iş birinci, ve 19b onun içinde.**~~ **İNDİ `2949afb`** —
   `ForbiddenState` + rota `not-found`'ları **ve 19b'nin kalanı**:
   `components/empty-state.tsx` → `components/ui/empty-state.tsx` taşındı.
   B hattının ilk iki adımı bitti; **sıradaki B işi A+C paketi.**
   Kayıt için kapsam:
   Çalışma ağacında sahipsiz duran `components/ui/forbidden-state.tsx`,
   `components/ui/not-found-state.tsx` ve altı rota `not-found.tsx`'i
   tamamlanıp commit edilir. **43 buna bağlı** (A hattı bekliyor).
   **19b'nin buraya alınma gerekçesi (value):** `forbidden-state.tsx`
   `@/components/empty-state`'ten import ediyor ve 19b'nin kalanı **tam o
   dosyayı** `components/ui/`'ye taşımak. Ayrı bırakılırsa aynı dosya bu
   turda ikinci, import yolları üçüncü kez açılır (TEAM.md 16b).
   **19b'nin kapsamı (ux):** `EmptyState` `components/ui/`'ye taşınır,
   `size="inline"` eklenir, **dokuz çıplak boş-hâl paragrafı** ona çevrilir.
   **`NotFoundState` ile `ForbiddenState` birleştirilmez** (ux kararı): biri
   varlık sızdırmamak için "bulunamadı" der, diğerinde sızdıracak bir şey
   yoktur.
1b. **`8207e7c` ayrıca 19b'yi ve C2'nin iki yuvasını bitirdi** (ux teyidi):
   `EmptyState` `components/ui/`'ye taşındı, `size="inline"` eklendi,
   **on bir** çıplak paragraf dönüştürüldü; aynı commit `DataTable.numeric`
   yuvalarını panel ve `charts.tsx` tarafında kapattı.

**B-2 B-1'den ÖNCE indi** (`3eb6be6`; `a0d9da8` panelin boş bölümleri).
~~**ve sıralama gerekçesinin bedeli aynı commit'te çıktı**~~ — **bu iddia
geri çekildi (value, ana oturum doğruladı):** `confirm-dialog.tsx`'teki
`Card` dizgisi **yeni değildi**, `3eb6be6^` satır 14'te birebir duruyordu;
diff'te `+` görünmesi `cva()` sarmalayıcısının kaldırılıp yeniden
girintilenmesindendi. TEAM.md **32d bu yüzden geri çekildi.**
**Kanıt hafifçe ters yöne bakıyor:** dev-ui o commit'te aynı dosyadan
**çağrı yeri olmayan iki soyutlamayı kaldırdı** (varyantsız `cva`,
referanssız `ConfirmDialogTone`) — B-2 yeni değer çivilemedi, iki tanesini
söktü.
**Ayakta kalan tek şey:** o dizgi hâlâ elle yazılmış bir `Card` kopyası ve
**B-1'in süpürme listesinde** — ama "B-2 yüzünden doğdu" diye değil, en
baştan orada olduğu için. (`shadow-lg` doğru ve kalıyor: dialog yüzen
katman.)

**`ConfirmDialog choices` B kuyruğundan ÇIKTI — 21'in riderı oldu.**
dev-ui itiraz etti, ux kendi kararını geri çekti, value kabul etti: bugün
**sıfır çağrı yeri** olurdu, tek tüketicisi inmemiş 21. ux hatasının
kaynağını da tarif etti ve cümle saklanmaya değer: *"bir kısıtı
garantilemek ile onu önceden uygulamak aynı şey değil — kısıt metne, kod
çağrı yerine yazılır."*
**Bu karar TEAM.md 30'u ÇÜRÜTMEZ, TEYİT EDER** ve bunun açıkça yazılması
istendi: `callout.tsx:11`'deki yorum bayatlamıyor, **ikinci bir emsal
kazanıyor.** Altı ay sonra biri "info bekletildi ama choices bekletilmedi"
diye tutarsızlık aramasın diye buradadır.

2. **B-1 — KÜÇÜLDÜ: artık yalnızca A (etiket/değer) + C (yarıçap/yüzey).**
   `numeric` ayağı `8207e7c` ile indi; kalan tek sayısal yuva
   **`invoices/[id]:74`**. Kapsamın geri kalanı aşağıda kayıt için duruyor.
   **43b B-2'den sonra**, "aynı sürümde kapanır" şartıyla kuyrukta.
   - `components/ui/description-list.tsx` — `<dl>` semantiği,
     `stacked`/`inline`/`numeric`/`multiline`. **Beş kopyayı siler:**
     `clients/[id]:168`, `pets/[id]:417`, `appointments/[id]:205`,
     `visits/[id]:288` ve `:277`.
   - **Yarıçap rol başına tek değer** (`rounded-md` sıfıra iner); kenarlıklı
     yüzeylerden `shadow-sm` kalkar.
   - `DataTable`'a **`numeric` kolon tipi** (`align`'ın yerine geçer) + panel
     ve `charts.tsx:72` yuvaları.
   - **DESIGN-1'in son ayağı buraya iliştirildi:** form hatasının ekran
     okuyucuda duyurulması.
   - **Büyütmenin gerekçesi (value, TEAM.md 4):** `rounded-2xl border
     border-border bg-card` dizgisi **`Card`'ın kendisidir ve yirmi yere
     kopyalanmıştır** — kök neden budur, yarıçap değeri seçmek değil.
   - **Kesme sırası önceden yazıldı (TEAM.md 17b):** **C2 kesilir; A ve
     `numeric` kesilmez.**
   - **`shadow-sm`'in kalkmasının tek şartı:** pm'in **önce/sonra ölçümü**
     (açık tema, panel + `/pets`). Kartlar düzleşirse çözüm **`--border`'ı
     koyulaştırmaktır, gölgeyi geri koymak değil** — o da ölçülür.
   - **ux iki pozisyonunu dev-ui'nin kanıtıyla geri aldı (TEAM.md 7):**
     (a) `inline` boş hâl için **ikon istemişti, geri çekti** — dev-ui
     koymamıştı ve gerekçesi ux'inkini çürüttü (`empty-state.tsx:18-21`:
     dördü `/pets/[id]`'de yan yana gelince **yokluk, dolu komşularından
     gürültülü** oluyor). (b) `numeric`'in `align` ile birlikte
     verilmesini **tiple engelletecekti, kısıtı kaldırdı** — dev-ui
     `numeric`'i `align:"end"`i **ima eder** hâle getirmiş; sonuç aynı,
     çözüm daha sade.
   - **Adlandırma çakışması düzeltildi:** `EmptyState.size="inline"` ile
     etiket/değer bileşeninin `layout="inline"`'ı **aynı kelimeyi iki farklı
     eksende** kullanıyordu (ölçek vs. yön). Etiket/değer bileşeni
     **`layout="stacked" | "row"`** olacak.
   - **Beşinci yarıçap token'ı açılmıyor:** `charts.tsx:162`'deki
     `rounded-t-md`, **gerekçesi yazılmış istisna** olarak
     `theme-tokens.test.ts` izin listesine girer.
   - **`settings/page.tsx:50` B-1'e alınmadı — bilerek** (ux): bu bir
     **yetki** değil **bozuk veri** durumu, doğru ekran **hata hâli**.
     pm'den bu duruma pratikte düşen hesap olup olmadığı bekleniyor.
   - **B-1'in `shadow-sm` ayağı BLOKE:** pm'in **açık temada panel +
     `/pets` önce/sonra görüntüsü** gelmeden inmiyor. `--border`
     koyulaşacaksa **ölçülerek**, ve kenarlığın **gerçekte üstünde durduğu
     yüzeye karşı** (TEAM.md, renk ölçülür-seçilmez).
   - **ux'in bu turda kesinleştirdikleri (ölçülü, tartışma kapandı):**
     **`align` prop'u KALIYOR** — dev-ui haklı çıktı, üç `align: "end"`
     çağrı yerinin ikisi sayı değil (`clients:115` detay bağlantısı,
     `staff:94` eylem sütunu); `numeric` sağa hizalamayı ima eder, ikisi
     birlikte verilemez. **Yarıçap dört token, hiçbir değer taşınmıyor:**
     `control/inset` 8px · `tile` 12px · `surface` 16px · `pill`; dördüncü
     rol (ikon karosu) `rounded-xl`'in on kullanımından çıktı. `rounded-md`
     ve `rounded-sm` sıfıra iner, **kural `theme-tokens.test.ts`'e yazılır**
     (TEAM.md 6: kural teste yazılır, görev metnine değil).
     **`shadow-sm` düşer, kenarlık kalır**; gölge yalnızca **yüzen
     katmanda** (dialog, toast, palet, skip link, combobox).
     **Etiket/değer iki düzen:** `stacked` ve `inline`, ama seçim kurala
     bağlı — `inline` yalnızca **dar tek sütunlu kartta kısa skaler
     değerler** için. Ölçü: vitaller kartı `stacked`'da 14, `inline`'da 7
     satır. **Boş değer bileşene girer:** `-` (U+002D), muted, `<dd>` her
     hâlükârda render edilir.
   - **`<Money>` bileşeni yazılmıyor** (ux kararı: hizalama bağlamın
     kararıdır). `invoices/[id]` tablosu `DataTable`'a **taşınmıyor**, ama
     yoğunluk ve başlık stilini paylaşır.
3. **B-2: `DateTimeInput granularity="day"`** (klinik saatiyle gece yarısı,
   **New York testi**) + **`ConfirmDialog choices`** + iki ölü soyutlamanın
   silinmesi.
4. **Rider:** 39 inerken `StatusBadge`'e `archive` kind'ı. **Ton kararı
   ux'te** — eski tariflerdeki `inactive` bayattır (`e367ba3`), öneri
   `quiet`.
5. **`Callout`'tan B hattına kalan: yok.** Elde kalan tek kutu
   `reminder-form:57` ve o A hattında; eşik (14) **17 çağrı yeriyle aşıldı.**
6. **~~11 (panel grafikleri)~~ kuyruktan çıktı — indi `692b152`.** value üç
   ayağını da kanıtladı: `charts.tsx:50` ve `:101`'de `emptyLabel: string`
   **zorunlu** (`?` yok), `app/(app)/page.tsx:259` tür grafiği
   `t("empty.pets")` alıyor, `partialLast` **üç kanalda** — desen (`:143`),
   alt yazı (`:180-184`) ve **`aria-label` özeti** (`:125-126`, `:150`);
   üçüncüsü ux'in şart koştuğu ayaktı. Sınıfın yeniden doğmadığı da
   kontrol edildi (`:161`'deki `empty.visits` doğru grafikte).

### (40)'ın kararları (value, 21 Eylül) — ölü kod taraması

- **A — ekrana bağlanmamış 10 aksiyon: hiçbiri silinmiyor.** Bunlar
  soyutlama değil **yetenek**; TEAM.md 30 çağrı yeri olmayan *soyutlamayı*
  yasaklar, yazılmış ama bağlanmamış yeteneği değil. **İkisi bu sürümün
  içinde:** `acknowledgeReminderAction` / `dismissReminderAction` —
  */reminders'ta bir hatırlatmayı kapatmanın hiçbir yolu yok*, ki bu
  **21'in kapanış ayağının kendisi** ve sürümün vaadi tam orası;
  `markDeceasedAction` → **7'nin (b) ayağı** (`pet.markDeceased` çevirisi
  zaten duruyor). Kalan yedisi tek satır: "erişilemeyen yetenek",
  **kesme çizgisi: sonraki sürümde de bağlanmazsa silinir** (17b).
- **B — panelin 8 eski sayacı: siliniyor.** 41'in ikinci kaynağı ağaçta
  durdukça dersi yarım kalır.
- **C — `lib/format.ts:1-104` İngilizce etiket sözlüğü: siliniyor,
  listenin en önemli maddesi.** Buradan bir çağrı Türkçe ekrana
  "Partially paid" basar ve **hiçbir test düşmez.**
- **D — `lib/tenant.ts` siliniyor.** Dosyanın başındaki yorum *"her sorgu
  bu politikadan geçsin"* diyor, **hiçbiri geçmiyor** — kod tabanında
  yanlış bir şey iddia eden metin (TEAM.md 33'ün kod içi hâli).
  **Fikir kaybolmuyor:** "arşiv/kiracı filtresi tek yerden geçsin" yeni bir
  backlog satırı oldu; gerekçesi dev'in 39'da **üç ayrı yerde elle
  `archivedAt: null`** düzeltmiş olması. Ayrıca `pagination`/`env` ölüleri
  siliniyor, `lib/action.ts`'te yalnızca `export` kalkıyor.
- **Tarama testi: evet, ama SİLMELERDEN SONRA.** O günün listesi izin
  listesi olur ve her satırın yanında **neden durduğu** yazılır. 40'ın "bir
  kez tarama" sorununu kapatır: **tarama biter, sınıf bitmez** (TEAM.md 6).

### Yeni bulgu (ux, 21 Eylül) — kenar çubuğuna yetki üç ayrı yoldan giriyor

`components/sidebar.tsx:20-30` `/audit`'i **koşulsuz** taşıyor; `/staff` ve
`/settings` ise **iki ayrı boolean prop**'tan geçiyor; **43 üçüncü yolu
açmak üzere.** ux'in önerisi: `NAV` girdilerine **`permission` alanı** +
tek bir `permissions` prop'u. Kök neden düzeltmesi (TEAM.md 4): bugün
eklenen her yeni korumalı sayfa dördüncü, beşinci boolean'ı getirir.
**Hat bölünüyor** (`components/` B'de, yetki kaynağı A'da), o yüzden
**sıralamayı `value` verecek** — henüz sıraya girmedi, unutulmasın diye
burada.

### Sık yanlış hatırlanan olgular (bir turda iki kez yanlış hatırlandı)

- **"Mesajı kopyala" = elle kayıt.** `components/notification-actions.tsx:70-79`
  kopyalamanın **içinden** `logManualAction` çağırıyor; ikisi ayrı düğme
  değil, **tek düğme** — 37'nin kendi tasarımı. "Kopyalama kayıt üretmez"
  varsayımıyla yazılan her tasarım, kullanıcıya kopyaladığını gösterip
  arkada kaydı reddeder; 8b'nin kapattığı sınıf yeni bir yerde açılır.
- **`MANUAL` bir teslim kaydı değil, niyet kaydıdır** (`e367ba3`'ün kendi
  yorumu). Gönderildi anlamına gelmez.
- **`inactive` artık bir ton adı değil** (`e367ba3` sonrası), `staff`
  kind'ının bir durumudur. Arşiv rozetinin tonu `quiet`.
- **Niyet kaydı (`MANUAL`), niyetin *nesnesi* geçerliyse anlamlıdır.**
  `e367ba3`'teki ayrım çürümedi, kapsamı netleşti: dünkü randevu için
  ileriye dönük bir mesajın niyetini kaydetmek, yanlış bir şeyin kaydıdır.
- **Diff'teki `+` bir kodun yeni olduğunun kanıtı değildir.** Girintileme
  ya da bir sarmalayıcının kaldırılması, değişmemiş bir satırı `+` olarak
  gösterir. Kanıt **iki hâlin karşılaştırılmasıdır**
  (`git show <commit>^:<dosya>`). Bir turda bir kez yanlış okundu ve bir
  TEAM.md maddesi bu yüzden geri çekildi (32d).
- **"Kalite kapıları temiz" commit'lenmiş hâl için kanıt değildir.**
  Kapılar yerel ağaçta koşuyor ve o ağaç temiz olmayabiliyor: `main`,
  `2949afb` öncesinde **tek başına derlenmiyordu** — `settings/page.tsx`
  takipsiz bir dosyayı import ediyordu. Yukarıdaki iki dersin kardeşi.
- **Canlı bir oran taban olamaz.** Payda akıyorsa ölçü **kesim tarihli**
  tanımlanır. Bu turda iki kez yaktı: önce "%20 mı %10 mu" çelişkisi, sonra
  aynı koşuda 1/10'un 2/11 olması. Madde 29'un ("ölçüm işi doğru tarif
  etmek içindir") pratik kardeşi — bir ölçüyü tartışmadan önce
  **paydanın sabit olup olmadığına** bakılır.
- **`country` 129 kliniğin hepsinde NULL** — telefon düzeltmesi (6) pratikte
  devreye girmiyor olabilir.

### Açık risk: mobil düzen hiç taranmadı

`ux`'in tarayıcısı yok; bugüne kadar **hiçbir mobil düzen taranmadı.**
TEAM.md 24/32 mobili "işin kendisi" sayıyor, yani boşluk **tamamen pm'in
sırtında.** `value`'nun kararı: **kabul kuyruğu boşalınca pm'den ayrı bir
390px turu istenecek** — şimdi istemek deploy blokerlerinin kabulünü
geciktirirdi. Bu satır, o turun unutulmaması için burada duruyor.

### Kapanmış sıralama tartışmaları (silinmez — TEAM.md 30b)

- **11'in 18'in önüne alınması (value, 21 Eylül) — kapandı, ikisi de indi**
  (11 `692b152`, 18 `7f8aec0`/`e367ba3`). Gerekçe duruyor: 11'in (b) ve (c)
  maddeleri ekranda **yanlış olgu** gösteriyordu ("Henüz vizit yok" diyen
  hayvan grafiği; olmayan bir düşüşü çizen son sütun) ve sürümün vaadinin
  birinci yarısı tam olarak buydu; 18 ise tasarım sistemi işiydi ve
  bekleteceği şey (21) Katman 3'teydi. ux sıralamayı 18'den sonra önermişti,
  value gerekçesiyle öne aldı, ux ölçütü benimsedi.
  **Kayda geçen etkisiz karar:** 18 aynı turda indiği için karar pratik
  karşılığını yitirdi. Etkisiz kalması yanlış olduğu anlamına gelmiyor ve
  öyle yazılmıyor — **etkisiz kalan doğru bir kararı "yanlıştı" diye yazmak,
  ölçütü de beraberinde götürür.**
- **A0-money'nin mutlak önceliği — kapandı** (`0a34b01`). "Para sessizce
  yanlış kaydedildiği sürece diğer hiçbir işin sırası tartışılmaz" ölçütü
  duruyor ve bir daha aynı sınıf bir kusur çıkarsa yeniden uygulanır.

### Ölçüm (21 Eylül'de alındı, `scripts/loop-metrics.mjs`, salt okuma)

- Aşı tekrar tarihi doluluğu **1/10 = %10**. SESSION.md taban olarak **%20**
  yazıyor. Bu (20)'nin başarı ölçüsü olduğu için **taban yeniden
  yazılmadı**; pm'e soruldu, cevap beklemede. Aradaki fark pm'in test
  kayıtlarından mı, yoksa taban mı yanlış yazılmıştı — ayrılmadan taban
  değiştirilmez.
- `message_logs`'ta **2 kayıt, ikisi de `MANUAL`, `SENT` sıfır** →
  **Katman 1'in "bitti" eşiği hâlâ karşılanmadı.**
- Vizite bağlı fatura kalemi **0/5**.
- `closeReason` kolonu yok → 21 başlamamış.
- **Para büyüklüğü tahmini üretilmedi:** ortalama vizit tutarı hâlâ cevapsız
  (TEAM.md 8).

**3. Yarım kalanlar.** (21 Eylül akşamı `ux` kod tabanına bakarak iki kaydı
bayat ilan etti; düzeltildi.)
- **~~`Callout` süpürmesi yarım~~ — eşik aşıldı.** Bugün **17 çağrı yeri**
  var (eşik 14'tü). Elde kalan tek elle yazılmış kutu **`reminder-form:57`**;
  `invoice-form:49,:54` ve `appointments/[id]:113` kapandı. DESIGN-1'in
  ikinci ayağı (form hatasının ekran okuyucuda duyurulması) **açık** ve
  B-1 paketine iliştirildi.
- **~~Onay dialogu primitifi bağlanmadı~~ — (17) bitti, pm kabuline hazır.**
  `window.confirm` kod tabanında **sıfır**; üç çağrı yeri de
  `ConfirmDialog`'a geçmiş.
- **Hayvan uyarısı iki ekranda eksik:** `appointments/[id]` ve randevu
  listesi (`modules/appointments/queries.ts` select'ine `alerts`). **Açık.**
- **Yeni (ux, 21 Eylül):** `settings/page.tsx:50` hâlâ **sessiz
  `redirect("/")`** — bozuk veri durumunda kullanıcı açıklamasız panele
  düşüyor (43 ile aynı sınıf, `ForbiddenState`/`NotFoundState` deseni oraya
  da uygulanır). `appointments/[id]:187` gönderim hatası **canlı bölge
  değil**, ekran okuyucuda duyurulmuyor.
- **ux'in kapattığı tasarım soruları:** `NotFoundState` ile `ForbiddenState`
  **birleştirilmiyor** (biri varlık sızdırmamak için "bulunamadı" der,
  diğerinde sızdıracak bir şey yoktur) · **`<Money>` bileşeni yazılmıyor**
  (hizalama bağlamın kararıdır) · `invoices/[id]` tablosu `DataTable`'a
  **taşınmıyor**, ama yoğunluk ve başlık stilini paylaşır.

**4. Bekleyen kullanıcı cevapları.** Beş soru açık, tamamı "Kullanıcıya
sorulacaklar" bölümünde. **En kritiği: ortalama vizit tutarı** — para
sürümünün büyüklük sırası ona bağlı, o gelene kadar tahmin üretilmeyecek.

**5. Karar verilmiş, uygulanmamış.**
- Performans bütçesi rota başına konacak ve kademeli indirilecek; pm'den
  rota başına gerçek süreler bekleniyor (6000 ms bir bütçe değil, tavan).
- `fullName()` ve `format.ts` ternary temizliği **para sürümünün ilk ekranı
  yazılmadan önce** inecek.
- İptal/tamamlanmış randevuda gönderim kartının gizlenmesi (8b).
- Rızanın **ne zaman ve hangi yolla** alındığının kaydı (14b).

**6. Şu an yapılan tek şey (21 Eylül akşamı, güncellendi).** ~~A0-money~~
**indi** (`0a34b01`). **A hattı: (43) `/audit` yetki kontrolü.** **B hattı:**
çalışma ağacındaki yarım iş (`ForbiddenState` + rota `not-found`'ları) —
43 ona bağlı. **(42a) durdu ve `ux`'te bekliyor**, gerekçe A hattı bloğunda.

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
| 2+3 | **A0-money: para girişi tek yoldan geçer** | A | dev'de (21 Eylül) | — | Backlog 2 ve 3 birleşti; kapsam value tarafından genişletildi (aşağıya bak). Sessiz para kaybı. |
| 4 | Panelin kalan borcu yanlış göstermesi | A | **indi `90e6005`**, pm kabulü bekliyor | — | Tahsilatlar düşülmüyor; alacak olduğundan yüksek. **Not:** hesap doğru yazıldıktan sonra bile eski 100 kat küçük ödemeler yüzünden bazı satırlar tutarsız görünecek — bu veri kararının sonucu, düzeltilmeyecek (bkz. A0-money / geçmiş veri). |
| 5 | Liste yeniden doğrulama kök nedeni | A | açık | — | Kullanıcıya mükerrer kayıt düşürttüğü için görünüm değil veri sorunu. |
| 6 | Telefon: doğrulama yok + ülke dışı biçimler bozuk | A | **indi `2ddf87e`**, pm kabulü bekliyor | — | "sabit hat yok" numara olarak kaydediliyor; BAE numarası ülke kodsuz kabul ediliyor. Tek yoldan geçsin. |
| 7 | Vefat/arşiv/sahip değişikliği hijyeni | A | **gönderim ayağı indi `1c22904`** (ölen/arşivlenmiş hayvanın sahibine mesaj gitmiyor). Kalan: (a) **oluşturmanın da engellenmesi** — value kararı, aşağıda; (b) durumun ekranın ağırlığını düşürmesi ve sahip değişikliğinin olay olarak gösterilmesi (ux/dev-ui) | — | Ölen hayvan için sahibine hatırlatma gidiyor. Tek mesaj güveni bitirir. **Üçü farklı davranır:** vefat ve arşiv **durum** (ekranın ağırlığını düşürür, otomatik gönderimi durdurur), sahip değişikliği **olay** (yalnızca akışa satır ekler; durum olarak gösterilirse hayvanın şu anki sahibi belirsizmiş gibi okunur). **Sıra uyarısı:** hayvan kartındaki "bu hayvan için hatırlatma oluşturulmaz, mesaj gönderilmez" cümlesi bu iş inmeden yayına girmemeli — yoksa ekran görünür bir vaat verip arkasını tutmaz. |
| 39 | **Arşivden geri alma yolu yok — arşiv bugün geri alınamaz** | A | açık | — | ux buldu (17'nin specini yazarken kendi iddiasını doğrularken). `restoreClient` **ve** `restoreClientAction` yazılmış (`modules/clients/service.ts:74`, `modules/clients/actions.ts:55`) ama **hiçbir sayfada render edilmiyor** — kod var, düğme yok. `restorePet` ve `restoreVisit` **hiç yok**. Arşivlenmiş kaydı **bulmanın yolu da yok**: `listClients`'ta `includeArchived` bayrağı var (`queries.ts:20`) ama sayfa kullanmıyor, hayvan ve vizit sorgularının tamamı `archivedAt: null` süzüyor. Yani "Arşivle", yumuşak bir kelimeyle sunulan **geri alınamaz** bir eylem; yanlışlıkla arşivlenen bir müşteri bugün yalnızca veritabanına elle müdahaleyle geri gelir. **Neden Katman 0 (value):** TEAM.md 3 — geri alınamazlık önceliği yükseltir, nadirlik düşürmez. Emsal aynı tabloda: **8** (`setStaffActive`) tam olarak aynı sınıf ve zaten burada. TEAM.md 25'in daha tehlikeli yönü: geri alınabilir olanı kırmızı göstermek korkutur, **geri alınamaz olanı sessiz göstermek hiç okutmaz.** |
| 8 | `setStaffActive` sunucu tarafında korumasız | A | **indi `f23e002`**, pm kabulü bekliyor | — | Son yönetici kliniği kilitleyebiliyor; geri dönüşü elle müdahale. |
| 29a | Para birimi: yazma yolu + ayar ekranı + varsayılan TRY (deploy blokeri) | A | **indi `cd407e9` — pm kabulünde** | — | Ayrıntılı kapsam Katman 0 tablosunun altındaki "29a" bölümünde. |
| 34 | **Bildirim ayarları sayfası hiç kaydetmiyor (P0)** | A | açık | — | pm buldu, tarayıcıda doğrulandı. `modules/notifications/schema.ts:21` `channel: requiredEnum(CHANNELS)` zorunlu, ama `components/forms/notification-settings-form.tsx`'te channel alanı **hiç yok** (formdaki sekiz alan: `enabled`, `confirmOnBooking`, `reminderMode`, `hoursBefore`, `morningHour`, `remindersEnabled`, `remindersDaysBefore`, `timezone` — channel yok, çeviri anahtarı da yok). Sonuç: **her kayıt düşüyor.** Saat 11 yapılıp kaydedilince yalnızca "Geçersiz seçim." toast'ı çıkıyor, hangi alan olduğu yazmıyor, yenileyince 9 geri geliyor. Yani klinik saat dilimini, hatırlatma saatini, gün sayısını ve otomasyon anahtarını **hiçbirini** değiştiremiyor. Sürümün vaadi "hatırlatmalar gerçekten gidiyor"; ayarı kapalı bir döngü vaadi tutamaz. |
| 44 | Liste tabloları 390px'te kesiliyordu, kaydırma yok | B | **26 ile düzeltildi; kayda geçiyor** | — | dev-ui buldu. **Yedi liste tablosunun hepsi** sarmalayıcıda `overflow-hidden` taşıyordu — 390px'te sağa taşan kolonlar **kaydırılamadan kesiliyordu**, altısında dar ekran uyarlaması hiç yoktu. Bilgi ekranda yok ve ulaşma yolu da yok: TEAM.md 27'nin tablo hâli, **Katman 0 sınıfı.** Düzeltilmiş olması kaydı gereksiz kılmıyor — 26'nın içinde sessizce kapanırsa sınıf görünmez kalır ve `DataTable` kullanmayan bir sonraki tabloda yeniden doğar. **Açık soru (value → dev-ui): yedi tablonun hepsi artık `DataTable` üstünde mi?** Değilse kalanlar bu kusuru hâlâ taşıyor. |
| 43 | **`/audit` yetki kontrolsüz — izin modeli bir şey söylüyor, kod başka şey yapıyor (P0)** | A | açık | — | ux buldu. `lib/permissions.ts:37` `audit.read` **tanımlı** ve dört rolden **ikisine** verilmiş (`:63`, `:87`); ama `app/(app)/audit/page.tsx`'te **hiçbir yetki kontrolü yok** (ne `can()`, ne `requirePermission`) ve `components/sidebar.tsx:30` `/audit`'i **koşulsuz** gezinmeye koyuyor. Yani `RECEPTIONIST` ve `VET_TECH` bağlantıyı görüyor ve kliniğin tüm değişiklik geçmişini okuyor. Desen kod tabanında **var** — `/staff` ve `/settings` doğru yapılmış (`sidebar.tsx:46-48` `can()` ile gizleniyor, sayfalar ayrıca kontrol ediyor); `/audit` atlanmış. Sızıntı klinik **içinde** kalıyor (kiracı izolasyonu sağlam), ama denetim kaydı kimin neyi değiştirdiğini gösteriyor ve rol modeli bunu **bilerek** kısıtlamış. |
| 43b | **Yetki kenar çubuğuna üç ayrı yoldan giriyor** | **A+B** | açık | 43 | ux buldu. `components/sidebar.tsx:20-30` `/audit`'i **koşulsuz** taşıyor; `/staff` ve `/settings` ise `app/(app)/layout.tsx:38-39`'dan gelen **iki ayrı boolean**'la geçiyor; 43'ün `canReadAudit`'i **üçüncü yolu** açardı. **İş:** `NAV` girdilerine opsiyonel `permission` alanı + `Sidebar`'a tek `permissions` Set prop'u, iki boolean silinir. **İki kişilik, çünkü hat bölünüyor:** Set'i **üreten** taraf A (`layout.tsx`), **tüketen** taraf B (`components/sidebar.tsx`). **value 43'ten ayırdı (ux'in (a) önerisi):** sayfa açığı kenar çubuğunun temizliğini beklememeli. **ŞART, iş metnine yazıldı: 43b bu sürümde kapanır — kesme çizgisinin ALTINDA DEĞİL.** Yoksa "yetkisize görünen bağlantı" kalıcı hâle gelir. |
| 42a | Tarihi geçmiş ama `SCHEDULED` randevuya hâlâ "randevunuz oluşturulmuştur" gönderilebiliyor | A | **KAPANDI (şartname kesin), dev'de** | — | **ŞARTNAME — KESİN (21 Eylül akşamı kapandı; value pozisyonunu değiştirdi, ux haklıydı).** ~~Bekleyen: ux'in "kopyala" itirazı~~ — **itiraz value'nundu ve geri çekildi.**  Kart **kalır** — 8b'nin "kartı kaldır" hareketi kopyalanmaz, orada uygulama sonucu bilir, burada bilmez. Cümle: *"Bu randevunun tarihi geçti ve sonucu henüz kaydedilmedi."* Yanında **"Sonucu kaydedin" → `/appointments/[id]/edit`** — yeni akış değil, durum alanı `appointment-form.tsx:110-113`'te zaten var. Rozet `SCHEDULED` kalır. **value'nun düzelttiği öncül:** ux "kopyala kayıt üretmez" varsayarak kopyalamayı bırakıp elle kaydı kesmişti; `components/notification-actions.tsx:70-79` **kopyalamanın içinden `logManualAction` çağırıyor** — ikisi tek düğme (37'nin kendi tasarımı). Ayrılmadan kodlansa kullanıcı kopyaladığını görür, arkada kayıt reddedilirdi; 8b'nin kapattığı sınıf yeni yerde açılırdı. value'nun pozisyonu: **kopyalama kaydıyla birlikte durur**, çünkü `MANUAL` bir **teslim** kaydı değil **niyet** kaydıdır (`e367ba3`'ün kendi yorumu). ux'e itiraz hakkı açık; **dev o maddeyi cevap gelmeden kodlamaz.** **ÖLÇÜM EŞİĞİ (TEAM.md 29):** kod indikten **14 gün sonra** geçmiş randevularda `SCHEDULED` oranı yeniden alınır; **taban 40'ta 39.** Tarihe değil **olaya** bağlandı ki sürüm kayarsa ölçüm düşmesin. **Eski durma gerekçesi (UX-first, 21 Eylül):** servis tarafı net (8b'nin `isClosed` desenine dördüncü neden), **ekran tarafı değil.** 8b her kapanış nedenine kendi cümlesini veriyor; diğer üçü bir olgu bildiriyor ("iptal edildi"), bunda **uygulama ne olduğunu bilmiyor** ve 42b sürüm dışı olduğu için bu sürümde öğrenmeyecek. ux'e sorulan iki soru: kart tamamen mi gizlenecek yoksa yalnızca "randevunuz oluşturulmuştur" ailesi mi kesilip 37'nin "Mesajı kopyala"sı bırakılacak; ve cümle 42b'nin kapısını aralamadan ne diyecek. dev bu arada 43'te, bekleyen yok. dev buldu. 8b iptal ve tamamlanmış randevuyu kapattı, bu delik açık kaldı. Teorik değil: ölçüm tabanı **tarihi geçmiş randevuların hepsinin `SCHEDULED` olduğunu** söylüyor. Yanlış mesaj ailesi. |
| 41 | Panel kartı ile götürdüğü liste aynı şeyi saymıyor | A | açık | — | ux buldu. `modules/dashboard/queries.ts:107-108` ham SQL ile `status = 'PENDING'` sayıp `pendingReminders` olarak panele veriyor (`app/(app)/page.tsx:96-101`, `href="/reminders"`); tıklayınca açılan liste ise `["PENDING","SENT"]` gösteriyor (`modules/reminders/queries.ts:6`). Panelde **3** yazıyor, tıklıyorsunuz, **7** satır geliyor. Bugün, göçten bağımsız. Kullanıcı "üç işim var" diye okuyup yedi iş buluyor. **Ölçüt 11'dekiyle aynı: ekranda yanlış olgu gösteren iş, sistem borcundan önce gelir. Göç planının içine gömülmeyecek** (ana oturum uyarısı), göçten bağımsız kapanacak. **Asıl düzeltme sayıyı eşitlemek değil, kaynağı teke indirmek:** kart ile liste **tek bir sorgudan** beslensin, yoksa ikisi yeniden ayrışır — bugünkü hâl zaten iki ayrı yerde iki ayrı ölçüt yazılmasından doğdu. **Ölçüt listenin kümesi olacak (`PENDING`+`SENT`), kartınki değil** (ux): gönderilmiş ama hayvanın gelmediği hatırlatma **hâlâ açık bir iştir**; kartı doğru kabul edip listeyi daraltmak, panelin sayısını korumak için gerçek işi gizlemek olur. **Sonuç: 41 inince panel sayısı BÜYÜYECEK ve bu düzelmenin kendisidir** — bugün eksik sayılan iş görünür oluyor. pm'e önceden bildirildi, yoksa "panel sayısı değişti" diye bulgu olarak geri gelir ve doğru düzeltmeyi geri aldırır. |
| 37 | Elle gönderim kaçışı seçilen kanalı izlemiyor | A | **indi `b0b0b24` (34 ile) — pm kabulünde** | — | ux buldu, **34 ile birlikte gider.** `messages/tr.json:255, 263, 338` üç metin *"Mesajı **WhatsApp'ta** açarak elle iletebilirsiniz"* diyor, kanal ne olursa olsun; `components/notification-actions.tsx:74-86` de kanaldan bağımsız **yalnızca** `m.whatsappLink` sunuyor — SMS için hiçbir elle kaçış yok. **Neden Katman 0 (value):** ux'in 34 için yazdığı uyarı kutusu "Randevu sayfasından mesajı elle iletmeye devam edebilirsiniz" diyor; bu SMS kliniği için bugün **yanlıştır**, yani 37 inmezse TEAM.md 33'ü düzeltmek için eklenen kutu TEAM.md 33'ü ihlal eder. Bağımlılık, aciliyet değerlendirmesini geçersiz kılar (ux ilk sınıflandırmasını geri aldı). **Tasarım (ux):** `sms:` bağlantısı **reddedildi** — gövde parametresi platformlar arası tutarsız, masaüstünde çoğunlukla hiçbir şey yapmıyor ve klinik personeli tam da orada; çalışmayan düğme olmayandan kötü. Birincil kaçış her kanalda **"Mesajı kopyala"**: her cihazda çalışır, hiçbir şey vaat etmez, gövde zaten önizlemede (`notification-actions.tsx:95-101`). Kanala özel derin bağlantı **yalnızca o kanal seçiliyken** görünür. Metinler kanal adını `{channel}`'dan alır. **Kopyalama da `logManual` çağırır** (ölçüm gerekçesi aşağıda). **value'nun eklediği üçüncü kusur:** `modules/notifications/service.ts:295,302` `logManualMessage` kanalı **sabit yazıyor** — `composeFor(..., "WHATSAPP")` ve `channel: "WHATSAPP"`. Yani SMS kliniğinin elle gönderimi bugün WhatsApp olarak kaydediliyor; metni düzeltip bunu bırakmak, ekranı doğrultup **veriyi yanlış bırakmak** olur. Kanal argümandan gelmeli. |
| 36 | `marketingOptIn` formdan kalkar, kolon kalır | A | açık | — | ux doğruladı: dört yerde geçiyor (`schema.prisma:127`, `client-form.tsx:173`, `clients/schema.ts:26`, `service.test.ts:50`) ve **hiçbir gönderim yolunda okunmuyor.** Rıza kutusu olduğu için sıradan ölü alandan ağır: kullanıcıdan hukuken anlamsız bir onay topluyoruz, üstelik kullanıcı kararı "mesajlar bilgilendirmedir, satış dili yasak" — bağlanacağı kanal da yok. **Kolon neden kalıyor (ux kendi gerekçesini düzeltti, value kabul etti):** ilk gerekçe "kolon düşürmek migration, o da onaya gider" idi — **yanlış kapı**; yetki kuralı değişti, migration onay kapısı değil. Doğru gerekçe: (1) kolondaki değerler **rıza kaydı** ve bugün okunmuyor olması yarın "bu müşteri ne zaman neye onay vermişti" sorusunun sorulmayacağı anlamına gelmiyor — düşürülürse geri getirilemez; (2) okunmayan bir kolonun durması hiçbir şeye mal olmuyor. Yani karar "onay bekliyoruz" değil, **"bu veriyi silmek için bir sebep yok"**. Gerçekten silmek istersek o zaman geri alınamaz veri işlemi olarak onaya gider. **Kaçırılırsa sessiz veri kaybı:** kutu formdan kalkarken `clients/schema.ts:26`'daki `marketingOptIn: checkbox` **de** kalkmalı; kalırsa işaretsiz kutu her düzenlemede `false` yazar ve bugün `true` olan kayıtlar sessizce sıfırlanır. Kabul testi: `true` olan bir müşteriyi düzenleyip kaydet, `true` kalmalı. |
| 35 | Performans testi bozuk uygulamayı "hızlı" ölçüyor | A | açık | — | pm buldu: `e2e/performance.spec.ts:58-75` yalnızca süre ölçüyor, **hiçbir içerik doğrulaması yok.** Ölçüm koşusunda `/clients` gerçekte hata sınırına düşüyordu (veritabanında eksik kolon) ve test **geçti** — 182 ms'de yüklenen şey hata sayfasıydı. Tamamen bozuk bir uygulama "hızlı" ölçülür. Kendi güvenlik ağımızın içindeki sessiz yanlış (TEAM.md 2): her rotada o rotaya özgü **görünür bir işaret** (başlık ya da boş durum metni) beklenecek, süre ölçümü ancak ondan sonra anlam taşır. Küçük. |
| 8b | İptal/tamamlanmış randevu hâlâ gönderime hazır duruyor | A | **indi `e8968c4`**, pm kabulü bekliyor. 37 ile birlikte gitmesi kararıydı, **ayrı inmiş** — dev'e soruldu, 37'nin kapsamı daralmış olabilir | — | İptal edilmiş randevuda "randevunuz oluşturulmuştur" mesajı tek tıkla gönderilebiliyor. Yanlış mesaj ailesi; şablon işinden bağımsız, şablon hiç eklenmese de kapanmalı. |
| 9 | DESIGN-1 `Callout` primitifi | B | kısmen — kalan 4 çağrı yeri **A hattına devredildi**; `invoice-form:49,:54` A0-money ile gidiyor. dev-ui bunu beklemiyor. Geçmiş: (dev-ui) — `0bf959f` primitif+`--warning`+`Field`, `373ad28` 8 form kutusu, `38d610b` 2 sayfa uyarısı, `7259681` `--destructive` AA. Kalan 4 çağrı yeri A hattında: `invoice-form:49,:54`, `reminder-form:57`, `appointments/[id]:113` | — | Uyarı kutusu 13 yerde kopyalanmış; koyu tema karşılığı yok. |
| 10 | DESIGN-1/2. aşama: hayvan uyarısının doğru ekranlara taşınması | B | kısmen (dev-ui) — `5efbd84` `pets/[id]` (gömülü kopya kaldırıldı, `PageHeader` altına taşındı) + `visits/[id]`. Düğme etiketi de düzeldi (`7259681`). Kalan: `appointments/[id]` (A hattında açık) ve randevu listesi (`modules/appointments/queries.ts` select'ine `alerts` eklenmesi A hattından istendi) | 9 | "Isırır/alerjik" yalnızca hayvan detayında. Risk insana fiziksel zarar. Sayfa dosyaları paylaşımlı: A'ya haber ver. **Aynı dosyada iliştirilecek küçük kusur:** `pets/[id]/page.tsx:115-120`'deki düğme "Vizitler" (`t("tabs.visits")`) adını taşıyor ama yeni vizit formunu açıyor — sekme etiketi düğme etiketi olarak kullanılmış, eylem olduğu bile okunmuyor (TEAM.md 25). "Yeni vizit" olacak. Ayrı iş açılmadı; aynı dosyaya ikinci kez gitmeyelim. |
| 19a | DESIGN-4'ün ağır yarısı | B | **ÜÇÜ DE İNDİ, pm kabul etti.** Filtrelenmiş boş liste `e5ba831`; `not-found.tsx` ve **hata sınırı** `26a887f` (üçüncü ayak aynı commit'in içindeydi: `app/(app)/error.tsx` + `components/error-state.tsx`, kabuk korunuyor, "Ana sayfa" ikincil eylemi, `error.digest` duruyor) | — | **Sıra kararı (value, 21 Eylül):** ux DESIGN-4'ün envanterini çıkarınca kapsam büyüdü ve içinden **sessiz yanlış** çıktı; hafif yarısıyla bir arada tutulursa ağırı rehin kalır, o yüzden ikiye bölündü. (a) **Filtrelenmiş boş liste boş listeden ayrılmıyor** (`invoices:59`, `visits:56`): kullanıcı filtre uygulayıp sonuç bulamayınca uygulama ona kliniğinde *hiç fatura olmadığını* söylüyor — üçünün en ağırı, TEAM.md 2. (b) `not-found.tsx` **hiçbir yerde yok** ama `notFound()` dokuz yerde çağrılıyor; o dokuz yol bugün uygulama kabuğunun dışına, biçimsiz İngilizce bir sayfaya düşüyor. (c) Hata sınırı kabuğun **dışında**: bir sayfa patlayınca gezinme de gidiyor. Yükleme iskeletleri **19b**'de kaldı. |
| 11 | DESIGN-6 panel grafikleri — kalan üç iş | B | **indi `692b152` — pm kabulünde** | — | ux kapsamı üçe çıkardı, aynı bileşene ikinci kez gitmemek için. **(a) Boş gelir grafiği:** `page.tsx:171` `emptyLabel` almıyor, `charts.tsx:79-81` `null` dönüyor — ödenmiş faturası olmayan klinik başlığı olan, **içi tamamen boş** bir kart görüyor; yükleniyor mu, bozuk mu, sıfır mı belli değil. Yeni kurulan her klinik ilk açılışta bunu görüyor. `emptyLabel` **zorunlu prop** olacak: bir grafiğin boş hâlini unutmak derleme hatası olsun, sessizce boş kutu değil — bir kez oldu zaten. **(b) Sessiz yanlış:** `page.tsx:247` "Türlere göre hayvanlar" grafiği boş hâlinde `t("empty.visits")` = **"Henüz vizit yok."** yazıyor, ama o grafik hayvanları sayıyor. Yüz hayvanı olup henüz viziti olmayan klinik — kurulumun ilk günü — yanlış bir olgu okuyor. **Doğru metin "Henüz hayvan yok."** — ux kendi iddiasını doğruladı: `modules/dashboard/queries.ts:164-172` gerçekten `prisma.pet.groupBy` (arşivlenmemiş hayvanlar, arşivlenmemiş sahipler), grafik hayvan sayıyor. **(c) Kısmi dönem** (eski "karar verilmiş, uygulanmamış" maddesi buraya taşındı): son sütun soluk dolgu + kesik üst kenar + tek satır alt yazı, **ve `aria-label` özetine de giriyor** — yoksa ekran okuyucu kullanıcısı olmayan düşüşü gerçek sanar. Cila değil doğruluk: grafik bugün olmayan bir düşüş gösteriyor. |

### A0-money kapsamı ve "bitti" eşiği (value, 21 Eylül 2026)

Kod okundu; backlog'da yazan iki giriş noktası değil **dört** var. Ayrı ayrı
yamalanırsa para girişinin üç farklı yolu kalır, o yüzden tek iş.

| # | Giriş noktası | Bugünkü hata |
|---|---|---|
| 1 | `components/forms/payment-form.tsx:41` → `modules/invoices/schema.ts:48` | Hiç ×100 yok: 500 girilir, 500 kuruş kaydedilir. Ayrıca `:43` placeholder ham kuruş yazıyor. |
| 2 | `components/forms/invoice-form.tsx:119-128` | **Backlog'da yoktu.** Kontrollü input yazılanı kuruşa çevirip alanın kendisine geri yazıyor: "5" → alan "500" olur, sonraki tuşla tekrar ×100'e girer. Alan parmağın altında değişiyor. |
| 3 | `invoice-form.tsx:93` (`taxCents`), `visit-form.tsx:192` (`totalCents`) → `lib/forms.ts:164-180` | Ölçek doğru, yerelleştirme bozuk: tek `replace(",",".")`, "1.234,56" → 123 kuruş. |
| 4 | `lib/format.ts:411` `parseMoneyInput` | Aynı hata, **çağrı yeri yok** (tek eşleşme kendi tanımı). TEAM.md 30. |

Ek gözlem: `visit-form.tsx:195` kayıtlı değeri `(cents/100).toFixed(2)` ile
"1234.56" gösteriyor, aynı sayfada `formatMoney` "₺1.234,56" diyor —
düzenleme alanı ile gösterim aynı sayıyı iki farklı dilde yazıyor.

**İstenen:** tek ayrıştırıcı. **İndi — `0a34b01`, `lib/money.ts`.** Kök neden
öngörülenle aynı çıktı: para üç ayrı yerde çevriliyordu (zod yardımcısı,
faturada ham `z.coerce.number()`, fatura formunda tuş başına kuruş hesabı).
Sınırlar da kuruş cinsinden yazıldı ki birim karışmasın. Kalan: ux'in 5
numaralı kararı (alan adları, placeholder) — pm'in kabulü **bu inmeden
koşmayacak**, yoksa aynı ekran iki kez test edilir.

**Onaylanan ayrıştırma kuralları — biri düzeltildi (value'nun kuralı
hatalıydı, pm buldu, dev düzeltti; `6d13ace`):**
- ~~"Tek ayırıcı + tam 3 hane → binlik"~~ **value'nun bu kuralı
  locale'sizdi ve TR'de yanlış sonuç veriyordu:** "10,999" TR'de kuruş altı
  bir tutardır ve **reddedilmeliydi**, ama kural onu 10.999,00'a çıkarıyordu
  — yani belirsizliği çözerken bin kat şişiriyordu.
  **Doğrusu: belirsizlik locale ile çözülür.** `parseMoneyToCents` artık
  locale alıyor; TR'de "." binlik ve "," ondalık, EN'de tersi, **karşı
  yerelin yazımı tahmin edilmeden reddediliyor.** Bu, "tahmin yok"
  kuralının tutarlı uygulaması — value kuralı yazarken locale boyutunu
  atlamıştı.
- **Yapısal bedel, kalıcı kural:** para alanı taşıyan şemalar artık
  **istek başına** kuruluyor (`invoiceSchema(locale)` vb.), aksiyonlar
  `getLocale()` veriyor. Şema modül sabiti kaldığı sürece bu hata
  kapanmıyordu. **Bundan sonra para alanı olan hiçbir şema modül sabiti
  olarak yazılmaz** — yazılırsa aynı hata sessizce geri gelir.
- **Okunamayan girdi tahmin edilmez, reddedilir** — kullanıcı hata görür.
  Tahmin, bu görevin kapattığı hata sınıfının kendisidir.
- **İkiden fazla ondalık yuvarlanmaz, reddedilir** — parayı sessizce
  değiştirmemek.
- **Fatura satırında birim fiyat zorunlu oldu** (eskiden boş alan sessizce 0
  fiyatlı kalem üretiyordu). Şart: bedava kalem için "0" yazılacağı, ham
  doğrulama metniyle değil çevrilmiş ve yol gösteren bir mesajla anlatılır.

**Belirsizlik kuralı (PO kararı, teste yazılır):** tek ayırıcı + tam 3 hane →
binlik ("1.234" = 1234,00); tek ayırıcı, 3 haneden farklı → ondalık
("12.50" = 12,50); iki farklı ayırıcı → sondaki ondalıktır ("1.234,56" ve
"1,234.56" ikisi de 1234,56).

**"Bitti" eşiği — üçü birden, ikisi yetmez:**
1. **Test.** Ayrıştırıcı tablosu `lib/forms.test.ts` + `lib/format.test.ts`'te:
   "500"→50000 · "12,50"→1250 · "12.50"→1250 · "1.234,56"→123456 ·
   "1,234.56"→123456 · "1.234"→123400 · "0"→0 · ""→null · "abc"→null ·
   "-5"→hata. Artı: `optionalMoneyCents` ile `parseMoneyInput` aynı girdide
   aynı sonucu veriyor — ikinci bir yol doğarsa test düşsün.
2. **Ekran (pm).** Fatura satırına 500 → **500,00** ve yazarken alan değişmiyor;
   tahsilata 500 → kalan borç tam 500,00 azalıyor; TR arayüzde "1.234,56"
   kabul ediliyor; placeholder para gibi okunuyor. TR/EN × açık/koyu × 390px.
3. **Veri.** Ekran doğru gösterip yanlış kaydedebilir: 500 girilen ödemede
   `payments.amountCents = 50000` doğrulanır.
Artı `tsc --noEmit` · `eslint` · `npm test` temiz.

**İliştirildi:** `invoice-form.tsx:49,:54` iki ham hata kutusu `Callout`'a
taşınıyor (DESIGN-1'in kalan dördünden ikisi) — dev zaten o dosyada.

**Kapsam dışı:** para birimi (29), `formatMoney` ondalık sabiti (33), KDV oranı
ve sıralı fatura numarası (para sürümü), `InvoiceLine.visitId` türetmesi (para
sürümü). **Şema değişikliği / migration yok** — saklama zaten tam sayı kuruş.

**Sayım sonucu (dev, salt okuma, 21 Eylül):** veritabanında **5 tahsilat**
var; **100 kat küçük kaydedilmiş tam 1 tanesi** (`INV-2026-57336`, 500
kuruş = 5,00). Ayrıca pm'in test sırasında ürettiği iki şişmiş kayıt
(`INV-2026-92987` 10.999,00 · `INV-2026-92551` 12.345,00) ve
`INV-2026-90018`'de 765,44 fazla ödeme duruyor. Hiçbirine dokunulmadı.
**Ölçüm uyarısı (value): bu test artefaktları ölçüm tabanını kirletiyor.**
Para ölçüleri (fatura başına kalem, vizite bağlı kalem oranı, kalan borç)
sürüm öncesi gerçek veriyle yeniden alınırken bu üç kayıt **hesaba
katılacak ya da ayıklanacak**; aksi hâlde tabanı bozuk bir sayıya karşı
ölçeriz.

**Geçmiş veri: dokunulmuyor — kullanıcı kararı, 21 Eylül 2026, bağlayıcı.**
100 kat küçük kaydedilmiş eski ödemeler olduğu gibi kalıyor; **düzeltme
migration'ı yok.** dev yalnızca kaç kayıt etkilendiğini **sayar** (salt okuma),
yazmaz.

**Kararın bilinen sonucu (hata olarak yeniden açılmayacak):** panel, kalan borç
ve alacak rakamları eski kayıtlarda yanlış kalmaya devam edecek. Yani (4)
"panelin kalan borcu" işi doğru yazıldıktan **sonra bile** eski satırlar
tutarsız görünecek; aynı faturada 100 kat küçük eski bir ödeme ile doğru yeni
bir ödeme yan yana durabilir. Bu bir regresyon değil, verinin kendisi öyle.
pm bunu bulgu olarak açmayacak, dev (4)'ü yaparken "düzeltmek" için eski
kayıtlara dokunmayacak.

**Ekran tarafı:** bu duruma dair ekranda **hiçbir vaat verilmiyor.** "Eski
kayıtlar düzeltildi" ya da "tutarlar doğrulandı" anlamına gelebilecek bir
metin, arkasında davranış olmadığı için TEAM.md 33'ü ihlal eder. Ekranda
açıklama istenirse önce onu gerçekten karşılayan kod iner.

### 34 — kapsam ve tasarım (ux, 21 Eylül 2026 — value onayladı)

**Yön: eksik alan eklenir, zorunluluk kaldırılmaz.** `channel` gerçek ve
kullanılan bir ayar — `modules/notifications/settings.ts:10,21,45` saklıyor
(varsayılan SMS), `service.ts:130` **her otomatik mesajın taşıyıcısını**
ondan seçiyor. Şemadan atmak gerçek bir klinik ayarını sessizce düşürmek
olurdu.

**Kanal kullanıcıya seçtirilir.** İki gerekçe: (1) SMS segment başına para,
WhatsApp değil — bu kliniğin ticari kararı; (2) **ulaşılabilirlik farklı**
(ux): WhatsApp karşı tarafta uygulama + müşterinin izni + onaylı şablon
istiyor, SMS numarası olan herkese gidiyor. Yani seçim yalnızca maliyet
değil, **kimin mesajı alacağı** — bunu varsaymak için elimizde veri yok.
Türetmenin ayrıca çözemediği bir hâli var: ikisi de yapılandırılmışsa
türetme yine tahmin eder.

**Yerleşim (ux):** kanal, o formdaki diğer sekiz alanın akranı değil —
mesajın gidip gitmeyeceğini ve ne tutacağını belirleyen tek alan o.
**Formun en üstüne**, `enabled` ana anahtarının hemen altına, kendi
ayracıyla. Kontrol **radyo grubu, `Select` değil**: iki seçenek var, ikisinin
sonucu farklı, `Select` alternatifi ve sonucunu gizler. Desen mevcut,
`REMINDER_MODES` zaten radyo grubu (`notification-settings-form.tsx:64-76`).

**Yapılandırılmamış kanal.** Belirleyici ayrıntı (ux, koddan):
`lib/messaging/transports.ts:26-42` `isChannelConfigured()` **ortam
değişkenine** bakıyor, klinik başına kimlik bilgisine değil — ve sağlayıcı
bağlamaya yarayan **hiçbir ekran yok.** Yani klinik "SMS bağlı değil"
mesajını gördüğünde bu konuda **yapabileceği hiçbir şey yok.** Bu yüzden:
- Hiç listelememek **hayır** — kanalın var olduğunu bile söylemez.
- Devre dışı bırakmak **hayır** — bugün kapalı olan yarın açılabilir (env),
  ve devre dışı seçenek "bu üründe SMS yok" öğretir.
- **Seçilebilir + sonucu görünür, evet** — ama metin kullanıcıya
  yapamayacağı bir iş veremez.

(a) Her radyonun yanında kısa durum işareti ("Bağlı" / "Bağlı değil",
`text-xs text-muted-foreground`). **`StatusBadge` değil, düz metin — gerekçe
koda yorum olarak yazılır**, yoksa altı ay sonra biri "tutarlılık" diye
rozete çevirir: `StatusBadge` bir **kaydın** yaşam döngüsü durumu içindir;
burada durum kaydın değil **dağıtımın**, aynı kabuğu kullanmak rozetin
anlamını sulandırır.

(b) Seçili kanal bağlı değilse grubun altında `Callout variant="info"`
(`danger` değil: bu bir hata değil, bir eksiklik). Metin üç şeyi söyler: ne
olacağı, neyin hâlâ çalıştığı, çözümün kimde olduğu. Son cümle şart — onsuz
kullanıcı ayarlarda çözüm arar, bulamaz ve uygulamanın bozuk olduğunu
düşünür. Metin `messages/tr.json:338` `providerMissing`'den türetilir,
ikinci bir cümle ailesi kurulmaz.

**value'nun düzeltmesi — bu metin 37 inmeden yazılamaz.** ux'in taslağındaki
"Randevu sayfasından mesajı elle iletmeye devam edebilirsiniz" cümlesi SMS
kliniği için **bugün yanlıştır**: `components/notification-actions.tsx:74-86`
elle kaçış olarak yalnızca `m.whatsappLink` sunuyor, SMS'in karşılığı yok.
TEAM.md 33'ü düzeltmek için eklenen kutu, TEAM.md 33'ü ihlal ederdi. Bu
yüzden **34 ve 37 birlikte gider** (bkz. Katman 0 / 37).

**Sınıfı kapatan test (ux, value onayladı — bu maddenin en değerli kısmı).**
"Zorunlu şema alanının formda karşılığı yok" sınıfı aylarca görünmez kaldı
ve **sekiz alanın hepsini birden** kaydedilemez yaptı. Alanı eklemek bu
vakayı kapatır, sınıfı kapatmaz. `notificationSettingsSchema`'nın **her
anahtarı için formda bir kontrol olduğunu iddia eden bir test** yazılır:
zod `.shape` anahtarları okunur, form render edilir, her anahtar için `name`
özniteliği aranır (TEAM.md 6). Aynı deseni diğer form şemalarına yaymak ayrı
iş — ama bu formda bugün, çünkü kanıtlanmış bir kaza yeri.

**Hata geri bildirimi:** alan hatası **alana** iner (`Field`'ın `error`
propu; `aria-describedby`/`aria-invalid` bağlantısı hazır,
`components/ui/field.tsx:39-58`), form seviyesindeki `Callout` yalnızca
"kayıt başarısız" der. Ayrımın gerekçesi `field.tsx:32-38`'de zaten yazılı:
altı geçersiz alan altı canlı duyuru yapmasın.

**İliştirilen metin işi (ux):** `messages/*.json:125`
`client.preferredLanguageHint` bayat — "WhatsApp mesajları bu dilde
gönderilir", oysa SMS birincil kanal. Yenisi kanal adı geçirmiyor:
**"Bu müşteriye gönderilen mesajlar bu dilde yazılır."** Üçüncü kanal gelse
de doğru kalır. dev zaten `messages/*.json` içinde olacak.

**Kapsam dışı:** `modules/notifications/schema.ts:7-18` elle yazılmış 10
şehirlik `TIMEZONES` listesi. IANA listesine çevirmek onaylı bir iş ama
**bu P0'a binmiyor**; dosya sıcakken hemen ardından ayrı commit.

### 29a — kapsam (value + ux, 21 Eylül 2026)

**Neden Katman 0:** backlog "iki deploy blokeri açık" deyip ikincisini Katman
5'e koymuştu; çelişki kapatıldı. `Clinic.currency` **kolonu var**
(`prisma/schema.prisma:30`) ve beş yerde okunuyor (`app/(app)/page.tsx:33`,
`invoices/page.tsx:26`, `invoices/[id]:29`, `visits/[id]:51`,
`clients/[id]:37`), ama `modules/clinics/` altında **yalnızca `queries.ts`**
var — yazma yolu hiç yok. Türk kliniği her faturada "$" görüyor ve
düzeltemiyor.

**Kullanıcı kararı (bağlayıcı):** varsayılan TRY olacak, **mevcut klinikler
dönüştürülmeyecek** — veri migration'ı yok, bugünkü USD klinikler ayardan
kendileri değiştirir. Şema varsayılanı (b) tek başına inmez: yalnızca yeni
klinikleri etkiler, bugünkü klinik ayar ekranı olmadan yanlış para birimi
görmeye devam eder. **(a) ve (b) birlikte gider.**

**0. `formatMoney`'nin USD varsayılanı kaldırılır — 29a'nın içinde**
(ux buldu, value onayladı). `lib/format.ts:398-402` bugün
`currency = "USD"`. Ayar ekranı indikten sonra bile, para birimini geçirmeyi
**unutan her çağrı yeri sessizce USD gösterir** — klinik TRY seçmiş olsa
bile. Para sürümü dört ekran daha getiriyor. Varsayılan kalkar, `currency`
zorunlu olur: eksik geçirme **derleme hatası** olur, yanlış ekran değil.
Bu varsayılan yerinde dururken "para birimi düzeltilebiliyor" demek,
ekranın kodun yapmadığı bir şeyi vaat etmesidir (TEAM.md 33).

**1. Yer: Ayarlar sayfasının en üstünde yeni bir "Klinik" kartı** (ux).
Bugünkü sıra Türler · Bildirimler · Özel türler (`settings/page.tsx:67, 83,
152`); yeni kart bunların **önüne** gelir. Gerekçe: `timezone` (`:29`),
`country` (`:27`) ve `currency` (`:30`) aynı modelde yan yana ve **29b
hepsini isteyecek** — bugün açılan kart yarın taşınmayacak kart olsun. Kart
bugün **tek alanla** açılır; 29b'de aynı karta eklenir, düzen değişmez. Tek
alanlı kartın seyrek görünmesi kabul edilen bedel; alternatifi altı ay sonra
bir taşıma işi. Açıklaması: "Bu ayarlar kliniğin tamamı için geçerlidir."
Diğer üç kartın `CardDescription` deseni izlenir.

**2. Değiştirme anı — iki katmanlı** (ux). Tutarlar çevrilmiyor, yalnızca
sembol değişiyor; 500,00 $ kayıt ertesi gün 500,00 ₺ olarak okunacak.
- **(a) Alan altında kalıcı ipucu** (`Field.hint`, prop zaten var):
  "Para birimi yalnızca gösterimi belirler. Kayıtlı tutarlar çevrilmez."
  Her zaman görünür, çünkü her zaman doğru.
- **(b) Onay dialogu yalnızca kliniğin kayıtlı tutarı varsa.**
  `ConfirmDialog`, `tone="default"` — geri alınabilir bir ayar değişikliği,
  kırmızı değil (bkz. tasarım kararı 3). **Fatura sayısı sıfırsa dialog hiç
  çıkmaz**: kurulumdaki boş klinikte sormanın karşılığı yok, sadece tıklama
  vergisi. Metin somut: başlık "Para birimi TRY olarak değiştirilsin mi?",
  açıklama "Kayıtlı 12 faturanız var. Tutarlar olduğu gibi kalır, yalnızca
  sembolleri değişir: 500,00 $ → 500,00 ₺." **Sayı ve örnek veriden üretilir**
  — fatura sayımı ve mevcut para biriminden gerçek bir biçimlendirme.
  Uydurma örnek yazılmaz. TEAM.md 22 tersten: kullanıcı ne olacağını
  kelimeyle değil örnekle anlar.
  *Bekleme yok:* primitif `components/ui/confirm-dialog.tsx` zaten var; 29a
  backlog 17'yi (üç `window.confirm`'ün bağlanması) beklemez.
- **(c) Değişiklik `writeAudit` ile denetim kaydına yazılır** (eski → yeni,
  kim, ne zaman). ux önerdi, **value onayladı**: desen zaten var, şema yok,
  maliyeti bir satır. Gerekçe: `Invoice.currency` henüz yok (backlog 32), o
  yüzden altı ay sonra eski bir faturaya bakan kişi tutarın hangi para
  biriminde girildiğini **yalnızca** bu kayıttan öğrenebilir.

**3. Liste: kısa `Select`, dört para birimi — TRY · USD · EUR · GBP** (ux,
value onayladı). Arama kutusu değil. **Bu bir "şimdilik" değil, açık bir
kesimdir: listenin genişlemesi backlog 33'e bağlıdır.**
- ~~**Dördü de iki ondalıklı**, `formatMoney` ondalık sayısını sabitliyor~~
  — **bu gerekçe 21 Eylül'de düştü: 33 indi (`c61d058`), her para birimi
  kendi ondalık sayısını belirliyor.** Teknik kısıt kalktı.
  **Liste yine de dörtte kalıyor**, ama artık tek bir gerekçeyle: EUR/GBP
  Türkiye'deki bir kliniğin fiyatlayabileceği gerçekçi tek iki alternatif,
  ötesi spekülatif (global envanterin (b) sınıfı; yurtdışı klinik adayı
  yok, karar verilmiş). **Bunu böyle yazıyorum çünkü düşmüş bir gerekçeyle
  duran doğru karar, altı ay sonra yanlış karara dönüşür:** "33'e bağlı"
  yazılı kalsaydı, 33'ü indiren kişi listeyi genişletmeyi serbest sanırdı.
- **USD listede kalmak zorunda:** bugünkü veri USD; mevcut değeri temsil
  edemeyen bir seçim kutusu, açıldığı anda kullanıcının ayarını sessizce
  değiştirir.
- EUR/GBP, Türkiye'deki bir kliniğin fiyatlayabileceği gerçekçi tek iki
  alternatif. Ötesi spekülatif (global envanterin (b) sınıfı; yurtdışı klinik
  adayı yok, karar verilmiş).
- Etiketler sembolle okunur: "₺ Türk lirası (TRY)" — sembol kullanıcının
  faturada göreceği şey, kod kesin olan şey; ikisi bir arada seçimi
  doğrulanabilir yapar.

**"Bitti" eşiği:** ayardan TRY seçilir → yukarıdaki **beş okuma yerinin
hepsi** ₺ gösterir, biri bile USD kalırsa bulgudur; yeni klinik TRY ile
başlar; bugünkü klinik USD görmeye devam eder (bu doğru davranış, bulgu
değil) ve ayardan çevirebilir; yetkisiz rol değiştiremez; `formatMoney`
çağrısında `currency` unutulursa **derleme düşer**; TR/EN × açık/koyu ×
390px; kalite kapıları temiz.

### 32 neden 29a'nın yanına çekildi (value, 21 Eylül 2026)

Şema kısıtı kalkınca yeniden değerlendirildi ve **öne alındı.** 29a'da ux,
klinik para birimi değiştiğinde eski faturaların sessizce yeni sembolle
okunmasını **onay dialogu + denetim kaydıyla hafifletmek** zorunda kalmıştı.
Fatura kendi para birimini taşırsa o sorun sınıfı **tamamen kapanır** —
semptomu hafifletmek yerine kök neden (TEAM.md 4).

**Backfill onay kapısı değil** (kullanıcı ölçütü: yok edilen bilgi yok) ve
burada **tahmin bile değil**: mevcut faturaların hepsi bugünkü klinik para
biriminden kesildi, doğru değer belli. **Şart (kullanıcı):** backfill
**migration'ın içinde** olacak, sonradan çalıştırılacak bir script olarak
kalmayacak — yoksa kolon bir süre boş kalır ve o aralıkta okuyan kod yine
varsayılana düşer.

**Sonucu — 29a'nın dialog metni değişiyor.** Dialog ve denetim kaydı "eski
faturaların hangi para biriminde girildiği hiçbir yerde yazmıyor" diye
vardı; 32 inince o bilgi kaydın üstünde oluyor. Dialog **kalıyor** (ayar
değişikliğinin sonucunu göstermek kendi başına doğru) ama metni bir
uyarıdan bir **bilgiye** dönüşüyor: "tutarlar olduğu gibi kalır, sembolleri
değişir" değil, **"bundan sonra kesilecek faturalar TRY olur; mevcut
faturalar kendi para biriminde kalır."** Daha dürüst, çünkü 32'den sonra
gerçek davranış bu.

### 39 — kapsam ve kesme çizgisi (value, ux'in çizgisini değiştirdim)

**ux'in tarifi (aynen alındı):**
1. `restorePet` ve `restoreVisit` servisleri — mevcut `restoreClient` deseni
   birebir kopyalanabilir. **Küçük.**
2. Üç liste sayfasında "Arşivlenmişleri göster" filtresi; `includeArchived`
   bayrağı client'ta zaten var, hayvan ve vizit sorgularına eklenecek.
   Arşivlenmiş satır listede **sönük** görünür (`StatusBadge`'in `inactive`
   tonu tam bu iş için var, yeni desen gerekmiyor). **Orta.**
3. Arşivlenmiş kaydın detay sayfasındaki "Arşivlendi" kutusunun **içine**
   "Arşivden çıkar" eylemi — kutu zaten var (`clients/[id]/page.tsx:72`),
   eylem `PageHeader`'a değil kutunun içine girer: bilgi ve onu geri alan
   eylem yan yana dursun. **Küçük.**
4. İnince üç onay metnine "İsterseniz arşivden çıkarabilirsiniz." eklenir —
   metin ve davranış aynı sürümde gider.

**Kesme çizgisi değişti (value).** ux "3 kesilmez, 2 ertelenebilir çünkü
doğrudan URL'le erişim bir süre yeter" demişti. **2 de kesilmez:** bu işin
tarif ettiği zararın kendisi "arşivlenmiş kaydı bulmanın yolu yok". Kaydı
bulma yolu olmadan geri alma yolu **yoktur** — doğrudan URL'i elinde olan
kullanıcı zaten kazayla arşivlememiştir. Üstelik 2'siz 3, tam olarak bu
işin düzelttiği hatanın kendisini üretir: **erişilemeyen bir eylem**, yani
ikinci bir `restoreClientAction`.

**Baskı gelirse kesme yatay değil dikey olur:** pet ve visit yarıları
kesilir, **müşteri uçtan uca** iner (servis + filtre + geri alma eylemi).
Bir varlık için tam çalışan bir yol, üç varlık için yarım yoldan iyidir —
ve ux'in eklediği fayda: müşteri uçtan uca inince pet/visit için desen
hazır olur, ikinci ve üçüncü varlık tasarım kararı değil kopyalama işi olur.

**Dikey kesmenin iki sonucu — yazılmazsa yanlış uygulanır (ux):**

1. **"Geri alabilirsiniz" cümlesi varlık başına iner, hepsine birden
   değil.** 39 müşteriyle inerse o noktada yalnızca müşteri arşivi geri
   alınabilir; hayvan ve vizit hâlâ geri alınamaz. **Kabul kriteri: hangi
   varlığın geri alma yolu indiyse yalnızca onun onay metni "İsterseniz
   arşivden çıkarabilirsiniz." cümlesini kazanır.** Doğal refleks üçünü
   birden güncellemektir ve o refleks iki ekranda karşılıksız vaat doğurur
   — 34'ün uyarı kutusunda ve 17'nin arşiv metninde yakaladığımız kuralın
   aynısı, dikey kesme onu varlık başına bölüyor.

2. **`StatusBadge`'e `archive` kind'ı 39'da eklenir (B hattı riderı).**
   ux 18'i verirken açıkça "vefat/arşiv için kind ekleme, bugün çağrı yeri
   yok" demişti (TEAM.md 30); 39'un 2. maddesi (liste filtresi +
   arşivlenmiş satırın sönük görünmesi) o çağrı yerini **yaratıyor**.
   Yazılmazsa ikisinden biri olur: dev-ui tek seferlik gri bir pil icat
   eder ve rozetin yanına ikinci bir sistem doğar, ya da arşivlenmiş satır
   hiçbir işaret taşımaz ve normal satırdan ayırt edilemez.
   **Kind `archive`, tek ton: `inactive`** ("geçerliliğini yitirmiş, ama
   hata değil"). Ton zaten tanımlı, `outline` görünümüyle hazır; yeni ton,
   yeni token, yeni desen yok. **Backlog 7'nin vefat hâli sırası gelince
   aynı kind'a girer.**

### 40 — hiçbir yerden çağrılmayan ihracatların bir kez taranması

ux öneri olarak getirdi, iş olarak açıyorum çünkü **dördüncü kez** aynı
desen çıktı ve dört tekrar rastlantı değil, sınıftır:
- `restoreClientAction` — yazılmış, hiçbir sayfada render edilmiyor (39)
- `marketingOptIn` — dört yerde geçiyor, hiçbir gönderim yolunda okunmuyor (36)
- `parseMoneyInput` — A0-money'den önce kod tabanındaki tek eşleşme kendi
  tanımıydı
- `Callout`'un `info`/`success` varyantları — tersinden aynı şey: çağrı yeri
  yokken eklenmemiş olması doğru karardı ve yorumla savunuluyordu

**Kapsam: bir kez tarama.** Hiçbir yerden çağrılmayan `export`lu action,
servis ve şema alanı listelenir; liste value'ya gelir, **ne silineceğine
value karar verir** (36'daki gibi, kimi ölü kod borçtur, kimi kasıtlı
duran veridir). Otomatik araç (knip/ts-prune) kurmak **bu işin kapsamında
değil**: listenin uzunluğunu görmeden araç eklemek, çağrı yeri olmayan
soyutlama eklemenin tam kendisi olurdu (TEAM.md 30). Liste uzunsa araç
ayrıca konuşulur.

### 29a + 32 tek parça iner (value, 21 Eylül 2026)

**Karar: ayrı inmiyorlar.** ux bir sıra tuzağı yakaladı — 34/37'de
yakaladığımızın aynısı. 29a'nın dialogunda söylenecek doğru cümle
*"mevcut faturalar kendi para biriminde kalır"*; ama 32 inmeden
`Invoice.currency` yok, fatura kendi para birimini taşımıyor ve sembol
kliniğin **güncel** ayarından geliyor — yani o pencerede eski USD fatura
TRY sembolüyle görünmeye devam eder ve cümle **yanlış** olur (TEAM.md 33).

Alternatif, geçici bir metin yazıp 32'de değiştirmekti. Reddettim: kazancı
birkaç commit'lik erken iniş, bedeli ise "sonra değiştirilecek metin" —
ve ux'in kendi uyarısıyla, *yoksa geride kalır*. Bu turda üç kez aynı
sınıfı (metnin davranıştan önce inmesi) kapattık; dördüncüsünü kendi
elimizle açmayız.

**Ek fayda:** aynı dağıtımda migration önce koşar, ayar arayüzü sonra
açılır. Yani backfill mutlaka **değişiklik öncesi** para birimini görür.

**Migration şartı (ux, kabul edildi) — atlanırsa 32 kendisi sessiz yanlış
üretir.** `Invoice.currency` eklenirken mevcut satırlar **kliniğin o anki
para birimiyle** (bugün USD) doldurulacak, **yeni seçilen değerle değil.**
Yeni değerle doldurulursa geçmiş USD faturalar tek bir migration'la
sessizce TRY'ye döner — tam da 32'nin önlemek için var olduğu şey, üstelik
geri alınamaz: eski değer hiçbir yerde durmuyor.
**Kabul kriteri:** migration sonrası mevcut faturaların para birimi **USD**,
yeni kesilenlerin **TRY**.

**Metinler (ux):**
- Dialog başlığı: "Para birimi TRY olarak değiştirilsin mi?"
- Dialog açıklaması: **"Bundan sonra kesilecek faturalar TRY olur. Kayıtlı
  12 faturanız kendi para biriminde kalır ve öyle görünmeye devam eder."**
  Sayı veriden.
- Alan altındaki kalıcı ipucu değişti; eski hâli ("tutarlar çevrilmez")
  artık eksik kalıyor: **"Her fatura kesildiği para birimini taşır. Bu ayar
  yalnızca bundan sonra kesilecekleri etkiler."**
- Dialog, ipucu onu neredeyse gereksiz kıldığı hâlde **kalıyor**: ipucu
  alanın altında ve kullanıcı ayarı değiştirirken oraya bakmıyor olabilir;
  bu kliniğin parasını ilgilendiren bir karar.

**`writeAudit`'in gerekçesi değişti, zayıflamadı (ux, kabul edildi) — ve
BACKLOG'a yeni hâliyle yazılıyor ki 32 indiğinde biri "artık gereksiz"
diye silmesin.** Eski gerekçe: "eski faturanın para birimini başka hiçbir
yerden okuyamayız." Yeni gerekçe, daha genel ve daha kalıcı: **sonuçları
paraya dokunan her klinik ayarının ne zaman ve kim tarafından
değiştirildiği tutulur.**

### R4a (b) — ekran akışı (ux, 21 Eylül 2026 — value onayladı)

**29a'ya bağımlılık yok** (value'nun "29a'dan sonra yaz" kısıtı bayatladı,
kaldırıldı): R4a'da para yok.

**20 — neden bugün %20, sebebi tasarımda** (`components/forms/vaccination-form.tsx`):
`nextDueAt` sekiz alanın beşincisi, "Lot numarası" ile "Uygulama bölgesi"
arasında (`:74-76`) — dönüş döngüsünü tek başına kuran alan, lot
numarasıyla **aynı görsel ağırlıkta**; çıplak `DateTimeInput`, öneri yok,
veteriner "bir yıl sonrası" hesabını kafadan yapıyor; **tarih değil
tarih-saat** isteniyor (`datetime-input.tsx:42` `datetime-local`) ve
aşının gelecek yıl saat kaçta gerektiğini kimse bilmiyor; ve doldurmanın
sonucu hiçbir yerde yazmıyor.

**20'nin tasarımı:** (a) alan aşı adının **hemen altına**, tam genişlikte —
öneri ada bağlı, ad seçilince belirmeli. (b) **Öneri çipi kliniğin kendi
geçmişinden**, anahtar *aşı adı + tür*: "1 yıl sonra · 14.03.2027 · *bu
klinikte son 12 'Kuduz' kaydının çoğu 1 yıl sonraya yazılmış*".
**Kaynak cümlesi zorunlu** (TEAM.md 14). (c) **Geçmiş yoksa çip yok,
varsayılan yok, alan boş** — uydurma tarih boş tarihten kötü. (d) **Asla
kendiliğinden dolmaz**: çip öneri, varsayılan değil; tek dokunuş ucuz ama
**bilinçli**. (e) Sonuç satırı **bugün doğru olan hâliyle**: doluyken "Bu
tarih panelde 'Yaklaşan aşılar' arasında görünecek", boşken tek sefer ve
muted "Boş bırakılırsa bu aşı yaklaşanlar listesinde görünmez" — 21 inmeden
"hatırlatma gönderilecek" **yazılamaz** (TEAM.md 33). (f) **Tarih-saat
değil tarih**: `granularity="day"`.

**value'nun eklediği ayrım — 20'nin İKİ mekanizması var ve ayrı ölçülecek.**
Çip **geçmiş gerektiriyor**; bugün 5 aşı kaydı olan bir veritabanında ve
yeni bir klinikte **hiç çıkmayacak.** O yüzden çip 20'nin tamamı değil:
- **Gün bir çalışan mekanizma:** yerleşim (a) + sonuç satırı (e). Geçmiş
  istemiyor, yeni klinikte de çalışıyor.
- **Biriktikçe çalışan mekanizma:** öneri çipi (b).
**İkisi ayrı ölçülecek**, yoksa çip çıkmadığı için oran kıpırdamazsa
yanlış sonuç çıkarırız: "öneri işe yaramadı" deriz, oysa öneri hiç
görünmemiştir. **Doğru veriden yanlış sonuç.**

**Bunun tasarım sonucu — 20'nin kendi içindeki kesme sırası (ux, value
kabul etti, 20'nin kabul kriterine yazıldı):** yeni klinikte 20'nin tek
çalışan mekanizması **yerleşim (a) ve sonuç satırı (e)**. Yani onlar
"cila" değil, ürünün **ilk gün çalışan tek parçası.** Kesme baskısı
gelirse **çipten önce onlar korunur** — çip olmadan alan hâlâ
doldurulabilir, yerleşim olmadan alan görünmüyor bile.

**21 — `/reminders` satır anatomisi:** başlık · muted satır (tarih ·
müşteri · hayvan · **köken metin olarak**: "Otomatik"/"Elle eklendi" ·
erteleme yalnızca varsa "2 kez ertelendi") · satır sonunda `StatusBadge`.
Gecikmiş satır: rozet `attention`, tarih uyarı renginde, **liste
gecikmişleri başa alır**; gecikme `dueAt`'ten hesaplanır.

**Kapatma iki dokunuş ve bu bilerek:** satırda tek "Kapat", dialog *"Bu
hatırlatma nasıl kapandı?"* → Geldi · Telefonla halloldu · Gerek kalmadı.
Yüz satır × üç düğme okunabilirliği bitirir; ve **yaygın durum zaten
türetiliyor** (hayvan geldiyse klinik kayıt düşüyor, satır kendiliğinden
kapanıyor). Elle kapanış **istisna**, istisna için iki dokunuş doğru fiyat.
**`ConfirmDialog`'a opsiyonel `choices` eklenir, ikinci bir dialog
bileşeni YAZILMAZ** — odak tuzağı/Escape/odağın geri dönmesi bir kez doğru
yapıldı (`confirm-dialog.tsx`), kopya ayrışır (TEAM.md 30).

**Erteleme:** ayrı "Ertele" → 1 hafta · 1 ay · Tarih seç. `snoozedUntil`
dolar, **`dueAt` değişmez**, sayaç artar. Üçüncüden sonra satır **daha
görünür** olur (rozet `attention`, "3 kez ertelendi" normal ağırlığa
çıkar). Gizlenmez, büyür.

**Boş hâller (19a kuralıyla):** "Açık" boş → "Açık hatırlatma yok." +
"Klinik kayıtlarından oluşan hatırlatmalar burada görünür."; "Kapandı" boş
→ "Kapanmış hatırlatma yok." + eylem "Açık olanlara dön".

**21'in kabul kriterine yazıldı:** 20'nin sonuç satırı, 21 inince
hatırlatma cümlesine **yükselir** — yoksa geride kalır (29a/32'de kurulan
disiplinin aynısı).

**21b — takip:** giriş **vizitin sonu** (vizit formunun sonuna tek alan
"Takip tarihi" + aynı öneri çipi, anahtar *vizit türü* + aynı sonuç
satırı; 20 ile **aynı bileşen**). Çıkış **sabah gün planı**:
`/appointments` bugün görünümünün üstünde ince şerit "Bugün aranacaklar
(4)" — hayvan · sahip · neden · "Ara" (`tel:`) · "Kapat" (aynı üç neden).
Gizli filtre yok, sayı görünür, **tarihi geçen satır düşmez daha görünür
olur.** 21b'nin **kendi tasarım işi yok**; kesilirse tasarım borcu
bırakmıyor.

**Tek yeni primitif isteği: `granularity="day"`** (B hattı). Kapsamı
yalnızca `nextDueAt` değil — `Reminder.dueAt`, `Visit.followupAt`,
`Invoice.dueAt`, dördü de **gün** kavramı. Kullanıcıdan bilmediği bir şeyi
istemek yalnızca sürtünme değil, **çöp veri** üretiyor.
**Soru soruldu ve CEVAPLANDI (ux kendi iddiasını denetledi): hayır,
Katman 0 değil.** `lib/whatsapp/schedule.ts:86-95` `reminderNoticeDueAt`,
`dueAt`'in **yalnızca tarih parçalarını** alıp anı `morningHour`'da
yeniden kuruyor (`isReminderNoticeDue` `:97-109` da aynısını yapıyor).
Kullanıcının bıraktığı 00:00 hiçbir yere gitmiyor; zamanlama kliniğin
`morningHour` ayarından geliyor ve bu **bilerek böyle yazılmış.**
Yani girdi çöp, ama **onu yanlış okuyan bir şey yok**:
`granularity="day"` bir **sürtünme düzeltmesi**, hata düzeltmesi değil.
Sırası değişmiyor.

**Ama bir ŞART getiriyor ve o gerçek (ux):** `zonedParts(dueAt, timeZone)`
tarihi **kliniğin saatine göre** çıkarıyor. Yani gün-bazlı alan
**kliniğin saatiyle gece yarısı** olarak saklanmalı, **UTC gece yarısı
olarak değil.** UTC gece yarısı saklanırsa UTC'nin batısındaki bir
klinikte o an yerel olarak **bir önceki gün** olur ve tekrar tarihi bir
gün kayar — varsayımsal değil, klinik saat dilimi listesinde
`America/New_York` ve `America/Los_Angeles` var
(`modules/notifications/schema.ts:7-18`).
`DateTimeInput` bu dönüşümü zaten doğru yapıyor (kendi yorumu: *"means
what the clinic's clock says"*); `granularity="day"` **aynı mekanizmanın
üstüne** kurulur, yanına ikinci bir tarih işleme yolu açılmaz.
**Kabul kriteri:** kliniği New York yapıp gün-bazlı bir tarih kaydet,
**aynı gün görünsün** (saat dilimi işinde kullanılan doğrulamanın aynısı).

**Nereye UYGULANMAZ: `Appointment.startsAt`.** Randevunun saati gerçek bir
bilgi ve `hoursBefore` modu onu gerçekten okuyor. Gün-bazlı olan dört alan:
`Vaccination.nextDueAt`, `Reminder.dueAt`, `Visit.followupAt`,
`Invoice.dueAt`.

### R4a (21) — durum modeli, kapanış, erteleme (ux (a) parçası, value onayladı)

**İlke: hatırlatma bir iş kalemidir, bir mesaj değildir.** Bugünkü model
ikisini karıştırıyor ve R4a'nın bütün zorluğu oradan çıkıyor.

**1. `ReminderStatus` iki ayrı şeyi tek eksende taşıyor.** Bugünkü
`PENDING | SENT | ACKNOWLEDGED | DISMISSED` (`prisma/schema.prisma:534-539`)
içinde `SENT` bir **teslimat** bilgisi — oysa teslimat `MessageLog`'da ve
`Reminder.messages` bağı zaten var (`:557`). Aynı olgunun iki kaydı var ve
ayrışabilirler: mesaj `FAILED` düşerse hatırlatma `SENT` kalır ve ekran
"gönderildi" der. **Backlog 16** (başarısız gönderimin yeniden denenmesi)
inince bu kesin bozulur. Ayrıca `SENT` bir kapanış değil: mesaj gitti,
hayvan gelmedi — açık bir iş "gönderildi" kutusunda duruyor.
**value doğruladı:** yinelenme kontrolü zaten `MessageLog.status` okuyor
(`modules/notifications/service.ts:349-351`), `ReminderStatus` değil. Yani
teslimat gerçeğini `MessageLog`'a bırakmak mevcut davranışı bozmuyor.

**2. Yeni model: `ReminderStatus: OPEN | CLOSED`.** Bir iş kalemi ya bizden
bir şey istiyor ya istemiyor; gerisi **nitelik**, durum değil.
- **Ertelenmiş ayrı hâl değil** — "erteleme bir kapanış değil, bir
  gecikmedir" (value kuralı). Üçüncü hâl açmak ertelemeyi sessizce bir park
  yerine çevirir, yani tam olarak engellemek istediğimiz şey.
- **Gecikmiş ayrı hâl değil**, tarihten türetilir; rozette `dikkat` tonu.
- ~~**Göç eşlemesi, bilgi kaybı yok:** `PENDING`→`OPEN`; `SENT`→`OPEN`
  (teslimat `MessageLog`'da); `ACKNOWLEDGED`→`CLOSED` + `ATTENDED`;
  `DISMISSED`→`CLOSED` + `NOT_NEEDED`.~~
- **KARAR DEĞİŞTİ (21 Eylül 2026, value onayladı) — enum yeniden
  adlandırılmıyor.** `ReminderStatus` **olduğu gibi kalıyor**, yanına
  **`closeReason` eklemeli olarak** geliyor. Gerekçe dev'den ve sağlam:
  `OPEN_REMINDER_STATUSES` panel, liste ve **ham SQL**'in tek ortak
  kaynağıdır (41'in kazanımı) ve **ham SQL'de tip kontrolü yoktur** —
  yeniden adlandırma sessizce kırardı. Üstteki satır silinmedi (30b):
  altı ay sonra biri onu şartname sanmasın diye üstü çizili duruyor.

**3. Kapanış:** `closedAt`, `closedById` (→User, `SetNull`), `closureReason`
(`ATTENDED | RESOLVED_BY_PHONE | NOT_NEEDED`).
**Türetilmiş kapanış kendini `closedById = null` ile söyler** — ayrı bir
"otomatik mı" alanı yok. value'nun "kapatan kişi denetim kaydına yazılır"
kararını bir alan eklemeden karşılıyor. Türetilmiş kapanışın nedeni her
zaman `ATTENDED`. Neden **enum, serbest metin değil**: `RESOLVED_BY_PHONE`
dönüş oranında "gelmedi" sayılmayacak (value ölçüm notu) ve bu ancak enumla
ölçülebilir.

**4. Erteleme:** `snoozedUntil`, `snoozeCount`.
**`dueAt`'e dokunulmuyor — bu maddenin en önemli kısmı.** `dueAt` klinik bir
olgu (aşının ne zaman gerektiği); erteleme bir iş kuyruğu kararı. `dueAt`
kaydırılırsa tıbbi olgu iş akışıyla ezilir ve "bu aslında martta
gerekiyordu" bilgisi geri dönülmez biçimde kaybolur.
**Kullanıcının şartı: bu gerekçe testle sabitlenecek, yorumla değil** —
altı ay sonra "tek alanla hallederiz" diyen biri çıkacak ve o alan
`snoozedUntil`'ı silecek. **Testin iki iddiası (ux):** (1) erteleme
`dueAt`'i değiştirmez; (2) **`dueAt` geçmiş, `snoozedUntil` gelecek olan
kayıt gecikmiş sayılır.** İkincisi asıl koruma: birincisi tek başına
geçerken biri gecikmeyi `snoozedUntil`'a bağlarsa erteleme gecikmeyi gizler
ve döngü sessizce ölür.
- Sıralama anahtarı `snoozedUntil ?? dueAt`.
- **Gecikme her zaman `dueAt`'e göre** hesaplanır; aksi hâlde erteleme
  gecikmeyi gizler ve satır temiz görünür.
- `snoozeCount >= 3` olan satır daha görünür olur (value kuralı).

**5. Köken ve kaynak bağı:** `createdById` (null = sistem üretti),
`vaccinationId`, `visitId` (üçü de `SetNull`).
**Köken için ayrı enum yok** — `closedById` ile aynı kalıp; enum eklemek
üçüncü bir doğruluk kaynağı yaratır ve ayrışırsa hangisinin doğru olduğu
bilinmez. **Polimorfik `sourceType`/`sourceId` yerine iki açık yabancı
anahtar:** yalnızca iki kaynak var, referans bütünlüğü bedava, `SetNull`
ile bağ kopsa bile hatırlatma ayakta kalıyor. `visitId` R4a-3 için hazır.

**6. Bilerek eklenmeyenler:** `origin` enum'u (türetilebilir), "Ertelendi"
durumu (kapanış değil), serbest metin kapanış notu (ölçülemez kılar; çağrı
yeri yok, TEAM.md 30), `Reminder` üzerinde teslimat alanı (`MessageLog`
tek kaynak).

**7. value'nun iki açık ucu — ux koddan kapattı (21 Eylül):**
- **`Reminder.sentAt`: yazılmayı bırakır, kolon kalır.** ux taradı — iki
  **yazma** var (`reminders/service.ts:62`, `notifications/service.ts:500`),
  **sıfır okuma**: ne ekranda, ne sorguda, ne mantıkta. Yani alan bugün
  zaten yalnızca yazılan ölü veri; model bu sorunu yaratmıyor, görünür
  kılıyor. Okuma olmadığı için yazmayı kesmek hiçbir şeyi bozmaz; kolonu
  düşürmek veri yok eder ve karşılığında hiçbir şey kazandırmaz
  (`36`'daki `marketingOptIn` kalıbı birebir). **40'ın beşinci örneği.**
- **`countPendingReminders` (`modules/reminders/queries.ts:27`) hiçbir
  yerden çağrılmıyor** — value'nun endişelendiği sayaç ölü çıktı.
  **40'ın altıncı örneği.**
- **Ama canlı olan başka yerdeydi ve risk ters yönde:** panel kartı
  (`modules/dashboard/queries.ts:107-108`) **ham SQL** ile `'PENDING'`
  sayıyor. Göçten sonra sayı **büyümeyecek, sıfırlanacak** — o enum değeri
  artık var olmadığı için sorgu hiç satır bulmaz, kart **0** gösterir, ve
  **kod derlenir, testler geçer.** ux'in ifadesiyle: **"kırılmıyor, yalan
  söylüyor."** TEAM.md 2'nin en saf örneği. Kartın bugünkü hâli ayrıca
  yanlış ve **41 olarak açıldı**, göçten bağımsız kapanıyor.
- **Kartın anlamı da değişiyor, yalnızca sorgusu değil (ux).** `OPEN` eski
  `PENDING` + `SENT`'i kapsadığı için düz çeviri kartı "açık olan her
  hatırlatma"ya çevirir — üç ay sonra gereken aşı dahil; sayı sürekli şişer,
  hiçbir eylem önermez. **Kart bugün ilgi isteyeni saysın:** `OPEN` **ve**
  `snoozedUntil ?? dueAt <= günün sonu`. Tıklama **aynı kümeye** gitsin
  (38'in `FilterTabs`'ı + URL parametresi deseni).

**Göçün kabul kriterine giren ikinci madde (ux): 41'de kurulan tek kaynak,
göçte yeni ölçütle güncellenir.** Aynı ölçüt iki kez yazılıyor — 41'de
`PENDING + SENT`, 21'de `OPEN` **ve** `snoozedUntil ?? dueAt <= günün
sonu`. Tek kaynağa indirildiği için ucuz (tek yerde değişir), ama
atlanırsa kart göçten sonra "açık olan her şeyi" sayar — üç ay sonraki aşı
dahil — ve sessizce şişer, bu sefer gerçekten yanlış olarak.
**Panel sayısı bu yüzden iki kez değişiyor ve ikisi de kasıtlı:** 41'de
büyüyor (eksik sayılan iş görünür oluyor), 21'de küçülüyor (ölçüt "bugün
ilgi isteyen"e daralıyor).

**Göçün kabul kriterine giren test (ana oturum, TEAM.md 6).** "Ham SQL'deki
enum dizeleri elle taranacak" bir **görev metni kuralıdır** ve o görevle
biter; sınıfın tehlikesi tam olarak hatırlanmamak üzerine kurulu, çünkü
`tsc` görmüyor ve testler geçmeye devam ediyor. Bunun yerine: **ham SQL
bloklarında geçen enum dizelerinin gerçekten o enum'un bir değeri olduğunu
iddia eden bir test.** Prisma şemasından enum değerleri okunabiliyor,
`$queryRaw` çağrıları sınırlı (bugün üçü de `modules/dashboard/queries.ts`:
`'PENDING'` `:107`, `'ACTIVE'` `:90`, `'PAID'` `:132`). Test bugün geçer,
göçte kırmızı yanar, **altı ay sonraki enum değişikliğinde de** kırmızı
yanar.

**8. Ölçüme etkisi (value).** Bugün hesaplanamayan üçü hesaplanabilir
oluyor: kapanış nedeni dağılımı, türetilmiş vs elle kapanış oranı
(`closedById` null mu), erteleme davranışı (`snoozeCount`).
**Yeni ölçü eklendi (ux önerdi, value aldı): `dueAt` ile `closedAt`
arasındaki süre.** Gerekçe: kapanıyor ama iki ay sonra kapanıyorsa döngü
çalışmıyor, sadece defter tutuyoruz. **Oran ve hızın birlikte gerekmesinin
sebebi (ux, kayda değer):** *oran erteleme ile manipüle edilebilir, hız
edilemez* — sonsuza kadar ertelenen bir satır asla "kapanmadı" sayılmaz ve
oranı bozmaz. Bu gerekçe burada duruyor ki ileride biri "hız fazladan ölçü,
oran yeter" demesin.

### 14b — onay kapısının bu tarafında (value'nun kendi düzeltmesi)

**Yanlış sınıflandırdım ve düzeltiyorum.** dev'in bayat sınıflandırmasını
("şema gerektiriyor, onaya gider") sorgulamadan ana oturuma ilettim, oysa
kendi kayıtlarımda kuralın 21 Eylül'de daraldığı yazılıydı: onaya giden
yalnızca **geri alınamaz veri işlemi** ve **yeni özellik**.

14b yeni bir kullanıcı yeteneği değil — `notificationsOptIn`'i
**ispatlanabilir** kılıyor; bugün çıplak bir boolean ve KVKK tarafında
rızanın ispatı zaman ve kaynaktır. Eklemeli kolon, veri dönüşümü yok.

**İki şart (value):**
- **Kaynak personele sorulmaz, sistem çıkarır** (TEAM.md 15). "Bu rıza
  nereden geldi?" diye bir açılır liste o alanı boş ya da yanlış doldurur.
  Kaynak, rızanın kaydedildiği **yoldan** türetilir; bugün tek yol varsa
  tek değer yazılır, bu bir eksiklik değil.
- **Mevcut kayıtların zamanı uydurulmaz.** Backfill'de `createdAt`'i rıza
  zamanı gibi yazmak **ispat üretmek** olur ve ispatın sahtesi yokundan
  kötüdür. Eski satırlarda alan **boş kalır** — "bilmiyoruz" doğru cevap.
  Boş bir kolona değer yazmak serbest; **uydurulmuş** değer yazmak bilgi
  üretmek değil, bilgiyi kirletmektir.

### Kusur sınıfı: gerekçesi bayatlamış doğru karar

Bu turda **üç kez** oldu ve üçü de ancak biri fark ettiği için yakalandı:
- `marketingOptIn`'in kolonunun kalma gerekçesi ("migration onaya gider") —
  yetki kuralı değişince düştü; **ux düzeltti.**
- 29a'nın para birimi listesini dörtte tutan gerekçe ("hepsi iki ondalıklı,
  `formatMoney` sabitliyor") — **33 inince düştü; value düzeltti.**
- 14b'nin "onay bekliyor" sınıflandırması — kural değişince düştü;
  **dev düzeltti, value onaylamıştı.**

Üçünde de **karar doğru kaldı, gerekçe çürüdü.** Tehlike şu: yazılı duran
çürük gerekçe, sonraki okuyucuya yanlış bir serbestlik ya da yanlış bir
yasak verir — 33'ü indiren kişi para birimi listesini genişletmeyi serbest
sanırdı.

**Dördüncü vaka diğer üçünden farklı ve ayrım formülasyona giriyor (ux).**
Diğer üçü bir **kararın gerekçesinin** bayatlamasıydı; `/audit` ise bir
**kapsam notunun** bayatlamasıydı. Fark şurada: **bayat gerekçe yanlış bir
kararı savunur — karara bakan görebilir. Bayat kapsam notu ise bakmayı
engeller:** "burası tarandı" yazısı, bir sonraki kişinin oraya hiç
gitmemesini sağlar. Yani tehlikeli olan yanlış cümle değil, **doğru
cümlenin kapsamının yazılı olmaması.** pm'in notu yanlış değildi; eksik
olan "neyin taranmadığı"ydı.

**İkinci kural (ux): bir alanı kapatan her not, neyi kapsamadığını da
yazar.** "`modules/` altındaki servis çağrıları tarandı" ile
"yetkilendirme temiz" arasındaki fark, bu turda bir erişim açığı kadar.

**Kural (value, bu turda kondu):** bir işi kapatırken, o işin **başka bir
kararın gerekçesi olarak anıldığı** yerlere bakılır. Düşen gerekçe üstü
çizilerek bırakılır ve karar yeniden gerekçelendirilir ya da geri alınır.
Gerekçesiz duran karar, kararsızlıktan kötüdür.
Ana oturuma TEAM.md maddesi olarak önerildi.

### 7 — vefat nerede söylenir + `deceased` gerçekten durum mu (ux, value onayladı)

**Bugünkü olgu:** `modules/pets/queries.ts:22-29` `listPets` yalnızca
`archivedAt` ve arşivlenmiş sahibi süzüyor — **`deceased` süzülmüyor**
(`Pet.deceased`, `deceasedAt` şemada var, `:204-205`). Yani vefat etmiş
hayvan bugün hatırlatma formunun açılır listesinde duruyor ve seçilebiliyor.

**Kural (ux, genel hâliyle): bir eylem, nedeni ekranda zaten yazılıysa
kaldırılır; yazılı değilse kontrolün kendisi nedeni taşır. Sessiz eleme
hiçbir durumda doğru cevap değildir.**
- **Hayvanın kendi sayfasında → eylem hiç sunulmaz.** Tepede zaten "vefat
  etti" uyarısı var (7 ile geliyor); devre dışı bir düğme aynı bilgiyi
  ikinci kez ve daha zayıf söyler.
- **Başka ekranın açılır listesinde → kalır, seçilemez, sebep etikette:**
  **"Karamel (vefat etti)"**, arşivde **"Karamel (arşivlendi)"**. Yerel
  `<option disabled>` bunu zaten yapıyor: görünür, seçilemez, ekran
  okuyucu "devre dışı" duyuruyor. Sessizce süzmek burada 16c ihlali —
  veteriner "Karamel"i arar, bulamaz, **uygulamanın kaydı kaybettiğini**
  düşünür.
- **Üçüncü katman:** sunucu yine de reddeder, ve ret **genel hata değil
  hayvan alanının hatası** olarak döner (`Field`'ın `error` propu). Elle
  URL, eski sekme, yarış durumu — arayüz tek savunma olamaz.

**Ek iş (ux, 7 kapanmadan): `deceased` bayrağının kaç sorguda dikkate
alındığına bir kez bakılacak.** Vefat "durum" olarak karar verildi ama şu
an yalnızca **gönderim ayağında** durum gibi davranıyor olabilir.

### `SUBJECT_CLOSED` — dördüncü kapanış nedeni (value ölçüm kararı)

value sordu: vefat nedeniyle kapanan satırlar `NOT_NEEDED` kovasına
düşerse o kovadaki **klinik yargı** sinyali kirlenir mi? **Evet, ve dördüncü
değer ekleniyor.** ux'in gerekçesi kirlenmeden daha temel: mevcut üç değerin
hepsi **döngünün bir sonucu** (geldi, telefonla halloldu, gerek kalmadı).
**Vefat bir sonuç değil, konunun ortadan kalkması** — döngü kapanmadı,
konusuz kaldı.

**Değer: `SUBJECT_CLOSED`, TR "Hayvanın kaydı kapandı".** Sistem kapattığı
için `closedById = null`. **Vefat ile arşiv ayrılmıyor, tek değer:** ayrıntı
zaten `Pet` üzerinde (`deceased`, `deceasedAt`, `archivedAt`), ikinci bir
yere kopyalamak iki doğruluk kaynağı yaratır — köken için enum açmayı
reddederken kullanılan gerekçenin aynısı.

**Ölçüm kuralı: bu satırlar dönüş oranının PAYDASINDAN TAMAMEN ÇIKAR.** Ne
başarı ne başarısızlık. Ölçtüğümüz şey "takip edilen hayvan geri geldi mi"
ve ölen hayvan o soruya cevap veremez; paydada bırakmak dönüş oranını
mekanik olarak düşürür ve döngüyü olduğundan kötü gösterir.
**"Telefonla halloldu" notundan bir adım ileride:** o, bir sonucun **yanlış
kovaya** konmaması; bu, bir satırın **hiç sayılmaması**.

### 42b yeniden çerçevelendi — türetme zemini bugün yok (ux)

**`Visit.appointmentId String? @unique` şemada var** (`prisma/schema.prisma:318-319`),
yani randevu↔vizit birebir bağı **tasarlanmış**. Ama **hiçbir yer onu
yazmıyor** — `modules/visits/`, `visit-form.tsx`, `visits/new/page.tsx`
taramasında **sıfır sonuç.** Alan var, veri yok.

**Bu, kalıbın üçüncü tekrarı:** R4a-1 (aşı tekrar tarihi %20 dolu),
`InvoiceLine.visitId` (0/2), şimdi `Visit.appointmentId` (0). **Türetme,
var olmayan bir girdinin üstüne kuruluyor** (TEAM.md 29: sayıyı önce çıkar,
işi sonra tarif et).

**42b tek iş değil, dört parça:**
- **(i) Girdi — vizit randevudan doğsun.** Randevu detayında "Vizit başlat"
  → `/visits/new?appointmentId=…`; form hayvan, müşteri, veteriner ve türü
  önceden doldurur, `appointmentId`'yi gönderime taşır. Desen mevcut:
  `/visits/new?petId=…` (`pets/[id]/page.tsx:115`), aynı yolun ikinci
  parametresi. **Kendi başına değerli** ve açık kullanıcı sorularından
  birine dokunuyor: *"gün içinde aynı bilgiyi iki kez yazdığınız yer
  neresi?"* — randevuyu yazıp viziti sıfırdan doldurmak birinci aday.
  **Ölçü: `appointmentId` dolu vizit oranı, bugün 0.**
  **Yeni yetenek olduğu için kullanıcı onayına gitti.**
- **(ii) Türetme — (i)'den sonra neredeyse bedava.** Bağlı viziti olan
  randevu `COMPLETED` olur, kimseden emek istemeden, nedeni "geldi".
  R4a-2'deki aşı kaydı kalıbının birebir aynısı.
- **(iii) Elle kapanış — R4a-3 ile aynı bileşen.** Bağlı viziti olmayan
  geçmiş randevu **asla otomatik `NO_SHOW` olmaz** (uydurulmuş değerle
  ölçmek istediğimiz sayıyı ölçemeyiz), ama `SCHEDULED` de kalmaz. Sabah
  gün planında dünün cevaplanmamış randevuları için ince şerit:
  **Geldi · Gelmedi · İptal oldu.** Yeni ekran yok. **R4a-3 ile birlikte
  yapılırsa ek maliyeti yok, ayrı yapılırsa ikinci bir tasarım turu.**
- **(iv) Cevaplanmamış satır kaybolmaz** — şeritte birikir, **sayısı
  görünür** olur. Ertelemedeki kuralın aynısı: görünürlük azalmaz, artar.

### 43 — tarama ayrı iş değil, testin kendisi (value)

ux "sayfa seviyesinde yetki kontrolü olmayan rotalar bir kez taransın" +
"kalıcı düzeltme testte" diye **iki şey** önerdi. **Tek şeye indiriyorum:
test zaten taramanın kendisidir.** Rotaları rol rol dolaşıp iddia eden bir
test, ilk koşusunda sınıfın tamamını listeler; ayrıca elle taramak hem
tekrar olur hem de sonucu hiçbir yerde sabitlenmez.

**Testin kaynağı gezinme listesi DEĞİL, dosya sistemi** (ux düzeltti, value
kabul etti). İlk tarif gezinmeyi kaynak alıyordu ve **`/audit` o testten
GEÇERDİ** — gezinmede var, herkese açık, test "görünüyor, açılıyor,
tutarlı" der. Açığı bulan şey gezinme değil, `audit.read` izninin tanımlı
olup **kullanılmaması.**

**Doğru test:** `app/(app)/**/page.tsx` sayılır; her rota için dosya **ya
açık bir yetki kontrolü içerir** (`can(` / `requirePermission`) **ya da
adı adına yazılmış bir "tüm rollere açık" listesinde** geçer. Üç faydası:
(1) gezinmede görünmeyen `[id]` detay sayfaları da sayıma girer — value'nun
işaret ettiği kör nokta; (2) yeni sayfa otomatik yakalanır, **unutmak
seçenek olmaktan çıkar**; (3) "herkese açık" bir varsayım olmaktan çıkıp
**yazılı bir karara** dönüşür — bugün `/audit` herkese açık çünkü kimse
aksini yazmamış.

Liste uzun çıkacak (hayvan/müşteri/vizit detayları meşru biçimde tüm
rollere açık, kiracı kapsamıyla korunuyor) ve bu sorun değil.
**Şart (value): listeyi dev doldurup geçmez, value tek tek onaylar** —
listenin değeri birinin ona bakmış olmasında; bakılmazsa bugünkü `/audit`
durumu daha resmi bir biçimde yeniden üretilmiş olur.

**pm'in rol rol turu iptal değil, rolü değişti:** emniyet ağı değil
**doğrulama.** Kapsamı test garanti eder, pm gerçekte ne göründüğünü söyler.

**Sıra (value): 43, 41'in ve 37'nin kalanının önüne geçiyor.** ux "39'un
yanına" demişti; katılmıyorum. Bilinen bir erişim açığı açıkken metin ve
sayaç işi yapmak savunulamaz, ve düzeltmenin kendisi küçük (`can()` +
`requirePermission`, deseni `/staff`'ta hazır). Pahalı olan test, o da
sınıfı kapatıyor.

**Koda yorum olarak yazılacak ayrım (ux, value onayladı):** başka kliniğin
kaydı → **"bulunamadı"** (varlığı sızdırma), rol yetersizliği →
**"yetkiniz yok"** (sızdıracak varlık yok, `/staff` her klinikte var).
Yorum olmazsa biri tutarlılık adına ikisini birleştirir ve izolasyon
kararını bozar.

### 7'nin kalanı — oluşturma da engellenir (value kararı, 21 Eylül 2026)

dev sordu: gönderim durdu ama **oluşturma serbest** — vefat etmiş hayvana
hatırlatma hâlâ **oluşturulabiliyor.** Engellemek mi, yoksa oluşturulan ama
hiç gitmeyecek hatırlatmayı göstermek mi?

**Karar: engellenir.** TEAM.md 12 — güvenilmeyen bir döngü olmayandan
kötüdür; hiç gitmeyecek bir satır listeyi kirletir ve veterinerin listeye
güvenini bitirir. Ama iki şartla, yoksa düzeltme yeni bir sessiz yanlış
doğurur:

**(a) Şimdi, 7 ile birlikte:** elle oluşturma denenirse kullanıcı **neden**
olmadığını görür. Sessizce yok saymak, ekranın yapmadığı bir şeyi yapıyor
gibi görünmesidir.

**(b) 21'e bağlandı, şimdi değil:** bugün **açık olan** ve hayvanı vefat
etmiş/arşivlenmiş hatırlatmalar **sessizce kaybolmaz, görünür biçimde
kapanır.** Sessizce süzmek TEAM.md 16c'nin yasakladığı şeydir — kaybolan
satır "uygulama unuttu" demektir. Kapanış nedeninin hangi değer olacağı
21'in `closureReason` modeline bağlı ve o alan bugün yok; bu yüzden şimdi
istenmiyor, 21'in kapsamında.

### 38 — `/reminders` bugün kayıt kaybediyor (ux buldu, 21 Eylül 2026)

**Hat: A** (`modules/reminders/queries.ts`) + paylaşımlı sayfa
(`app/(app)/reminders/page.tsx`). **Bağlayıcı sıra: 21'den (R4a-2) önce.**

İki **sessiz eleme**, ikisi de TEAM.md 16c'nin kelimesi kelimesine
yasakladığı şey ve ikisi de R4a'nın üstüne kurulacağı ekranda:

1. **Kapanmış hatırlatma listeden sessizce düşüyor.**
   `modules/reminders/queries.ts:6` → `statuses = ["PENDING", "SENT"]`;
   `ACKNOWLEDGED` ve `DISMISSED` hiç görünmüyor ve sayfada filtre arayüzü
   **yok** (`FilterTabs` sıfır çağrı). Kapanan kaydı geri getirmenin hiçbir
   yolu yok. R4a'nın ilk haftalardaki hedefi otomasyon değil
   **doğrulanabilirlik**; veteriner bugün defteriyle karşılaştıramaz —
   defterinde beş satır, ekranda üç, eksik ikisinin yapıldığını mı
   kaybolduğunu mu göremiyor.
2. **Yüzüncü hatırlatmadan sonrası sessizce kesiliyor.** Aynı sorguda
   `take = PAGE_SIZES.LIST` = 100 (`lib/pagination.ts:14`) ve sayfada
   `Pagination` **yok**. 101. hatırlatma var, görünmüyor, hiçbir yerde
   "daha fazlası var" demiyor. Bugün küçük veriyle görünmez; R4a otomatik
   hatırlatma üretmeye başlayınca **üç haneye ilk çıkan klinikte**, yani
   tam da özelliğin işe yaramaya başladığı anda patlar.

**Tasarım (ux): kapanan satır gizlenmez, yer değiştirir.** `FilterTabs`
gelir (deseni `invoices/page.tsx:47`, `visits/page.tsx:45` — icat yok):
**Açık** (varsayılan, PENDING+SENT) · **Kapandı** (ACKNOWLEDGED+DISMISSED) ·
**Tümü**. Sekmelerde **sayılar** görünür ("Açık 12 · Kapandı 84") — 16c
sayılabilirlik istiyor. `Pagination` gelir (deseni
`appointments/page.tsx:207`).
**38'in kabul kriterine eklendi (ux): panel kartının bağlantısı filtre
parametresini taşır ve kartın saydığı kümeyi açar.** Bugün
`href="/reminders"` çıplak (`app/(app)/page.tsx:99`); 41'de sorun değil,
çünkü liste zaten aynı kümeyi varsayılan gösteriyor. Ama `FilterTabs`
gelince kullanıcı hangi sekmeye düşerse düşsün sayıyla aynı kümeye
düşeceği garanti olmaz. Ekran 19a'nın filtrelenmiş-boş kuralına uyar:
"Kapandı" boşken "Hatırlatma yok." değil **"Kapanmış hatırlatma yok."**,
eylemi "Açık olanlara dön".

**Neden Katman 0 değil, Katman 2 (value).** Bugün zarar **gizil**, etkin
değil: gönderilmiş mesaj 0 ve cron yanlış yapılandırılmış, yani pratikte
kapanan hatırlatma da yüzü aşan liste de henüz yok. 19a'nın filtrelenmiş
boş listesi ise **bugün** yanlış cümle kuruyor; ayrımı oradan yaptım. Ama
**21'den önce bağlayıcı**: 21 bu zeminin üstüne kurulursa hatayı büyütür ve
aynı dosyaya iki kez gideriz.

### R4a-2'nin (21) şema ihtiyacı — bugün yazıldı ki soru hiç doğmasın

Şema kısıtı kalktı; R4a'nın akışı "alan eklemek pahalı" diye
**kısılmayacak.** `Reminder` modelinde (`prisma/schema.prisma:541-563`)
bugün beşinin de karşılığı yok ve beşi de BACKLOG'da zaten verilmiş
kararlardan doğuyor:

| İhtiyaç | Kaynağı |
|---|---|
| **köken** (otomatik / elle) | 18'in gereksinimi: "otomatik ve elle ayırt edilebilir olacak"; bugün türetilemiyor |
| **kapanış nedeni** (geldi · telefonla halloldu · gerek kalmadı) | R4a-2 kapanış kararı. `ReminderStatus` taşıyamıyor: `ACKNOWLEDGED` üçünü de örtüyor — ve "telefonla halloldu"nun dönüş oranında **"gelmedi" sayılmaması** value'nun ölçüm notu |
| **kapatan kişi + zaman** | value'nun yetki kararı: "kapatan kişi ve neden denetim kaydına yazılır" |
| **erteleme sayacı + ertelenen tarih** | value'nun erteleme kuralı: "tarih taşır ve kendini sayar; üçüncüden sonra daha görünür olur" |
| **kaynak bağı** (hangi aşı/vizit kaydından doğdu) | "bağ kesilmez: bağ ucuz, geçmiş veri geri getirilemez" |

Yani 21 zaten beş alanlık bir şema dokunuşuydu; kısıt kalkmasa bile
kaçınılmazdı. **"Tasarımı kısalım mı" sorusu 21'e gelindiğinde
sorulmayacak.**

### Tasarım kararları (ux, 21 Eylül 2026 — value onayladı)

Bunlar tek bir görevin metni değil, **kalıcı kurallar**; ilgili bileşen
yazılırken uygulanır ve testte sabitlenir.

1. **Pildeki renk her zaman durum demektir.** `Badge variant="secondary"`
   bugün durum, tür, kanal, dil ve sayı için ayrımsız kullanılıyor (13 çağrı
   yeri). Durum → `StatusBadge` (tek renkli pil kaynağı); tür/kanal/dil →
   `outline`, renksiz; sayı → pil değil düz metin.
2. **`StatusBadge` yalnızca yaşam döngüsü durumu taşır, köken taşımaz.**
   Gerekçe ve value'nun pozisyon değişikliği 18 numaralı satırda yazılı.
3. **İptal kırmızı değildir.** İptal/arşiv/geçersiz kılma `inactive` tonu
   (kenarlıklı, renksiz); kırmızı yalnızca `FAILED` gibi bizim tarafımızda
   ters giden şey için. Bugün beş **geri alınabilir** eylem
   (`archiveClient/Pet/Visit`, `cancelAppointment`, `voidInvoice`) kırmızı
   düğme + çöp kutusu ikonuyla çıkıyor; tek gerçek silme (`settings:171`
   özel tür) sessiz `ghost` düğmeyle. TEAM.md 25'in **her iki yönü** de
   ihlal edilmiş. `DeleteButton` da yeniden adlandırılıyor.
4. **Faturada `warning` tonu vadesi geçmiş hâline ayrıldı** (`Invoice.dueAt`,
   backlog 32). `SENT` ve `PARTIAL` aynı tonda — ikisi de "hâlâ para
   alacağız". Rezervasyon kodda yorum olarak duruyor ki boşluk yanlış
   doldurulmasın.
5. **Kuruş kullanıcı arayüzünde hiçbir yerde görünmez.** Alan adları
   `amountCents` → `amount`, placeholder **değer taşımaz**, girdi kontrollü
   olmaz, ipucu `Field.hint` ile verilir. 100 kat hatasının kullanıcı
   tarafındaki kaynağı buydu: `payment-form.tsx` placeholder'ı kalan borcu
   ham kuruş olarak gösteriyor, yani ekran kuruş istiyormuş gibi okunuyordu.
   Kod düzelse bile o placeholder kalsa hata kullanıcı tarafından yeniden
   üretilirdi. **A0-money kapanmadan aynı turda iniyor** (value) — sonraya
   kalırsa pm aynı ekranı iki kez test eder.
6. **Olumlu ton mevcut `accent`'i kullanır — `--success` tokenı YOK.**
   ux önerdi, value onayladı, sonra **ux kendi önerisini geri çekti** ve
   value düzeltmeyi kabul etti. Bu satır altı ay sonra "olumlu durum için
   ayrı bir renk lazım" diyerek yeniden açılmasın diye duruyor.
   **Çürüten ölçüm (dev-ui):** rozetin tonunu **dolgu değil metin rengi**
   taşıyor (accent-fg ↔ muted-fg CIE76 ΔE 27,8). "Teal tıklanabilir demek"
   itirazı, düğme ile pilin aynı görüneceği varsayımına dayanıyordu; oysa
   düğme `--primary` üstünde beyaz metin, pil accent dolgu üstünde koyu teal
   metin. Varsayım gözlemle desteklenmedi. Yeni bir token + üç tema bloğu +
   parite testi, ölçülmüş bir ihtiyaç olmadan eklenmiş olacaktı — yani
   TEAM.md 30'a takılan öneriyi getirendi.
7. **Ton ekseni yaşam döngüsü evresi değil, "bu satır benden bir şey istiyor
   mu".** dev-ui'nin önerdiği eksen; ux aldı, altı ton beşe indi. Ekseni
   değiştirmek üç atamayı da düzeltti: **`GELDİ` dikkat** (olumlu değil —
   gelmiş hayvan uygulamadaki en çok eylem isteyen satır, sahibi ayakta
   bekliyor), **`DEVAM EDİYOR` nötr** (iş zaten yapılıyor), **`ONAYLANDI`
   nötr**.
8. **Sayaç rozetleri pil olarak kalır.** ux'in 1 numaralı kararındaki "sayı
   düz metin olacak" maddesi geri alındı: renk anlamı düzeldikten sonra
   muted sayaç pili hiçbir şeyi yanlış söylemiyor. Korunan tek kural:
   **renkli pil her zaman durum demektir.**

**Kayda geçen ölçüm bulgusu (dev-ui):** `--muted-fg` (#756f64) açık temada
**muted dolgu üzerinde 4.08 ile AA'dan kalıyordu**; sayfa zemininde 4.53 ile
geçtiği için kimse görmemişti. Muted dolgu tam da nötr rozetin, yedi tablo
başlığının ve ghost hover'ın indiği yer. #6b6559 ile düzeltildi ve negatif
testle sabitlendi. Bu, TEAM.md'deki "ölçüm metnin gerçekte üstünde durduğu
yüzeye karşı yapılır" kuralının **neden orada olduğunun kanıtı** — kuralı
tekrar yazmıyoruz, kanıtını buraya koyuyoruz.

**"Tamamını öde" düğmesi: ONAYLANDI** (kullanıcı, 21 Eylül 2026),
A0-money'nin kapsamında. Tarif: kalan borcu **tutar alanına yazan** ikincil
düğme — tahsilat kaydetmez, form göndermez; kullanıcı yazılanı görür,
isterse değiştirir, sonra normal "Tahsilat ekle"ye basar. Geri alınamaz
kayıt üretmiyor, onay kapısının bu tarafında.
**Kullanıcının koyduğu şart, kabul kriterine geçti:** düğme alana yazdığı
anda **ne yazdığı görünür olsun** — alan boş bir "otomatik doldu" hissi
vermesin, yazılan değer okunabilir ve **değiştirilebilir** dursun. Karşı
argümanın (resepsiyon alışkanlıkla basıp kısmi ödemeyi tam kaydeder) tek
gerçek dayanağı buydu ve kriterle kapanıyor.

**İliştirildi, ayrı madde açılmadı:** `lib/permissions.ts:133` `forbidden()`'a
çeviri anahtarı yerine ham Türkçe cümle veriyor ve içinde `(pets.write)` izin
adı geçiyor — İngilizce arayüzde Türkçe metin, üstüne geliştirici jargonu
kullanıcıya sızıyor. Bir sonraki `lib/` işinde yanında gider.

## Katman 1 — döngü hiç dönmüyor

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 42b | Randevunun kendiliğinden kapanması (yaşam döngüsü) | A | **SÜRÜM DIŞI (kullanıcı, 21 Eylül) — ertelendi, reddedilmedi.** Gerekçesi ve ölçüsü "Sürüm dışı" bölümünde korunuyor | — | **42a'dan ayrıldı (value):** mesajın engellenmesi bir hata düzeltmesi, randevunun kendiliğinden kapanması bir **yaşam döngüsü kararı** — akış işi, ux'e soruldu. Ölçüm hedefi "kapatılan randevu oranı > 0" bununla karşılanacak. |
| 12 | R1: cron saatlik (`vercel.json`) | A | **kod indi `046d6a2` ama İŞ KAPANMADI** — "bitti" eşiği `message_logs`'ta `status = SENT` bir kayıt ve o kanal yapılandırmasına bağlı. Commit kapatmaz | — | Günde tek çalışma 05:00 UTC = İstanbul 08:00; varsayılan mod "gün içi 09:00" olduğu için hatırlatma hiç bulunmuyor. Tek satır. |

## Katman 2 — güvenilirlik ve kimlik

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 14b | Rızanın ne zaman ve hangi yolla alındığının kaydı | A | **dev'de (21 Eylül)** | — | Bugün çıplak boolean; rızanın ispatı zaman ve kaynaktır. Eklemeli kolon, veri dönüşümü yok. Global (a) sınıfı. |
| 15 | Şifre değiştirme | A | **SÜRÜM DIŞI (kullanıcı, 21 Eylül)** — sonraki sürümün başına | — | Şifreler yöneticideyken hesaplar kişiye özel değil; denetim kaydı kimi yazdığını bilmiyor. |
| 16 | R2: başarısız gönderimin yeniden denenmesi | A | **indi `fa70a35`**, pm kabulü bekliyor | — | FAILED kaydı adayı kalıcı bloke ediyor; en fazla 3 deneme, aralarında ≥6 saat. |
| 17 | Onay dialogu primitifi | B | **indi `0a790aa`**, pm kabulü bekliyor — üç `window.confirm`'ün gerçekten gittiği teyit edilecek | — | A hattı R4a'daki "tekrar tarihini temizle" eylemini buna bağlayacak. |
| 18 | DESIGN-3 `StatusBadge` | B | **KISMEN — "bitti" yazma.** Altyapı + dokuz ekran indi (`7f8aec0`, `fd19e86`), ama ux tasarım incelemesinde **dört ton sapması** buldu (`ARRIVED`, `NO_SHOW`, `reminder.SENT`, eksik `staff` kind'ı), artı `PageHeader`'ın `badge` yuvası eklenmemiş ve `secondary` süpürmesinin **16 çağrı yeri** duruyor. dev-ui listeyi aldı | — | **R4a'dan önce bitmeli.** Gereksinim (value): otomatik ve elle hatırlatmalar **ayırt edilebilir** olacak. **Mekanizma ux'in kararı ve pil değil:** köken, yaşam döngüsü durumundan farklı bir eksen; ikisi aynı şekilli pile konursa kullanıcı her satırda iki pil okumak zorunda kalır ve pilin anlamı kaybolur. Köken satırın gri alt satırına metin olarak yazılır. value ilk formülasyonunda "rozet ayrımı" demişti ve **pozisyonunu değiştirdi** — altı ay sonra pili geri eklemek isteyen için cevap burada. |
| 19b | DESIGN-4'ün kalanı: 13 rotanın yükleme hâli | B | **13 rota indi** (`ListSkeleton`, `action`/`filter` proplarıyla), pm kabul etti. **Kalan: `EmptyState`'in `inline` boyutu ve `components/ui/`'ye taşınması** | — | **R4a'dan önce bitmeli**: `/reminders` ile aynı dosyaya dokunuyor. Ağır yarısı 19a olarak Katman 0'a çıktı. |

## Katman 3 — döngünün girdisi ve kapanışı

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 20 | R4a-1: girdinin kendiliğinden dolması | A | **ONAYLANDI (kullanıcı, 21 Eylül) — ve Katman 0'ın içine, 29a+32'den hemen sonraya alındı.** Gerekçe aşağıda | — | Ölçüldü: son 90 günde aşıların %20'sinde tekrar tarihi dolu. Asıl iş üretim değil, alanın dolması. |
| 21 | R4a-2: türetme + kapanış + durum modeli (eski R4b dahil) | A | **ONAYLANDI (kullanıcı, 21 Eylül).** Katman 0 bittikten sonra, sürümün en büyük işi — **takvim riski artık burada** | 17, 18, 19b, 20, 38 | Kapanış kavramı olmadan "bitti" ölçülemez. Bağ kesilmez: bağ ucuz, geçmiş veri geri getirilemez. `/reminders` sayfası paylaşımlı. |
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

## Katman 5 — görünürlük ve kurulum

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 26 | DESIGN-2 `DataTable` | B | **indi** — value'nun sırasında değildi. İçinden Katman 0 sınıfı bir kusur çıktı, bkz. 44 | — | Gün planı sunumundan önce: yoksa dokuzuncu kopyala-yapıştır tablo doğar. |
| 28 | Gün planı — tablo sunumu (`DataTable`'a geçiş) | B | **26 ile birlikte kapandı**, ayrı iş kalmadı | 26 | Varsayılan gün görünümü kararı kalıcı; "Tüm tarihler" ikincil görünüm. |
| 29b | C1'in kalanı: ülke alanı + türetilenlerin görünmesi + klinik yazma tarafının tamamı | A | **SÜRÜM DIŞI (kullanıcı, 21 Eylül)** | 29a | Deploy blokeri olan parça 29a olarak Katman 0'a alındı; kalanı burada. |
| 30 | Kurulum ekranı (boş klinikte panel yerine sıralı liste) | B | açık | — | **Kapsama eklendi (ux, 21 Eylül):** `app/(app)/settings/page.tsx:43` → `if (!profile) redirect("/")`. Bu yetkisizlik değil, **eksik klinik profili** — bozuk veri hâli sessizce panele atılıyor. Yetkisizlik ekranına çevrilmeyecek (yanlış şeyi söyler); doğrusu kullanıcıyı **kuruluma** yönlendirmek, panele atmak değil. | 29 ile aynı paket ama farklı dosyalar; paralel gidebilir, panel sayfası paylaşımlı. |
| 31 | DESIGN-5 mobil gezinme erişilebilirliği + `PageHeader` taşması | B | **indi `2d91080` + `72f5afd`** — value'nun sırasında değildi. **`flex-wrap` ile çözüldü, taşma menüsüyle değil:** tasarım sistemi borcunun B maddesi **kapanmadı**, "beşinci eylem" uyarısı yerinde; gerekçe kodda yorum olarak yazılı. Gerekçe TEAM.md 27: `pets/[id]`'de dördüncü eylem 390px'te ekranın **dışındaydı**. **Kök düzeltme de içinde:** kenar çubuğu 390px'te etiketleri `hidden` ile gizliyordu ve `display:none` erişilebilirlik ağacından da siler — **ekran okuyucu on bir gezinme bağlantısının hepsini adsız okuyordu**, çıkış düğmesi dahil | — | Küçük. **Sebep bağı:** `PageHeader`'ın 390px'te eylemlerini ekran dışına atmasının kök nedeni, kod tabanında bir **menü/taşma primitifinin olmaması** (bkz. "Tasarım sistemi borcu"). Primitif yokken bu semptom düzeltilse de aynı sınıf yeniden doğar — taşacak eylemin gideceği bir yer yok. |

## Katman 6 — para doğruluğu

| # | İş | Hat | Durum | Bekler | Neden |
|---|---|---|---|---|---|
| 32 | C4 `Invoice.currency` — **Katman 0'a çekildi, 29a ile tek parça iner** | A | açık | 29a ile birlikte | **C1'den sonra** — ters sırada faturalara eski USD kopyalanır. |
| 33 | C3 `formatMoney` ondalık sabiti | A | **indi `c61d058`** — value'nun sırasında değildi, dev'e soruldu. pm kabulü bekliyor | — | Kuruşsuz para birimlerinde yanlış görünüm. **Bu indi diye 29a'nın dört para birimlik listesi genişlemiyor** — teknik kısıt kalktı ama ürün gerekçesi duruyor (bkz. 29a kapsamı). |

---

## Hatlar arası bekleme noktaları (yalnızca bunlar)

1. **18, 19b (B) → 21 (A).** `StatusBadge` ve yükleme hâlleri, R4a-2'nin
   `/reminders` işinden önce bitmeli. B hattı bunları erken alsın. 19a
   Katman 0'a çıktı ve zaten 19b'den önce gidiyor.
2. **17 (B) → 21 (A).** Onay dialogu primitifi, "aşı kaydındaki tekrar
   tarihini temizle" eylemine bağlanacak.
3. **26 (B) → 28 (B).** Gün planı indi; kalan yalnızca tablo sunumunun
   `DataTable`'a geçmesi.
4. **29a (A) → 32 (A).** Para birimi ayarı fatura kolonundan önce; 29b sonra.
5. **9 (B) → 10 (B).** Primitif önce, yerleştirme sonra.

Bunların dışında iki hat birbirini beklemez. Paylaşımlı dosyalarda
(`messages/*.json`, `app/(app)/**/page.tsx`) sıra değil, haberleşme kuralı
geçerlidir.

## Bilerek açılmayanlar (ux, 21 Eylül 2026)

- **`components/page-header.tsx`'in taşma menüsü olmaması** (backlog 31'in
  kökü). Semptomu `flex-wrap` ile kapatıyoruz ve **bunu bilerek yapıyoruz**;
  gerçek çözüm menü/taşma primitifi ve o, "Tasarım sistemi borcu" B
  maddesiyle aynı iş.
- **Formlarda "Vazgeç" eylemi — KAPANDI, kusur değil (ux karar verdi,
  value kabul etti).** 18 formun hiçbirinde yok, ama hepsi ya tam sayfa ya
  kart içi ve ikisinde de kaçış yolu zaten var (geri bağlantısı, gezinme,
  sayfadan ayrılma). "Vazgeç"in gerçek değeri **modal** bağlamında ve
  orada zaten var (`ConfirmDialog`'da Vazgeç ilk sırada ve odağı alıyor).
  **Gerçek boşluk başka ve bu satır onu kapatmıyor:** yarım doldurulmuş
  formdan ayrılırken uyarı yok. Ama onu "Vazgeç" düğmesi çözmez,
  `beforeunload`/route guard çözer — ayrı bir karar ve **bugün
  açılmıyor**, kanıt yok.
- **"Kaydedilmemiş değişiklik uyarısı" — KANIT BEKLİYOR (reddedilmedi).**
  Ayrı satır, çünkü ayrım gerçek: "Vazgeç" düğmesinin kusur olmadığına
  **karar verildi**; yarım doldurulmuş formdan ayrılırken uyarı
  olmamasının kusur olup olmadığı **bilinmiyor** — kullanıcının gerçekten
  form yarıda bırakıp bırakmadığına dair veri yok. Aynı satıra yazılırsa
  bu da kapanmış sayılır.
- **B — menü/taşma primitifi: gerçek borç, ama BU SÜRÜMDE TETİĞİ YOK**
  (ux ölçtü, ana oturumun varsayımını çürüttü). Varsayım "tetik R4a'dan
  gelir, `/reminders` satırında üç eylem olur" idi. Ölçüm: **`/reminders`
  satırı iki eylem alıyor** ("Kapat", "Ertele") — kapanış nedeni satırda
  değil, dialogun içinde, bilerek. Ve **`PageHeader`'ın bugünkü tepe
  noktası dört**, tek bir sayfada (`pets/[id]`); diğerleri iki ve altı.
  Bu sürümde beşinciyi ekleyen bir iş yok — 39'un "Arşivden çıkar" eylemi
  `PageHeader`'a değil arşiv uyarı kutusunun içine giriyor.
  **Tetik (tarih değil, olay): ilk beş eylemli ekran.** O ekran açıldığında
  B onunla birlikte açılır. Ölçüt "bir gün lazım olacak" değil, "şu an
  ödeyeceği bir fatura var mı".


- **`charts.tsx:103` sütun ipucu yalnızca fareyle ulaşılabilir.** Açılmadı ve
  gerekçesi şu: `role="img"` + `aria-label` tüm seriyi zaten okuyor, yani
  **bilgi kayıp değil**. Klavyeyle erişilebilir ipucu bir popover primitifi
  ister; o da menü/taşma primitifiyle (backlog 31'in kökü, "Tasarım sistemi
  borcu" B maddesi) **aynı iştir**. İkisi birlikte yapılır, bugün değil.
  Tek başına yapılırsa ikinci bir katmanlı-yüzey sistemi doğar (TEAM.md 30).

## Tasarım sistemi borcu — sıraya alındı (ux ölçtü, value sıraladı)

**A + C tek paket, B hattı.** Ayrı yapılırsa aynı dört dosyaya ve aynı
yüzeylere iki kez gidilir.

- **A — etiket/değer çifti bileşeni yok.** Aynı iş **dört dosyada, iki
  farklı adla**: `Detail` (`clients/[id]:170`, `pets/[id]:420`) ve `Row`
  (`appointments/[id]:205`, `visits/[id]:288`). Detay sayfalarının
  omurgası. **Neden şimdi:** R4a bu dosyalardan ikisine dokunuyor —
  `visits/[id]`'ye takip tarihi satırı (21b), `pets/[id]`'ye arşivden
  çıkarma (39). **Beşinci kopya şu an yazılmak üzere.**
- **C — köşe yarıçapı ve yüzey.** `rounded-lg` 47 · `rounded-2xl` 29 ·
  `rounded-xl` 10 · `rounded-full` 9 · `rounded-md` 8 — **üç rol için beş
  değer**; ayrıca 14 yerde hem kenarlık hem `shadow-sm` var, ikisi aynı işi
  yapıyor. **Neden şimdi:** tutarsızlık **şu anda yeni primitiflere
  kopyalanıyor** — `Callout` `rounded-lg`, `ConfirmDialog` `rounded-2xl`,
  `EmptyState` `rounded-2xl`, `Input` `rounded-lg`, `Badge` `rounded-full`;
  her biri komşusuna bakarak seçmiş.

- **Yeni: `tabular-nums` tüm kod tabanında SIFIR kez kullanılıyor** (ux).
  Sayı sütunları varsayılan **orantılı** rakamlarla diziliyor; sağa
  hizalamak yetmiyor, **"1.234,56" ile "999,00" alt alta geldiğinde
  basamakları tutmuyor.** Bir para sütununun var olma sebebi
  karşılaştırılabilir olması; bugün göz her satırda yeniden hizalanıyor.
  Bugünkü para sütunları: fatura listesi, fatura detayı (kalemler +
  toplamlar), panel kartları, `visits/[id]`, `clients/[id]`.
  **Neden şimdi:** para sürümü **dört yeni para ekranı** getiriyor (fiyat
  listesi, fatura türetme, vadesi geçmiş alacak, müşteri bakiyesi). Kural
  bugün bedava, o dört ekrandan sonra süpürme — `fullName()`/`format.ts`
  için kurulan "bedava penceresi tam olarak bir sonraki sürüm" kuralının
  aynısı (TEAM.md 16b).
  **value'nun eklediği yön: sınıfı her hücreye serpmek değil, yapıya
  koymak.** `DataTable`'a **sayısal kolon tipi** gelsin (sağa hizalama +
  `tabular-nums` birlikte); yedi ekran **yapısal olarak** kazanır ve para
  sürümünün dört yeni ekranı bedava gelir. Sınıfı elle serpmek A'daki
  `Detail`/`Row` kopyasının aynısını üretir: aynı karar yirmi yerde
  tekrarlanır ve biri unutulur.
  **Yuva iki değil ÜÇ (ux taradı):** (1) `DataTable` sayısal kolon tipi —
  yedi ekran + para sürümünün dördü; (2) **panel** (`app/(app)/page.tsx:93,
  112, 178`) — istatistik kartlarının `hint`'i ve grafik değerleri, **tek
  bir `cards` map'i**, yani burası da tek yer. Ayrı madde olarak
  yazılmazsa `DataTable` düzelir ama **panelin kartları hizasız kalır** —
  ve panel, veterinerin sabah baktığı ilk ekran; (3) `invoices/[id]` —
  aşağıdaki istisna. Yani elle uygulanan istisna **iki** yer, ama ikisi de
  tek dosya: sprinkle değil, yuva.
  **`<Money>` bileşeni ÖNERİLMİYOR, gerekçesi burada dursun ki biri
  önermesin (ux):** para her zaman sağa hizalı değil — cümle içinde
  geçtiğinde ("Kalan borç: 450,00 ₺") hizalama yanlış olur. **Hizalama
  bağlamın kararı, değerin değil.** Üç yuva yeterli; dördüncüsü doğru
  kullanımı belirsiz bir yüzey olurdu (TEAM.md 30).
- **`invoices/[id]/page.tsx:74` `DataTable`'a TAŞINMAYACAK** (ux, gerekçeli
  kapsam dışı). `DataTable` inmiş, yedi ekran geçmiş, geriye tek elle
  yazılmış tablo kalmış — ve o bir **liste değil, bir belge**:
  `<tfoot>`'unda ara toplam/KDV/genel toplam var, satırları tıklanabilir
  değil, sayfalama yok, boş hâli yok (faturanın kalemi hep olur).
  `DataTable`'a `footer` yuvası eklemek **tek çağrı yeri için soyutlama
  şişirmesi** olurdu (TEAM.md 30). **Ama iki şeyi paylaşacak**, yoksa aynı
  üründe iki farklı tablo gibi görünürler: hücre yoğunluğu (`py-2` değil
  `DataTable`'ın `px-4 py-3`'ü) ve başlık stili (`bg-muted/50`).
  *"Farklı bileşen demek, farklı görünsün demek değil."*

**Sıradaki yeri (value): 11 ve 18'in düzeltmelerinden sonra, `ConfirmDialog
choices` ile `granularity="day"`den ÖNCE.** Gerekçe C'nin kendi
gerekçesinden çıkıyor: o iki primitif de yazılırken komşusuna bakıp bir
yarıçap seçecek ve **iki değer daha çivilenecek.** Rol başına tek değer
onlardan önce konursa bedava, sonra konursa üçüncü bir süpürme.

**D — hareket tokenları kaldırılıyor, hareket dili KURULMUYOR.**
`globals.css:27-28`'de iki token, tüm uygulamada üç kullanım (madde 30'un
ters yönü). ux'in gerekçesi: bu uygulamada hareketin taşıyacağı bir anlam
yok — ekranlar sunucuda render ediliyor, geçişler anlık, ve klinik
aracında dikkat çekmek için hareket zaten istemediğimiz şey. İki token
kaldırılır, üç çağrı yeri düz sınıfa iner. **40'ın kapsamına girdi, ayrı
iş açılmadı** — ve 40'ın "liste value'ya gelir" kuralının istisnası:
bu üçü **karara bağlandı**, yeniden sorulmayacak.

**E'nin ilk maddesi kapandı** ("Vazgeç", bkz. Bilerek açılmayanlar).
**İkinci maddesi açık:** hata geri bildiriminin üç farklı biçimi (yalnız
satır içi / yalnız toast / ikisi birden) — ux ayrıca inceleyip gelecek.

## E2 — hata geri bildiriminin üç biçimi (ux ölçtü, value ikiye böldü)

**Ölçüm (18 form):** yalnızca satır içi **5** (`appointment`, `invoice`,
`sign-in`, `sign-up`, `visit`) · yalnızca toast **7** (`vaccination`,
`treatment`, `diagnostic`, `note`, `prescription`, `species-settings`,
`notification-settings`) · ikisi birden **5** (`client`, `payment`, `pet`,
`reminder`, `staff`). `payment-form` üç kanal birden taşıyor.
**Kural olmamasının sonucu** — C'deki yarıçap dağılımıyla aynı mekanizma:
her form komşusuna bakmış, komşular da birbirine.

**Kural (ux): gönderim hatasının tek kanalı satır içi `Callout`'tur.**
Hata forma aittir — kullanıcının baktığı ve düzeltmeyi yapacağı yerde
durur, düzeltilene kadar kalır, yeniden okunabilir. **Toast kaybolur:**
uzun formda alta kaymış kullanıcı toast'ı kaçırırsa hata hiç görünmemiş
olur ve o kullanıcı "kaydettim" sanır. İkisi birden erişilebilirlikte de
zarar: `Callout variant="danger"` zaten `role="alert"`, toast da canlı
bölge — aynı cümle iki kez duyurulur. **Toast'ın çözdüğü gerçek sorun
başka türlü çözülüyor:** gönderim başarısız olunca **odak `Callout`'a
taşınır** (ya da ilk geçersiz alana); `ActionForm` ortak sarmalayıcı
olduğu için tek yerde. `toast.error` **formsuz** eylemlerde (silme,
arşivleme) kalır — orada hatayı gösterecek form yok.

**value ikiye böldü — risk eşit dağılmıyor:**
- **E2a, kesme çizgisinin ÜSTÜNDE:** yalnızca toast kullanan **7 form**.
  Risk burada yoğunlaşıyor, çünkü toast kaçırılırsa **hiçbir görünür hata
  kalmıyor** — "ikisi birden" kullanan 5 formda satır içi zaten var, yani
  kaçırılan toast yalnızca fazlalık. Yedi forma `Callout` eklenir + odak
  taşıma (`ActionForm`, bir kez).
- **E2b, kesme çizgisinin ALTINDA:** kalan süpürme — 5 "ikisi birden"
  formdan `toast.error`'ün kaldırılması, biçim birliği. Bugün hata
  **görünüyor**, yalnızca fazladan bir kanalla görünüyor.

**Sıra (ux önerdi, kabul edildi):** DESIGN-1'in kalan çağrı yerleriyle
**aynı işte** — o iş zaten `invoice-form` ve `reminder-form`'a dokunuyor,
ayrı gidersek forma iki kez gideriz. **A hattı** (`components/forms/**`
hakem kararıyla A'nın).

**Başarı bildiriminde kusur YOK — kod değişmiyor, kural yazılıyor (ux).**
`toast.success` 9 formda var, 9'unda yok ve tutarsız **görünüyor**. Değil:
olmayanların hepsi kaydettikten sonra **başka bir sayfaya gidiyor** (onay
sayfanın kendisi), olanların hepsi **yerinde kalan** alt formlar (aşı,
tedavi, tanı, not, reçete) — orada görünür tek değişiklik listenin
uzaması. **Kural: sayfa değiştiren form toast göstermez, yerinde kalan
form gösterir.**
**Bu vakanın kendisi kayda değer:** desen doğruydu ve gerekçesi vardı,
ama **yazılı olmadığı için tutarsızlık gibi okundu.** "Gerekçesi bayat"
sınıfının kardeşi: **gerekçesi hiç yazılmamış doğru karar.** İkisinin de
bedeli aynı — sonraki okuyucu yanlış sonuç çıkarıyor, ve bu kez az kalsın
çalışan bir deseni "düzeltiyorduk".

## 24/31/32 denetimi (ux, 21 Eylül 2026) — iki kural tuttu, bir varsayım çürüdü

**31 (mantıksal yön sınıfı) tuttu ve bedava olduğu KANITLANDI.** Bu turda
yazılan dört bileşende **sıfır fiziksel yön sınıfı**: `status-badge`,
`callout`, `confirm-dialog`, `empty-state`. `data-table.tsx:17`'deki
`text-right` bir **yorumun içinde** ve kopyaların onu kullandığını,
bileşenin yerine `text-end` ürettiğini anlatıyor; API `align: "end"`.
Kalan fiziksel iki yer (`combobox.tsx:185`, `select.tsx:14` — `pr-9` ok
boşluğu) **kuraldan önce** yazılmış; toplu çevirme ayrı iş.
**Kuralı koyarken gerekçe "bugün bedava, sonra yüzlerce satır" idi. Dört
yeni bileşen o kuralla doğdu ve kimse ek maliyet ödemedi.**

**24 (koyu tema) temiz.** Yeni bileşenlerin ve durum dosyalarının
hiçbirinde ham renk yok: sıfır hex, sıfır Tailwind palet rengi. Tek
kalıntı `appointments/[id]:117` `text-amber-700` ve o 37'nin içinde.

**32 — VARSAYIM TERS ÇIKTI: bu kod tabanında TR uzun olan dil, EN değil.**
`invoiceStatus.PARTIAL` "Kısmen ödendi" (13) / "Partial" (7) — **neredeyse
iki katı**; `SENT` "Gönderildi" (10) / "Sent" (4); `FAILED` "Başarısız" /
"Failed"; `appointment.emptyHint` 84 / 55; `audit.emptyHint` 103 / 80.
Yalnızca `CANCELLED` ("İptal"/"Cancelled") ve birkaç kısa başlıkta EN uzun.
**"İngilizce'de test et, orası daha uzun" refleksi burada yanlış.** En dar
yer `DataTable`'ın durum sütunu ve oradaki en uzun etiket **TR**.
**32'nin kabul kriteri (value, yüzey başına yazıldı — ana oturum TEAM.md'ye
geçirmeden önce burada görmek istedi):**
> Bir bileşen, **o yüzeyin stres dilinde** test edilmeden bitmiş sayılmaz.
> Hangi dilin uzun olduğu **yüzey başına değişir ve ölçülür, varsayılmaz.**
> Bu kod tabanında **durum rozetleri ve boş hâl metinleri için stres dili
> TÜRKÇEDİR** — "Kısmen ödendi" (13) / "Partial" (7). Bu yüzeylerde
> yalnızca İngilizcede test etmek yeterli değildir.
 Yazılmazsa herkes
içgüdüyle EN'de bakar ve dar ekranda taşan TR'yi kimse görmez.

**Em işareti — ÇÖZÜLDÜ: tek kural değil, İKİ kural (ana oturum TEAM.md'ye
yazdı, value'nun gerekçesiyle).** Bir ara iki çelişen kayıt oluştu (value
"kapsam TR", ana oturum "EN de dahil"); ana oturum pozisyonunu değiştirdi
ve ayrımı maddeye geçirdi. Nihai hâl:
- **Üslup kuralı, kapsamı TR.** Em işareti yasağı bir Türkçe tipografi
  kuralıdır. **EN'e genişletilmedi** ve nedeni yazılı: İngilizcede em
  işareti yerleşik ve doğru; orada yasaklamak geçerli olmadığı bir dile
  Türkçe kuralı dayatmak olur, ve **"simetri" bunun gerekçesi olamaz.**
- **Düzen kısıtı, her dile ait.** Em işareti **dar alanda duran
  metinlerde** (boş hâl, ipucu, rozet, tablo başlığı) hiçbir dilde
  kullanılmaz — 390px'te kötü sarıyor.
- **İkisi karıştırılmaz:** biri üslup ve TR'ye özgü, diğeri düzen ve her
  dile ait.
- **Düzen kuralının KAPISI YOK ve ekleniyor (ux buldu).** Üslup kuralının
  kapısı var: `messages/messages.test.ts:97-102`, ama
  `describe("Turkish house style")` bloğunun içinde ve **yalnızca TR
  map'i** üzerinde dönüyor — **ve bu yapı doğru**, oraya EN eklemek tam
  da reddettiğimiz şeyi yapmak olurdu. Düzen kuralı ise şu an yalnızca
  düzyazı; üstelik bunu, başlık yorumu *"Prose rules get forgotten by the
  next person writing a screen; this file is the version that does not"*
  diyen bir dosyanın yanında yapıyoruz (TEAM.md 6).
  **Eklenecek:** `Turkish house style` bloğunun **dışında**, kendi adıyla
  (ör. `describe("narrow-text layout")`) ve **iki locale'i birden** dolaşan
  ikinci bir test. **Battaniye değil, anahtar ailesine göre kapsamlı:**
  `*.empty*`, `*.*Hint`, `enum.*Status.*` ve tablo başlıkları — uzun bir
  paragrafta EN'de em işareti tamamen meşru, kısıt yalnızca dar alanda
  duran metinler için. İki kural **kodda da ayrı durur**, tıpkı TEAM.md'de
  ayrıldıkları gibi; aynı bloğa konursa altı ay sonra biri "bu neden EN'e
  bakıyor?" diye sorar ve yanlış olanı siler. Bugün geçer, yarın kırmızı
  yanar. **37'nin `messages` dokunuşuyla aynı işte.** `en.json`'daki dört kullanım (`:365`, `:460`, `:511`, `:521`)
  **ikinci kural gereği** değişiyor; dördü de boş hâl/ipucu metni.

**Bu vakanın kendisi 30c'nin iki kez örneği oldu:** önce kapsamı yazılı
olmayan bir not vardı (TR 0 / EN 4), sonra o not **kapsamı genişletilerek
"düzeltildi"**. Doğru düzeltme kapsamı **yazmakmış**, genişletmek değil.

**31 — TEAM.md 16b'nin İLK DOĞRULANMIŞ ÖRNEĞİ (kayda geçirildi).** Kural
konurken tek gerekçe "bugün bedava, sonra yüzlerce satır"dı ve **kanıt
yoktu.** Dört yeni bileşen (`StatusBadge`, `DataTable`, `ConfirmDialog`,
`EmptyState`) o kuralla doğdu: **sıfır fiziksel yön sınıfı, sıfır ek
maliyet.** Kalan iki fiziksel kullanım (`combobox.tsx:185`,
`select.tsx:14`) kuraldan **önce** yazılmış. Bir daha "kanıtı yok,
erteleyelim" tartışması çıktığında gösterilecek şey budur.

**Sürüm ritüeli — kural denetimi (ana oturum önerdi, value kabul etti).**
Her sürüm sonunda **o sürümde konmuş kurallardan biri ölçülür**: tuttuysa
kanıtı yazılır, tutmadıysa kural ya güçlendirilir ya kaldırılır.
Performans eşiklerinin kademeli sıkılması için kurulan ritüelin aynısı.
- **Bu sürümde ölçülen: 31** (yukarıda, tuttu).
- **Bir sonraki sürümde ölçülecek kural şimdiden seçildi:** *"para alanı
  taşıyan şema modül sabiti olamaz, istek başına kurulur."* Seçme
  gerekçesi: mekanik olarak ölçülebilir (modül düzeyinde para şeması
  araması) **ve** sessizce geri gelmeye en yatkın kural — çünkü ihlali
  hiçbir ekranı bozmaz, yalnızca locale'i yanlış okur.

## Kesme çizgisi (iki hatta göre güncellendi)

- **Kesilmez:** Katman 0, 1, 2 ve 3. Bunlar olmadan sürümün vaadi tutmaz.
  Kanal katmanı (eski Katman 4) kapandı: SMS altyapısı indi.
- **Kesme sırası:** önce 21b (`followupAt`), sonra Katman 6, sonra 31 ve 30,
  sonra 28.
- **Katman 0'dan hiçbir şey kesilmez** — iki hat olması bu kuralı değiştirmez,
  yalnızca daha erken bitmesini sağlar.

## Sürüm dışı (bir sonraki sürümün başlangıcı)

- **R3** — hatırlatma kurallarının `notifications`'tan `reminders`'a taşınması.
  Dışarıdan görünmeyen yapı borcu. **Yanına yazılan tuzak (ux, 21 Eylül):**
  `modules/notifications/settings.ts:10-17` ayar nesnesinin tamamı
  `settings.whatsapp.*` ad alanında, oysa varsayılan kanal SMS (`:21`) —
  yani `whatsapp.enabled` bugün **SMS gönderimini** açıp kapatıyor.
  Kullanıcıya görünmüyor, o yüzden iş açılmadı; ama 34'e dokunan kişi tam
  bu alanların içinde olacak ve R3 bu ad alanını zaten taşıyacak.
- **"Geri dönmeyen hayvanlar" ekranı.** Bağ bu sürümde kuruluyor, ekran sonra.
- **Haftalık doluluk görünümü.** Gün görünümü varsayılan kalıyor; haftalık
  görünümün gerçekten sorulup sorulmadığını bilmiyoruz — kullanıcıya soruldu.
- **42b — randevu döngüsünün kapanması (ertelendi, reddedilmedi).**
  Kullanıcı kararı 21 Eylül: gerekçe kabul edildi, yalnızca "Güvenilir
  döngü" R4a ile birlikte yeterince yüklü. **Erteleme kararı kanıtı çöpe
  atmak değil**, o yüzden gerekçe ve ölçü burada duruyor:
  - **(i) Girdi — "Vizit başlat".** `Visit.appointmentId String? @unique`
    (`prisma/schema.prisma:318-319`) şemada **var**, randevu↔vizit birebir
    bağı tasarlanmış, ama **hiçbir yer onu yazmıyor** (`modules/visits/`,
    `visit-form.tsx`, `visits/new/page.tsx` → sıfır sonuç). Randevu
    detayında "Vizit başlat" → `/visits/new?appointmentId=…`; form hayvan,
    müşteri, veteriner ve türü önceden doldurur. Desen mevcut:
    `/visits/new?petId=…` (`pets/[id]/page.tsx:115`).
    **Ölçü, tabanı elimizde: `appointmentId` dolu vizit oranı = 0.**
    **İkinci gerekçe:** açık kullanıcı sorusu *"gün içinde aynı bilgiyi iki
    kez yazdığınız yer neresi?"* — randevuyu yazıp viziti sıfırdan
    doldurmak **birinci aday.**
  - **(ii) Türetme** — (i) inince neredeyse bedava: bağlı viziti olan
    randevu `COMPLETED` olur, nedeni "geldi". R4a-2'deki aşı kalıbının aynısı.
  - **(iii) Elle kapanış** — **R4a-3 ile aynı bileşen** (sabah gün planında
    şerit: Geldi · Gelmedi · İptal oldu). O zaman gelirse ek maliyeti yok;
    ama **R4a-3 zaten kesme çizgisinin altında**, yani ikisi birlikte
    bekliyor.
  - **Kalıcı karar, ertelemeden etkilenmez: "Gelmedi" asla otomatik
    yazılmaz.** Randevu saati geçtiğinde hayvanın gelip gelmediğini klinik
    bilmiyorsa uygulama da bilmiyor; **uydurulmuş bir değerle, ölçmek
    istediğimiz sayıyı (gelmeme oranı) ölçemeyiz.** TEAM.md 14'ün randevu
    tarafındaki karşılığı.
- **Fatura/tahsilat işleri**, **gün sonu kasa**, **randevu çakışma uyarısı**,
  **acil vaka akışı**, **KDV oranı ayarı**, **`Visit.followupAt` döngüsü**
  (R4a'nın kardeşi — aynı kalıp, aynı tedavi).
- **İptal/erteleme mesaj şablonları.** Metinler hazır ve rafta; WhatsApp'a
  yeni yatırım yapılmıyor.

## "Bitti" tanımı

Çoğu işte pm'in kabul testi yeterlidir. Üç işte yetmez:

1. **R1 (12)** — commit yetmez: `message_logs` tablosunda **gerçek bir
   gönderim kaydı** görünmeli.
   **Eşik sıkılaştırıldı (value, 21 Eylül — ux'in `logManual` notu bunu
   açığa çıkardı):** "bir satır var" yetmez, satırın **`status = SENT`**
   olması gerekir. `MessageStatus` üç değer taşıyor: `SENT`, `FAILED`,
   `MANUAL` (`prisma/schema.prisma:693-697`). 37 ile birlikte kopyalama da
   `logManual` çağıracak, yani `message_logs` **elle gönderimlerle
   dolacak** — eşiği "satır sayısı > 0" bırakırsak, cron hiç çalışmasa bile
   personelin elle kopyaladığı mesajlar R1'i geçirir. Bu tam olarak
   "çalışıyor gibi görünüyor ama çalışmıyor" (TEAM.md 2), üstelik kendi
   kabul ölçütümüzün içinde.
2. **R4a (20, 21)** — hatırlatmanın doğması yetmez: müşteriye ulaşmalı ve
   hayvan geldiğinde kapanmalı; kapanış nedeni okunabilmeli.
3. **Rıza işi (14)** — form değişikliği yetmez: alan adının geçtiği hiçbir
   filtre yarım kalmamalı, yarım kalırsa otomatik gönderim sessizce durur.

## Ölçüm noktaları

Yöntem: `node --env-file=.env scripts/loop-metrics.mjs` (salt okuma).
Taban (20 Eylül 2026, sürüm öncesi):

| Ölçü | Bugün | Hedef |
|---|---|---|
| Otomatik gönderilmiş mesaj (`message_logs`, `status = SENT`) | 0 | > 0 (R1 + kanal) |
| Elle gönderim (`status = MANUAL`) | 0 | ayrı sayılır, R1'i geçirmez |
| Son 90 günde tekrar tarihi dolu aşı | %20 (1/5) | belirgin artış (R4a-1) |
| — bunun **çip görünmeden** doldurulan kısmı | — | 20'nin gün bir çalışan mekanizması (yerleşim + sonuç satırı) |
| — **çipe dokunma oranı** | — | öneri kalitesini doğrudan söyler: çip çıkıyor ama kimse dokunmuyorsa öneri yanlış |
| Takip tarihi dolu vizit | 0/5 | ölçülebilir hale gelmesi |
| Tarihi geçmiş randevuların durumu | hepsi `SCHEDULED` | kapatılan randevu oranı > 0 |
| Hatırlatma kapanış nedeni dağılımı | alan yok | `ATTENDED` / `RESOLVED_BY_PHONE` / `NOT_NEEDED` / `SUBJECT_CLOSED` dağılımı |
| **Dönüş oranının paydası** | — | `SUBJECT_CLOSED` satırları **paydadan çıkar** — ne başarı ne başarısızlık. Ana oturumun formülasyonuyla: **ölçüyü personelin disiplinine bağlamamak kadar (TEAM.md 15), ölçüyü cevaplanamaz bir soruya bağlamamak da gerekir** — ölen hayvan "geri geldi mi" sorusuna cevap veremez |
| `appointmentId` dolu vizit oranı | **0** | 42b(i) sonrası çoğunluk |
| Türetilmiş vs elle kapanış | alan yok | `closedById` null oranı |
| `dueAt` → `closedAt` süresi | alan yok | kısalması; uzunsa döngü çalışmıyor, defter tutuyoruz |

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

**Yetki kuralı değişti (21 Eylül 2026, kullanıcı kararı).** Şema
değişikliği, kolon ve enum **artık onay kapısı değil** — uygulama canlıda
değil, kaybedilecek üretim verisi yok; dev doğrudan migration üretip
uygulayabilir. Bekleyen iki migration (SMS enum + `notificationsOptIn`)
uygulandı, pm'in blokeri kalktı.

**Onay kapısı olarak duran tek şey: geri alınamaz VERİ işlemi.** Ölçüt
kullanıcı tarafından net çizildi (21 Eylül): **işlem bir bilgiyi yok ediyor
mu?** Var olan bir değerin üstüne yazmak ya da satır silmek onaya gider;
**boş bir kolona değer yazmak gitmez** — hiçbir şeyin üstüne yazmıyor ve
geri alma yolu kolonu düşürmek, yani kayıp yok. Eski ödemelerin ×100
düzeltilmesi ilk sınıftaydı ve reddedildi. Yeni özellik de kullanıcıya
sorulmaya devam ediyor.

**Sıralamaya etkisi (value):** "şema gerektiriyor" gerekçesiyle geride
duran hiçbir iş artık o sebeple beklemiyor. Bu **14b**'yi (rızanın ne zaman
ve hangi yolla alındığı, eklemeli kolon) ve **29b**'nin şema tarafını
serbest bırakıyor. Kısıt kalktı, sıra değişmedi: ikisi de sürümün vaadini
taşımıyor, Katman 0'ın önüne geçmiyorlar. **Değişmeyen tek karar:** 100 kat
küçük kaydedilmiş eski ödemelere dokunulmuyor — o bir veri işlemi ve
kullanıcı zaten "hayır" dedi.

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
**Bu turda cevaplananlar (21 Eylül 2026, bağlayıcı):**
- *100 kat küçük kaydedilmiş eski ödemeler düzeltilsin mi?* → **Hayır,
  dokunulmuyor.** Sonucu A0-money bölümünde yazılı; hata olarak açılmayacak.
- *Para birimi varsayılanı taşınsın mı, mevcut klinikler dönüştürülsün mü?* →
  **Varsayılan TRY olacak, mevcut klinikler dönüştürülmeyecek.** 29a'nın
  kapsamı buna göre yazıldı.

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

**Ölçüm geldi (pm, 21 Eylül 2026).** Üretim derlemesi (`next build` +
`next start -p 3100`, ayrı kopya, dev sunucusuna dokunulmadı), tek geçiş,
soğuk istemci, **boş klinik**. Wall süreleri: `/clients` 182 · `/clients/new`
227 · `/pets/new` 227 · `/settings` 299 · `/reminders` 304 · `/visits` 358 ·
`/prescriptions` 361 · `/appointments` 399 · `/` 410 · `/pets` 410 ·
`/invoices` 428 · `/api/health` 406. En yavaş rota 428 ms, yani bugünkü
6000 ms tavanının **on dört katı altında** — tavan hiçbir şey yakalamıyor.

**Karar — eşikleri ikiye ayırıyorum, çünkü ölçüm boş klinikten (value).**
pm'in uyarısı haklı ve tek başına sıralamayı belirledi: bu sayılarda hiçbir
listede satır yok. "Gözlenen değerin biraz üstü" kuralını boş klinikten
uygularsam **ilk gerçek klinikte hepsi kırmızıya düşer** ve ekip eşiği
gevşetmeyi öğrenir — bir kez gevşetilen eşik bir daha ciddiye alınmaz.

1. **Veri hacminden bağımsız rotalar: şimdi sıkılıyor.** `/clients/new` ve
   `/pets/new` boş form; içerikleri klinik büyüdükçe değişmiyor. Eşik
   **500 ms** (gözlenenin ~2 katı). `/api/health` **800 ms**.
2. **Veri hacmine bağlı rotalar: ara eşik 2000 ms.** `/`, `/clients`,
   `/pets`, `/visits`, `/appointments`, `/prescriptions`, `/reminders`,
   `/invoices`, `/settings`. 6000'den 2000'e inmek bugün **bedava** (en
   yavaşı 428 ms) ve kaba regresyonu yakalar; gerçek sayı dolu klinik
   ölçümünden sonra konur. pm o ölçümü PMTEST verisiyle alıp gönderecek.
3. **Nihai eşikler dolu klinik ölçümünden türetilir**, sonra her sürümde
   kademeli indirilir — hedef 1 saniye altı.
4. Kademeli indirme bir iş değil, sürüm ritüeli: her sürüm sonunda eşikler
   yeni gözlenen değerlere göre sıkılır. Bir kez sıkılan eşik gevşetilmez;
   gevşetme gerekiyorsa sebebi yazılır.

**Bu eşikler 35 inmeden anlam taşımaz.** Bugünkü test süreyi ölçüyor ama ne
yüklendiğine bakmıyor; ölçüm koşusunda `/clients` hata sayfasıydı ve test
geçti. Sayıyı sıkmadan önce ölçtüğümüz şeyin doğru sayfa olduğunu bilmemiz
gerekiyor — o yüzden 35 Katman 0'da ve eşik değişikliğinden önce iner.

**Açık soru, iddia değil:** `/api/health` 406 ms. Bir sağlık ucu için yüksek
görünüyor ama ayrı bir testten geliyor ve ölçüm koşulunu bilmiyorum; pm dolu
klinik turunda bunu ayrıca baksın. Bulgu olarak açmıyorum.

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
  **⚠ KAPSAMI YAZILI DEĞİL (value, 21 Eylül — 30c'nin uygulaması).** Bu
  cümle neyin bakıldığını söylemiyor: veri modeli mi, formların akışı mı,
  boş/hata hâlleri mi, dar ekran mı? `/audit` vakası aynı sınıftandı ve
  orada gerçek bir açık çıktı. **Bu satıra "temiz" diye dayanılmayacak**
  ve ux'in envanter sırasında ikinci alanı burası olacak (ilki 30).
- **Klinik izolasyonu ve yetkilendirme temiz — AMA KAPSAMI DAR, bu satıra
  fazla güvenilmesin (value, 21 Eylül düzeltmesi).** Bu tarama
  `modules/` altındaki **servis çağrılarını** kapsadı. Sayfa seviyesindeki
  okumaları kapsamadı ve ux orada gerçek bir açık buldu (43: `/audit`).
  `listAuditEntries` hiç `requirePermission` çağırmadığı için servis
  taramasında görünmesi mümkün değildi — **tarama yanlış değildi, dar
  kapsamlıydı.** "Bir sonraki oturumda yeniden taranmasın" notu **yalnızca
  servis katmanı için** geçerlidir.
- **(Aşağısı o taramanın orijinal metni.) Klinik izolasyonu ve
  yetkilendirme temiz (pm, iki tam tur, yeni hata yok).** 18 sorgu ve 15 servis dosyası tarandı, kapsam dışı kalan yok. En
  riskli işlemlerde bile desen doğru: kaydın çağıranın kliniğine ait olduğu
  önce doğrulanıyor, değilse **"bulunamadı"** atılıyor — "yetkiniz yok"
  değil, yani kaydın varlığı sızdırılmıyor. `requirePermission` çağırmayan
  tek fonksiyon `createClinicWithOwner` ve o da doğru: kayıt anında henüz
  oturum yok. **Bir sonraki oturumda bu alan yeniden taranmasın.**
- **Performans ölçüm düzeni doğru kurulmuş.** `e2e/performance.spec.ts`
  üretim derlemesine karşı, 11 kilit rotada, CI'da her push ve her PR'da
  çalışıyor; regresyon canlıya çıkmadan build'i düşürüyor. Düzeltilecek olan
  düzen değil, yalnızca eşik değeri (bkz. "Performans bütçesi").

### Bu oturumda kapanan ve backlog'dan silinen işler

Satır olarak silindiler; burada yalnızca kaydı duruyor.

- **Tıbbi kaydın sessizce kaydedilmemesi** — `lib/forms.ts` tek noktadan
  düzeltildi; aşı, tedavi, tanı, reçete ve not artık kaydediliyor.
- **Saat dilimi** — girdi, saklama, ekran ve mesaj aynı saati söylüyor;
  klinik ayarı New York yapılıp sunucu İstanbul'dayken doğrulandı.
- **Rıza** — alan `notificationsOptIn` adına geçti, varsayılan kapalı,
  mevcut kayıtlar migration ile kapatıldı (geri alma verisi
  `_whatsapp_opt_in_backup` tablosunda), form metni rıza beyanı gibi okunuyor.
- **SMS kanalı (eski S1-S4)** — `lib/messaging/sms/` (Netgsm + log adaptörü),
  segment hesabı, SMS şablonları, `MessageChannel.SMS` ve sweep'in kanal
  seçimi. Uzaktaki paralel çalışmada inmiş, `6b8c2be` ile birleştirildi.
- **Gün planı** — `/appointments` bugüne açılıyor, gün okları, `?date=`
  URL'de, "Tüm tarihler" ikincil görünüm.
- **Form veri kaybı ve çeviri** — hata durumunda yazılan veri korunuyor,
  sunucu doğrulama mesajları çevriliyor.
- **Tema tokenları** — üç tema bloğunda parite testle sabitlendi;
  `--warning` ve `--destructive` WCAG AA'ya çekildi, yüzey × tema başına
  ölçüldü ve bilinen-bozuk değerin **kaldığını** iddia eden negatif test kondu.
