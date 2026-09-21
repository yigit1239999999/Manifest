# Ekranda doğrulanması gereken işler — v0.1.0 kabul kuyruğu

Ana oturum derledi (21 Eylül 2026), **öncelik sırasını `value` verir**,
**kabul testini `pm` yapar** (tarayıcı yalnızca onda).

Kapsam: `a3987bb..HEAD`, 40 commit. Aşağıdaki liste **yalnızca ekranda
görülerek doğrulanabilecek** olanları içerir; tipten ve testten geçtiği için
ekran gerektirmeyenler en altta ayrı duruyor.

## KOŞMA SIRASI (value verdi — dosyadaki numara sırası DEĞİL)

**§7 → §8 → §1 → §2 → §3 → §4 → §5 → §6 → §9**

- **§7 birinci, çünkü kabul değil BLOKER.** dev-ui'nin kuyruğundaki tek iş
  (B-1) o ölçüme bakıyor, yani **B hattının tamamı** orada duruyor.
  Dakikalar sürer.
- **§8 ikinci, çünkü tarayıcı bile gerekmiyor.**
- **§9 (390px turu) en son ama ATLANMAYACAK.**

§1-§6 içindeki kuyruk sırası:
`A0-money + 29a+32 birlikte → 34+37 → 39 → 43 → kalanlar`

---

## 1. Para — A0-money + 29a+32 (**birlikte**, aynı ekranlar)

`0a34b01` · `6d13ace` · `90e6005` · `c61d058` · `cd407e9` · `a6898fc`

| Ne doğrulanacak | Nerede |
|---|---|
| Girilen tahsilat tutarı **aynı** kaydediliyor (100 kat küçük değil) | Fatura → tahsilat |
| Ondalık ayracı TR/EN girdide doğru okunuyor | Tahsilat ve fatura kalemi |
| Panelde ve listede **kalan borç** görünüyor, faturalanan değil | Panel + fatura listesi |
| Klinik para birimi ayardan **değiştirilebiliyor**, varsayılan TRY | Ayarlar → Klinik kartı |
| Fatura **kesildiği** para biriminde görünüyor, güncel ayarda değil | Eski bir fatura |
| Para birimi ondalık sayısını kendi belirliyor | TRY / JPY karşılaştırması |
| Rakamlar alt alta hizalı (`tabular-nums`) | Fatura, panel, liste |

**Bilinen ve kabul edilmiş:** `INV-2026-57336` 100 kat küçük kaydedilmiş tek
kayıt; geçmiş ödemelere dokunulmadı, o faturada panel ve alacak tutarsız.
**pm tanınabilir tutar kullanacak** (111,11 gibi) — ölçüm tabanı kirlenmesin.

## 2. Bildirim — 34 + 37 (+8b)

`b0b0b24` · `e8968c4` · `fa70a35` · `046d6a2` · `2ddf87e`

| Ne doğrulanacak | Nerede |
|---|---|
| Kanal seçimi **kaydediliyor** ve sayfa dönüşünde duruyor | Ayarlar → Bildirim |
| Elle gönderim kaçışı **seçilen kanalı** izliyor (SMS klinikte WhatsApp metni yok) | Randevu detayı |
| "Mesajı kopyala" her kanalda var; derin bağlantı yalnızca o kanal seçiliyken | Randevu detayı |
| İptal/tamamlanmış randevuda gönderim kartı **çıkmıyor** | İptal edilmiş randevu |
| Başarısız gönderim yeniden denenebiliyor, üç saatte üçten fazla değil | Bildirim geçmişi |
| Telefon doğrulaması geçersiz numarayı **reddediyor** | Müşteri formu |

**Açık bulgu, pm'in cevaplaması gereken:** `country` **129 kliniğin
hepsinde NULL** — telefon düzeltmesi (6) pratikte devreye giriyor mu? Hayırsa
(6) yeniden açılır.

## 3. Arşiv — 39 + 7

`ea7ff56` · `1c22904`

| Ne doğrulanacak | Nerede |
|---|---|
| Arşivlenen müşteri/hayvan/vizit **geri alınabiliyor** | Üç liste |
| Arşiv rozeti tek sinyal; satır **soluklaştırılmamış** | Filtre açıkken liste |
| **Arşiv rozeti koyu temada ve 390px'te okunuyor** (ux'in eklediği kontrol) | `clients` listesi — o satır zaten iki rozet taşıyor, en uzun TR etiketiyle sarabilir |
| Ölen hayvanın sahibine mesaj **gitmiyor** | Vefat etmiş hayvan |
| Yetkisiz rolde arşiv/geri alma düğmesi **görünmüyor** | RECEPTIONIST ile |

## 4. Yetki — 43

`fa3d5f1`

