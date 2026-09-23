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
LOCK="E2E_RUNNING"
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
acquire() {
  ( set -C
    printf 'who=%s pid=%s at=%s head=%s suite=%s\n' \
      "${E2E_RUNNER:-bilinmiyor}" "$$" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      "$(git rev-parse --short HEAD)" "${RUN_SUITE:-tam-süit}" > "$LOCK"
  ) 2>/dev/null
}

RUN_SUITE="${*:-tam-süit}"
if ! acquire; then
  OWNER_PID=$(sed -n 's/.*pid=\([0-9]*\).*/\1/p' "$LOCK" 2>/dev/null)
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
trap '[ "$(sed -n "s/.*pid=\([0-9]*\).*/\1/p" "$LOCK" 2>/dev/null)" = "$$" ] && rm -f "$LOCK"' EXIT

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
npx playwright test "$@"; STATUS=$?
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

if [ "$START_UNTRACKED" != "$END_UNTRACKED" ]; then
  echo "" >&2
  echo "NOT: koşu sırasında izlenmeyen dosya(lar) belirdi. Koşu GEÇERLİ --" >&2
  echo "  izlenmeyen bir dosyayı hiçbir şey import etmiyorsa hiçbir şeyi çizmez." >&2
  echo "  Yine de yazılı olsun: 'ölçüm sırasında ağaçta ne vardı' sonradan aranmamalı." >&2
fi

exit $STATUS
