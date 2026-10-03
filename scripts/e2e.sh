#!/usr/bin/env bash
# Tek koşucu kilidi, e2e için.
#
# NEDEN: 23 Eylül 2026'da altı koşu çekişme yüzünden çöpe gitti. Altısında da
# herkes doğru davrandı -- "dokunmuyorum" dendi, "ağacı tut" dendi, ve iki kez
# lider sırayı yazdı. Yetmedi, çünkü MESAJ BİR KİLİT DEĞİLDİR: geç ulaşır, ve
# iki taraf da karşı tarafın SON mesajına göre davranır. Kilit dosyada durur,
# mesajda değil.
#
# Yeni bir fikir değil: `serve-prod.sh:40-45` bunu üretim zemini için zaten
# yapıyor (MEASURING). Bu, uygulanmamış olan e2e hâli.
#
# KİLİDİN KENDİ KUSURU BAYAT KALMASIDIR (dev). Koşu çökerse -- zaman aşımı,
# kapatılmış süreç, arka plana düşmüş iş -- dosya kalır ve kimse koşamaz.
# Sonra biri `--force` öğrenir ve kilit kâğıda döner. O yüzden kilit PID
# taşır ve açarken sahibinin YAŞADIĞI doğrulanır: süreç yoksa kilit bayattır
# ve script bunu SÖYLEYEREK devralır. Böylece `--force`, unutulmuş bir kilit
# için değil, yalnız GERÇEKTEN koşan birini ezmek için kalır -- ve o karar
# insanın olur.
#
# NE YAPAMAZ, yazılı olsun diye: PID yeniden kullanılmışsa (aynı numarayı
# başka bir süreç almışsa) canlı sanır ve gereksiz bekletir. Bugüne kadar
# görülmedi; görülürse kilide başlangıç zamanı karşılaştırması eklenir.
set -uo pipefail
# Kilidin adı ortam değişkeninden alınabiliyor, ve tek sebebi şu: bu kilidin
# DAVRANIŞI -- canlı sahibi tanımak, çıkışta yalnız KENDİ kilidini silmek --
# ancak betik koşturularak sınanır, ve `E2E_RUNNING`in kendisi üzerinde
# sınamak paylaşımlı ağaçta "biri koşuyor" işaretini yakıp söndürür; yani
# bekçiyi tam da koruduğu şeyin üstünde sınamak olur. `scripts/lock-test.sh`
# kendi dosyasını kullanır.
# KİLİDİ ATLATMAK İÇİN DEĞİL, ve bu iki yönlü doğru: başka bir ada yazan
# koşucu kimseyi korumaz ama korunmaz da -- gerçek koşu değişkeni vermez.
LOCK="${E2E_LOCK_FILE:-E2E_RUNNING}"
FORCE=""
[ "${1:-}" = "--force" ] && { FORCE=1; shift; }

# ALMAK ATOMİK OLMAK ZORUNDA (dev). Naif hâli -- önce `[ -f ]` ile bak, sonra
# yaz -- bir yarış: aynı saniyede başlayan iki koşucunun İKİSİ de "kilit yok"
# görür, ikisi de yazar, ikisi de koşar. Bugün altı kez neredeyse aynı saniyede
# başladık, yani bu yarış bizde teorik değil. Ve sonucu bugünkünden KÖTÜ
# olurdu: kilit varken iki koşu olursa kimse şüphelenmez.
#
# `set -C` (noclobber) ile `>` yönlendirmesi, dosya varsa yazmayı REDDEDER ve
# bu POSIX'te atomiktir.
# AD YOKSA İZ OLSUN (dev). `E2E_RUNNER` zorunlu DEĞİL, ve olmamalı: koşuyu
# engelleyen bir kilit `--force`u öğretir, ve öğrenilen `--force` kilidi kâğıda
# çevirir. Ama 23 Eylül 2026'da `who=bilinmiyor` gören biri koşanı bulmak için
# elinde HİÇBİR ŞEY olmadığını gördü ve sonunda lidere sordu -- yani adın
# eksikliğinin bedelini başkasının zamanı ödedi.
#
# `dev`in ayrımı: sorun "ad yok" değil, **İZ YOK**tu. Ad verilmediğinde kilit
# ölü bir kelime yerine çekilecek bir ip yazsın -- `ppid` ile ebeveyn süreci,
# onun komutu, ve `cwd`. Ad verildiğinde bu alanlar gereksiz ama zararsız.
acquire() {
  ( set -C
    printf 'who=%s pid=%s ppid=%s parent=%s cwd=%s at=%s head=%s suite=%s\n' \
      "${E2E_RUNNER:-bilinmiyor}" "$$" "$PPID" \
      "$(ps -p "$PPID" -o command= 2>/dev/null | tr -d '\n' | cut -c1-60)" \
      "$PWD" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      "$(git rev-parse --short HEAD)" "${RUN_SUITE:-tam-süit}" > "$LOCK"
  ) 2>/dev/null
}