| Ne doğrulanacak | Nerede |
|---|---|
| `RECEPTIONIST` ve `VET_TECH` `/audit`'te **yetkisiz hâlini** görüyor | `/audit`, iki rolle |
| `ADMIN` ve `VETERINARIAN` normal görüyor | `/audit` |
| **Bilinen eksik (43b):** kenar çubuğundaki bağlantı hâlâ görünüyor | Kenar çubuğu |

## 5. Panel ve durum ekranları — 11 + 41 + 18/19/19a/19b

`692b152` · `7f8aec0` · `e367ba3` · `26a887f` · `e5ba831` · `2949afb` ·
`8207e7c` · `a0d9da8` · `2185dfa` · `a9550ea` · `b2481f4` · `2d91080`

| Ne doğrulanacak | Nerede |
|---|---|
| Boş gelir grafiği **başlıklı boş kutu değil**, ne olduğunu söylüyor | Yeni klinik / paneli |
| Tür grafiğinin boş metni **"Henüz hayvan yok"** ("vizit" değil) | Panel |
| Kısmi dönem sütunu soluk + kesik + alt yazı, **ve `aria-label` özetinde** | Panel |
| Panel kartı ile götürdüğü liste **aynı sayıyı** veriyor | Panel → liste |
| Filtrelenip boşalan liste "boş klinik" demiyor | Herhangi bir liste + filtre |
| Her rotada 404 ve yükleme hâli var; ölü bağlantı kendi listesine dönüyor | Uydurma bir URL |
| Yetkisiz hâl **açıklamalı** (sessiz panele düşme yok) | `/staff`, RECEPTIONIST |
| Rozet tonları: `PAID` ile `DRAFT` **birbirine benzemiyor** | Fatura listesi |
| Tablo 390px'te **kolon kesmiyor**; her eylem ekranda | Telefon genişliği |

## 6. Form ve girdi

`0a790aa` · `5404cb2` · `3eb6be6` · `8ac7190` · `f23e002`

| Ne doğrulanacak | Nerede |
|---|---|
| Onay dialogu tarayıcının `confirm`'ü değil, uygulamanın sesi | Silme düğmeleri |
| Personel durum düğmesi son yöneticiyi pasifleştirmiyor, **gerekçesini söylüyor** | Personel |
| Yalnızca gün istenen alanlar **saat sormuyor** | Aşı tekrar, hatırlatma |
| Detay sayfaları etiket/değer çiftleri olarak okunuyor, boş değer `-` | Dört detay sayfası |

## 7. **Bloke: dev-ui bunu bekliyor**

**`shadow-sm` önce/sonra ölçümü.** ux kenarlıklı yüzeylerden gölgenin
kalkmasına tek şart koydu: **açık temada panel + `/pets` önce/sonra
görüntüsü.** Kartlar düzleşirse çözüm gölgeyi geri koymak değil,
`--border`'ı koyulaştırmak — o da ölçülür. **B-1 bu ayakta duruyor.**

## 8. Ekran gerektirmeyen cevaplar (pm'den, ölçüm/veri)

1. ~~**Aşı tabanı: %10 mu %20 mi?**~~ **DÜŞTÜ — value çözdü, cevap
   beklenmiyor.** Ölçü kesim tarihli olarak yeniden tanımlandı; kesim öncesi
   küme donduruldu (%18, 2/11). Ayrıntı SESSION.md'nin ölçüm bölümünde.
2. **`country` 129 kliniğin hepsinde NULL — bu bir kabul değil, BULGU
   ADAYI.** Telefon düzeltmesi (6) pratikte hiç devreye girmiyor olabilir;
   girmiyorsa **(6) yeniden açılır.** §2'deki satırla aynı şey, ama kabul
   kuyruğunda değil burada yürüyor.
3. **`settings/page.tsx:50` sessiz `redirect("/")`** — bu duruma pratikte
   düşen hesap var mı? Yoksa iş açılmayacak.
4. **Rota başına gerçek süreler** — performans bütçesi için.
   **Yalnızca üretim derlemesinde ölçülür**, dev sunucusunda değil.

## 9. Kuyruk boşalınca: **390px turu**

ux'in tarayıcısı yok; **bugüne kadar hiçbir mobil düzen taranmadı.**
TEAM.md 24/32 mobili "işin kendisi" sayıyor, yani bu kapı şu an **hiç
kapatılmamış** ve tamamen pm'de.

---

## Ekran gerektirmeyenler (kayıt için)

Tip kontrolü ve testlerle kapanmış sayılır; pm'in açması gerekmez:
`a587c2c` (kural teste yazıldı) · `b02023d` (performans spec'i içerik
doğruluyor) · `7a5f739` (rıza alanı şemadan da kalktı, kabul kriteri
`service.test.ts:156,165`'te) · `046d6a2` (cron saatlik) · `3f5d524`,
`2e679ad`, `72f5afd`, `04aebc0`, `fd19e86` (token ve süpürme işleri).
