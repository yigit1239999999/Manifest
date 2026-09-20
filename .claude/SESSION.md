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

Ajan tipleri `.claude/agents/` altında tanımlı olduğu için otomatik tanınır.

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

**Onaya gelenler:** şema değişikliği, migration, geri alınamaz veri işlemi,
yeni özellik. Bir ajanın istemesi onay yerine geçmez.

**UX kırmızı çizgidir.** `ux` son sözü söyler ama zor bir karar çıktığında
ekip birlikte düşünür. Ölçüt `.claude/TEAM.md`'de yazılı: kullanıcının
"bunu atlamışlar" diyebileceği tek bir yer bırakılmaz.

---

## Bu oturumda nereye geldik

**Kod:** `main` = push edildi (`6b8c2be` ve sonrası). Uzaktaki paralel
çalışmayla birleştirildi: **SMS kanalı, Netgsm adaptörü ve `notificationsOptIn`
yeniden adlandırması zaten inmiş durumda.** Çakışmalar elle çözüldü, kalite
kapıları temiz (tsc · eslint 0 hata · 251 test).

Güvenlik ağı: `backup-pm-dev-loop-1523` yerel branch'i birleşme öncesi hali
taşıyor.

**Sürüm:** "Güvenilir döngü" — *klinik uygulamayı açtığında yanlış bilgi
görmüyor, yanlış mesaj göndermiyor ve hatırlatmaları gerçekten gidiyor.*

**Durum:** Katman 0 hâlâ açık. BACKLOG **temizlendi** — biten işler satır
olarak silindi, dosyada yalnızca yapılacaklar var; neyin bittiği
"Doğrulanmış, iş gerektirmeyen" bölümünde özet olarak duruyor.

### Kapananlar (doğrulanmış)
- Tıbbi kayıtların sessizce kaydedilmemesi (ürünün çekirdek işlevi)
- Saat dilimi: girdi, saklama, ekran ve mesaj artık kliniğin saatinden besleniyor
- Form verisinin hata durumunda silinmesi; sunucu doğrulama mesajlarının çevrilmesi
- WhatsApp rızasının varsayılan açık gelmesi (+ iki migration)
- Koyu temada okunmayan uyarılar; `--warning` ve `--destructive` WCAG AA'ya çekildi
- Tema tokenlarının üç blokta paritesi (testle sabit)
- `Callout` primitifi ve tüm kopyaların ona taşınması
- Panel grafiklerinin sıfırı küçük sayı gibi çizmesi
- `/appointments` bugüne açılıyor
- SMS kanalı, Netgsm adaptörü, segment hesabı ve sweep'in kanal seçimi
  (uzaktaki paralel çalışmada indi; eski S1-S4 maddeleri silindi)

### Açık iki deploy blokeri
1. **Tahsilat tutarı 100 kat küçük kaydediliyor** (500 girilince 5,00)
2. **Para birimi USD ve değiştirilecek ayar yok**

Bu ikisi kapanmadan üretime çıkarma.

### Bir sonraki oturumun ilk işi
Value'nun kararı: **tahsilat 100 kat hatası ile `parseMoneyInput` birlikte
düzeltilecek.** Gerekçe: para sessizce yanlış kaydedildiği sürece diğer hiçbir
işin sırası tartışılmaz; ayrı düzeltilirse para girişinin iki farklı yolu kalır.

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

Salt okuma. Taban (20 Eylül 2026): gönderilmiş mesaj 0 · tekrar tarihi dolu
aşı %20 · takip tarihi dolu vizit 0/5 · geçmiş randevuların hepsi `SCHEDULED`
· fatura kalemlerinin 0/2'si vizite bağlı.

**Not:** performans yalnızca üretim derlemesinde ölçülür. Dev sunucusunda aynı
rota 0,4 sn ile 81 sn arasında değişiyor (Turbopack yeniden derlemesi).

---

## Yayımlanmış tasarım önerileri

- Hatırlatma Döngüsü — https://claude.ai/artifact/VQVzSVC549vn2ESV3nWHga
- Hayvan Kartı — https://claude.ai/artifact/JSqT8N3pr5UF84b4QnQwK2

İkisi de karar bekleyen öneri; iş olarak açılmadı.