# ALANI OKU, BİÇİMİ DEĞİL.
#
# Kilit satırı `ad=değer` alanlarından oluşuyor ve iki ayrı okuyucu ondan
# aynı sayıyı çıkarmak zorunda: bayat kilit kontrolü ve çıkış trap'i. Aynı
# ayrıştırma iki yerde elle yazıldığı sürece biri düzeltilip öteki
# düzeltilmiyor -- bugüne kadar iki kez tam bu oldu -- o yüzden tek yer.
#
# Satır boşluklardan ayrılır ve TAM OLARAK `pid=` alanı aranır. `ppid=` ayrı
# bir alandır ve eşleşmez; alanın satırın başında ya da ortasında olması fark
# etmez, yani `serve-prod.sh` gibi `pid=`i satır başına yazan bir yazıcı da
# doğru okunur. (BSD sed `\|` almıyor, o yüzden alternation değil alan
# ayrıştırma.)
#
# NE YAPAMAZ: dosya yoksa ya da içinde `pid=` alanı yoksa BOŞ döner, ve iki
# okuyucunun ikisi de boşu "sahibi bilinmiyor" diye ele alır -- bayat kilit
# kontrolü devralır, trap hiçbir şey silmez. Sessiz kalmıyor: devralma kendi
# satırını basıyor.
lock_pid() {
  tr ' ' '\n' < "$LOCK" 2>/dev/null | sed -n 's/^pid=\([0-9]*\)$/\1/p'
}

# VE ÜÇÜNCÜ BOŞLUK: HİÇBİR İŞARET "BU PORTTA BİRİ VAR" DEMİYOR (dev).
#
# Üç işaretimiz var ve üçü üç ayrı şeyi tutuyor:
#
#     E2E_RUNNING   koşucu yuvasını tutar   -- ağacı, PORTU tutmaz
#     BUILDING      derlemeyi tutar         -- koşuyu tutmaz
#     MEASURING     TAZELEMEYİ tutar        -- KOŞUYU tutmaz
#
# 23 Eylül 2026: `pm` 3005'te ekran ölçerken `dev`'in kapı koşusu aynı porta
# 45 test atacaktı -- her spec klinik açıyor, form dolduruyor, sunucuyu
# yüklüyor. `MEASURING` onları teknik olarak durdurmuyordu; **kendi
# kararlarıyla** durdular. Bu sefer kimse bir şey kaybetmedi, ama bugün ısıran
# şeyin tam da bu olduğunu dört kez gördük: kural doğruydu ve hatırlamak
# yetmedi.
#
# Ölçmek okumaktır, koşmak YAZMAKTIR. Aynı portta ikisi olduğunda ölçen
# kişinin gördüğü ekran, koşanın ürettiği veriyle ve yükle karışır -- ve
# karıştığı görünmez.
#
# BAŞKA PORTA KOŞMAK SERBEST (dev'in şartı): kilit porta bakar, koşuya değil.
#
# `MEASURING` VAR AMA PORTU OKUNAMIYORSA da duruyoruz, ve bu bilinçli bir
# tercih: "bilinmeyeni tamam saymak" bu betiğin var oluş sebebinin tersi.
# Bedeli bir satır (`MEASURING`'e portu yaz) ya da bir `--force`; karşılığı,
# formatın kendini düzeltmeye itilmesi.
if [ -f MEASURING ] && [ -z "$FORCE" ]; then
  M_TEXT="$(cat MEASURING 2>/dev/null)"
  M_PORT="$(printf '%s' "$M_TEXT" | sed -n 's/.*[^0-9]\([0-9][0-9][0-9][0-9]\)[^0-9].*/\1/p' | head -1)"
  WANT_PORT="$(printf '%s' "${E2E_BASE_URL:-http://localhost:3000}" | sed -n 's/.*:\([0-9][0-9]*\).*/\1/p')"
  if [ -z "$M_PORT" ]; then
    echo "DURDUM: biri ölçüyor ama HANGİ PORTTA olduğu yazmıyor." >&2
    echo "  MEASURING: $M_TEXT" >&2
    echo "  Ölçen kişi portu yazsın, ya da: $0 --force ..." >&2
    echo "  (Bilinmeyeni 'tamam' saymıyoruz -- bu betik tam bunun için var.)" >&2
    exit 6
  fi
  if [ "$M_PORT" = "$WANT_PORT" ]; then
    echo "DURDUM: $WANT_PORT portunda biri ÖLÇÜYOR -- $M_TEXT" >&2
    echo "  Koşarsan onun gördüğü ekran senin testlerinin verisiyle karışır." >&2
    echo "  Bitmesini bekle, ya da başka porta koş (E2E_BASE_URL), ya da: $0 --force ..." >&2
    exit 6
  fi
fi

# SIRA: bu kontrol KİLİTTEN ÖNCE koşar. Sonraya koymak çalışıyordu ama
# kirliydi -- ret kararı verilmeden önce kilit alınıyor, hatta bayat bir
# kilit DEVRALINIYOR, sonra reddediliyordu. Bir koşucu yuvasını almayacaksan
# ona hiç dokunma: devralma kaydı, gerçekleşmemiş bir koşuya ait olur ve
# sonraki okuyan onu bir koşu sanır.

RUN_SUITE="${*:-tam-süit}"
if ! acquire; then
  OWNER_PID=$(lock_pid)
  # `kill -0`: süreç yaşıyor mu. İki sınırı var ve ikisi de bilerek çözülmedi:
  #   - PID yeniden kullanılmışsa canlı sanır ve gereksiz bekletir. Bugüne
  #     kadar görülmedi; görülmeden çözüm eklemek, bu ekibin reddettiği şey.
  #   - BAŞKA BİR KULLANICININ süreci için izin hatası verip "canlı" okunur.
  #     Tek makinede tek kullanıcıyla çalıştığımız sürece sorun değil (dev).
  if [ -n "$OWNER_PID" ] && kill -0 "$OWNER_PID" 2>/dev/null && [ -z "$FORCE" ]; then
    echo "DURDUM: koşu sürüyor -- $(cat "$LOCK" 2>/dev/null)" >&2
    echo "  bitmesini bekle. Gerçekten ezmek istiyorsan: $0 --force ..." >&2
    exit 1
  fi
  if [ -n "$FORCE" ]; then
    echo "UYARI: kilit --force ile eziliyor -- $(cat "$LOCK" 2>/dev/null)" >&2
  else
    echo "BAYAT KİLİT devralınıyor: $(cat "$LOCK" 2>/dev/null)" >&2
    echo "  (pid ${OWNER_PID:-yok} çalışmıyor -- koşu çökmüş ya da kapatılmış.)" >&2
  fi
  rm -f "$LOCK"
  # Silme ile alma arasına başkası girerse bu deneme de REDDEDİLİR -- yarış
  # orada da kapanıyor, ve ikinci kez denemiyoruz: iki bayat devralma üst üste
  # gelirse durmak, ikisinin birden koşmasından iyidir.
  if ! acquire; then
    echo "DURDUM: kilidi devralırken başkası aldı -- $(cat "$LOCK" 2>/dev/null)" >&2
    exit 1
  fi
fi

# Yalnız KENDİ kilidimizi sileriz: biri --force ile üzerimize yazdıysa, bizim
# çıkışımız ONUN kilidini silmemeli -- yoksa kilit, çözdüğü problemi geri
# getirir (lider).
#
# Ayrıştırma `lock_pid()`te, ve trap'in tek satırlık olmasının sebebi orada
# yazılı olandan fazlası: trap gövdesi tek tırnak içinde duruyor, yani içine
# konan her tırnak gövdeyi çalışma anında bölüyor -- ve bölündüğünde `bash -n`
# HATA VERMEZ, çünkü tek tırnaklı dize sözdizimsel olarak geçerli bir dizedir.
# Bu depoda tam bu oldu: gövdeye `tr ' ' '\n'` yazıldı, sözdizimi kapısı temiz
# geçti, ve trap çalışma anında `trap: invalid signal specification` verip
# kilidi HİÇ silmedi. Kilit bayat sanıldı; bayat değildi, TEMİZLENMEMİŞTİ.
# Gövde bir fonksiyon çağrısı olduğu sürece bu tuzak kapalı kalıyor.
#
# Bu üç davranışın sınavı `scripts/lock-test.sh` -- sözdizimi kapısı değil,
# koşturarak.
trap '[ "$(lock_pid)" = "$$" ] && rm -f "$LOCK"' EXIT

# Artefaktın sahibi belli olsun: paylaşımlı `test-results/` yüzünden iki süit
# aynı dizine yazıp son yazan kazanıyordu, ve bugün dört hata bağlamının
# hangi koşuya ait olduğu söylenemedi (dev). Sahibi belirsiz kanıt, kanıt değil.
rm -rf test-results

# ZEMİN İKİ UÇTA ÖLÇÜLÜR VE KARŞILAŞTIRILIR -- yazdırmak yetmiyordu.
#
# Kilit KOŞUCUYU korur, AĞACI korumaz (dev-ui, ve `#32`nin kendisi). Bugün
# tam da bu oldu: lider, başkası koşarken commit'ledi ve bir paket kurdu.
# Koşan taraf durdu, ama SEBEBİ tesadüftü -- birim sayısının 1178'den 1190'a
# çıktığını gördü. Fark sayıya yansımasaydı (yalnız `package-lock` oynasaydı,
# ya da değişen dosya süitin çizmediği bir yerde olsaydı) koşu tamamlanır ve
# **yeşil doğru sanılırdı.** Yani insanın fark etmesine bırakılmış bir kontrol
# vardı, ve o kontrol yalnız gürültü yeterince büyük olduğunda çalışıyordu.
#
# Betik iki ucu zaten yazdırıyordu. Yazdırmak, karşılaştırmak değildir: iki
# çıktı ekranda yan yana durur ve kimse bakmaz. Buradan sonrası KARŞILAŞTIRMA,
# ve sonucu koşunun çıkış koduna bağlı.
# ZEMİN BİR DOSYA DEĞİL, BİR SÜREÇ OLABİLİR (dev, 23 Eylül 2026).
#
# `npm install next@16.3.6` diskteki çatıyı değiştirdi. **Koşmakta olan
# `next dev` süreci kendi sürümünü belleğinde taşımaya devam etti:**
#
#     ps   -> next-server (v16.2.6)      <- 3000'de dinleyen süreç
#     disk -> node_modules/next 16.3.6   <- az önce kuruldu
#
# Süit yeni koda bakan bir sunucuya değil, **eski çatıyı taşıyan bir sürece**
# istek atıyordu. Yeşil gelseydi 16.2.6'nın yeşili olurdu, ve raporda
# "16.3.6 ile e2e 45/45" yazacaktı.
#
# Bu, bugün üçüncü kez çıkan sınıfın yeni üyesi: HEAD tutuluyor, izlenen
# dosyalar tutuluyor, damga tutuluyor -- ama **hiçbiri sürecin ne yüklediğini
# tutmuyor.** `git status` bunu göremez, çünkü `node_modules` izlenmiyor ve
# süreç zaten diske bakmıyor.
#
# O yüzden port dinleyen sürecin kendi söylediği sürümü, diskteki sürümle
# karşılaştırıyoruz. `next-server` sürümünü komut satırında taşıyor, yani
# sormak bedava. Bulamazsak SESSİZ GEÇMİYORUZ: bilinmiyorsa öyle yazıyoruz --
# ölçülmemiş bir şeyi ölçülmüş göstermek bu betiğin var oluş sebebinin tersi.
BASE="${E2E_BASE_URL:-http://localhost:3000}"
E2E_PORT="$(printf '%s' "$BASE" | sed -n 's/.*:\([0-9][0-9]*\).*/\1/p')"
DISK_NEXT="$(node -e 'console.log(require("next/package.json").version)' 2>/dev/null || echo bilinmiyor)"
SERVER_PID="$(lsof -nP -iTCP:"${E2E_PORT:-3000}" -sTCP:LISTEN -t 2>/dev/null | head -1)"
if [ -n "$SERVER_PID" ]; then
  SERVER_NEXT="$(ps -p "$SERVER_PID" -o command= 2>/dev/null | sed -n 's/.*next-server (v\([^)]*\)).*/\1/p')"
else
  SERVER_NEXT=""
fi
if [ -z "$SERVER_NEXT" ]; then
  echo "NOT: ${E2E_PORT:-3000} portunda koşan sürecin çatı sürümü OKUNAMADI." >&2
  echo "  (henüz başlamamış olabilir -- Playwright kendi sunucusunu kaldıracaksa normal.)" >&2
  echo "  Diskteki next: $DISK_NEXT. Bu koşu 'sunucu sürümü doğrulanmadı' olarak raporlanmalı." >&2
elif [ "$SERVER_NEXT" != "$DISK_NEXT" ]; then
  echo "DURDUM: sunucu ile disk AYNI ÇATIYI ÇALIŞTIRMIYOR." >&2
  echo "  ${E2E_PORT} portundaki süreç (pid $SERVER_PID): next $SERVER_NEXT" >&2
  echo "  node_modules'taki:                              next $DISK_NEXT" >&2
  echo "  Koşan süreç kendi sürümünü bellekte taşıyor; kurulum onu yeniden bağlamaz." >&2
  echo "  Sunucuyu yeniden başlat, sonra koş. Yoksa ölçtüğün şey ESKİ çatıdır." >&2
  exit 5
fi

START_HEAD=$(git rev-parse --short HEAD)
START_TRACKED=$(git status --porcelain --untracked-files=no)
START_UNTRACKED=$(git status --porcelain --untracked-files=all | grep '^??' || true)

echo "== KOŞU BAŞI =="; echo "$START_HEAD"; git status --porcelain
[ -z "${E2E_RUNNER:-}" ] && echo "NOT: E2E_RUNNER verilmedi -- kilitte adın yerine izin duracak." >&2

# KOŞU SÜRERKEN YOKLAMA, ve oynarsa HIZLI DÜŞME (dev'in tasarımı).
#
# İki uçtaki karşılaştırma kusuru yakalıyor ama SONRADAN: bugün üç kez "koşu
# bitti, sonra geçersiz olduğu anlaşıldı" yaşandı, 3-11 dakika. Git'te "dosya
# kaydedildi" kancası yok -- ama koşan betiğin kendisi bakabilir.
#
# Üç kazancı, üçü de bugün ölçülmüş bir kayba karşılık geliyor:
#   - dakikalar geri gelir: 5 saniyede yakalar, koşuyu öldürür, kimse beklemez;
#   - OYNATAN KİŞİ HÂLÂ ORADADIR ve geri alabilir -- sonradan anlaşıldığında
#     "kim oynattı" bir `git log` arkeolojisi olur (bugün tam bunu yaşadık);
#   - hangi yolun oynadığını söyler, "benim mi onun mu" diye sorulmaz.
#
# KISITI, ve yerine geçtiği şey yok: yoklama ARALIĞI KADAR KÖR. Beş saniyelik
# pencerede girip çıkan bir değişikliği kaçırır. İki uçtaki karşılaştırma
# duruyor; bu EK BİR AĞ, onun yerine geçen bir şey değil.
#
# Maliyeti: 5 saniyede bir `git status --porcelain`, bu depoda ~10 ms.
DRIFT_FILE="$(mktemp)"
npx playwright test "$@" &
PW_PID=$!
(
  while kill -0 "$PW_PID" 2>/dev/null; do
    NOW="$(git status --porcelain --untracked-files=no)"
    if [ "$NOW" != "$START_TRACKED" ]; then
      { echo ""
        echo "ZEMİN KOŞU SÜRERKEN OYNADI -- KOŞU ÖLDÜRÜLÜYOR."
        echo "  Oynayan yollar:"
        diff <(printf '%s\n' "$START_TRACKED") <(printf '%s\n' "$NOW") | sed 's/^/    /'
        echo "  Oynatan kişi ŞU AN hâlâ o dosyadadır -- geri alsın, sonra koş."
      } > "$DRIFT_FILE"
      kill "$PW_PID" 2>/dev/null
      break
    fi
    sleep 5
  done
) &
WATCH_PID=$!
wait "$PW_PID"; STATUS=$?
kill "$WATCH_PID" 2>/dev/null; wait "$WATCH_PID" 2>/dev/null

if [ -s "$DRIFT_FILE" ]; then
  cat "$DRIFT_FILE" >&2
  rm -f "$DRIFT_FILE"
  # YARIM ARTEFAKT SİLİNİR (dev): "yarım artefakt, olmayan artefakttan kötüdür,
  # çünkü açılır, okunur ve bir şey anlatıyor sanılır."
  #
  # İKİ KEZ, ve sebebi ölçüldü: ilk gösterimde bir kez sildim ve dizin GERİ
  # GELDİ. `wait` npx'in çıkışını bekliyor, ama öldürülen işçiler ve tarayıcı
  # süreçleri diske yazmayı o andan SONRA bitiriyor. Yani tek silme, yarışın
  # yanlış tarafında duruyordu -- ve bu tam olarak sildiğimizi sandığımız
  # şeyin geri gelmesi, yani kusurun en sinsi hâli.
  rm -rf test-results
  sleep 1
  rm -rf test-results
  # AYRI ÇIKIŞ KODU, ve sebebi "ayrı olgu"dan somut: ikisi okuyucuya FARKLI İŞ
  # veriyor. `exit 3` = koşu tamamlandı, sonucu sayma -> ağaç durunca AYNI
  # koşuyu tekrarla. `exit 7` = koşu hiç tamamlanmadı -> önce KİMİN oynattığını
  # bul, sonra koş. Rakam otomasyon için, yukarıdaki cümleler insan için.
  echo "  (exit 7: koşu tamamlanmadı. exit 3 olsaydı 'koştu ama sayma' demekti.)" >&2
  exit 7
fi
rm -f "$DRIFT_FILE"
END_HEAD=$(git rev-parse --short HEAD)
END_TRACKED=$(git status --porcelain --untracked-files=no)
END_UNTRACKED=$(git status --porcelain --untracked-files=all | grep '^??' || true)
echo "== KOŞU SONU =="; echo "$END_HEAD"; git status --porcelain

# ÜÇ DEĞİŞİKLİK, ÜÇ AYRI SONUÇ -- hepsini "kirli" saymak yanlış olurdu.
#
# `dev-ui` bunu elle ayırdı ve doğru ayırdı: koşusunun sonunda ağaçta iki YENİ
# ve İZLENMEYEN dosya belirdi (`modules/import/mask*.ts`), dokunduğu hiçbir
# yüzeyi çizmiyorlardı, ve koşuyu geçersiz saymadı. O yargı buraya geçiyor:
#
#   HEAD oynadı        -> koşu GEÇERSİZ. Ölçtüğün kod, adını yazdığın kod değil.
#   izlenen dosya oynadı -> koşu GEÇERSİZ. Süitin okuduğu bir dosya olabilir ve
#                          hangisinin okunduğu koşudan sonra bilinemez.
#   yalnız izlenmeyen  -> NOT düşülür, geçersiz DEĞİL. Yeni bir dosya, hiçbir
#                          şey onu import etmiyorsa hiçbir şeyi çizmez.
#
# Ve geçersizlik ÇIKIŞ KODUNA yansır: hareketli ağaçta alınan yeşil, yeşil
# okunmamalı. Bir uyarı satırı basıp 0 ile çıkmak, bu turda altı koşuyu çöpe
# götüren şeyin ta kendisidir -- kimse uyarıyı okumaz, sayıyı okur.
DRIFT=""
[ "$START_HEAD" != "$END_HEAD" ] && DRIFT="HEAD: $START_HEAD -> $END_HEAD"
if [ "$START_TRACKED" != "$END_TRACKED" ]; then
  DRIFT="${DRIFT:+$DRIFT; }izlenen dosyalar koşu sırasında değişti"
fi

if [ -n "$DRIFT" ]; then
  echo "" >&2
  echo "ZEMİN OYNADI -- BU KOŞU GEÇERSİZ: $DRIFT" >&2
  echo "  Playwright sonucu: $STATUS (yeşil de olsa sayma)." >&2
  echo "  Ağaç durunca tekrar koş. Kimin oynattığını 'git log --oneline $START_HEAD..HEAD' söyler." >&2
  exit 3
fi

# SONDA DA SÖYLE (dev): baştaki uyarı 45 test sonra akıp gitmiştir; sondaki
# satır ise RAPORU YAZARKEN gözünün önündedir, ve `E2E_RUNNER` vermeyi bir
# sonraki sefer hatırlatacak yer orasıdır.
if [ -z "${E2E_RUNNER:-}" ]; then
  echo "" >&2
  echo "NOT: bu koşu adsız yapıldı (kilitte who=bilinmiyor)." >&2
  echo "  Sonraki sefer: E2E_RUNNER=<ad> $0 ...  -- koşanı arayan kimse sana sormaz." >&2
fi

if [ "$START_UNTRACKED" != "$END_UNTRACKED" ]; then
  echo "" >&2
  echo "NOT: koşu sırasında izlenmeyen dosya(lar) belirdi. Koşu GEÇERLİ --" >&2
  echo "  izlenmeyen bir dosyayı hiçbir şey import etmiyorsa hiçbir şeyi çizmez." >&2
  echo "  Yine de yazılı olsun: 'ölçüm sırasında ağaçta ne vardı' sonradan aranmamalı." >&2
fi

exit $STATUS
