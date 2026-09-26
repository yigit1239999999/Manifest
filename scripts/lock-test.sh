#!/usr/bin/env bash
# KİLİTLERİN DAVRANIŞ SINAVI -- `e2e.sh` ve `serve-prod.sh`.
#
# NEDEN SÖZDİZİMİ KAPISI YETMİYOR, ve bu dosyanın tek var oluş sebebi bu:
# 26 Eylül 2026'da iki kilidin de ayrıştırması BOZUKTU ve `bash -n` İKİSİNİ
# DE TEMİZ GEÇTİ. Bozukluk iki kattı ve ikisi de sessizdi:
#
#   - `tr ' ' '\n' | sed -n '...' "$LOCK"` -- `sed` dosyayı okuyor, `tr`
#     stdin'i bekliyor. `OWNER_PID` HER ZAMAN boş; "koşu sürüyor" / "başka
#     bir derleme sürüyor" satırı hiç basılamıyor, yani kilit reddetmiyor.
#   - Aynı ifade trap gövdesine konduğunda tek tırnaklar gövdeyi çalışma
#     anında bölüyor (`trap: invalid signal specification`), yani kilit
#     çıkışta HİÇ silinmiyor. Ağaçta duran `BUILDING` bayat değildi,
#     TEMİZLENMEMİŞTİ -- ve iki kez "bayat kilit" diye teşhis edildi.
#
# İkisi de ancak KOŞTURULARAK görünür. O yüzden sınav üç DAVRANIŞI sorar,
# desen eşleştirmez:
#
#   1. Sahibi CANLI bir kilitte betik durur ve sebebini söyler.
#   2. Betik çıkınca KENDİ kilidini siler.
#   3. Başkası kilidi devraldıysa çıkışımız ONUN kilidini SİLMEZ.
#
# GERÇEK KİLİTLERE DOKUNMUYOR: iki betik de kilit adını ortam değişkeninden
# alıyor ve sınav kendi geçici dosyalarını veriyor. Bekçiyi tam da koruduğu
# şeyin üstünde sınamak -- paylaşımlı ağaçta `E2E_RUNNING` yakıp söndürmek --
# zemini gerçekten oynatırdı.
#
# GERÇEK İŞ DE YAPMIYOR: `npx` PATH'in başına konan, üç saniye uyuyup
# başarısız olan bir sahteyle gölgeleniyor. Böylece iki betik de trap'in
# kurulduğu yerin ÖTESİNE geçiyor (kilit gerçekten alınıyor ve gerçekten
# bırakılıyor) ama süit koşulmuyor ve `.next-prod` derlenmiyor. Uyku bir süs
# değil: 3. senaryonun kilidi devralabileceği pencere o.
#
# NE SINAMIYOR: PID yeniden kullanımı, iki betiğin birbirini beklemesi,
# `--force`un kendisi, ve gerçek bir süit/derlemenin kilidi ne kadar tuttuğu.
#
# KİM, NE ZAMAN: `scripts/e2e.sh` ya da `scripts/serve-prod.sh` içindeki
# kilit satırlarına dokunan kişi, commit'ten önce. Otomatik bir kapıya
# bağlı DEĞİL -- bağlanacaksa kararı lider verir.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# `serve-prod.sh` kilide GELMEDEN, `MEASURING` kontrolünde exit 3 veriyor --
# yani biri ölçüyorken derleme kilidinin davranışı ölçülemez. Bu bir kusur
# değil, sıranın kendisi; ama SESSİZ GEÇMİYOR: atlanan yarı sonda adıyla
# yazılıyor ve çıkış kodu 2 oluyor. Eksik bir sınav, yeşil okunmamalı.
SKIP_BUILD=""
if [ -f MEASURING ]; then
  SKIP_BUILD=1
fi

TMP="$(mktemp -d)"
ALIVE=""
cleanup() {
  [ -n "$ALIVE" ] && kill "$ALIVE" 2>/dev/null
  rm -rf "$TMP"
}
trap cleanup EXIT

mkdir -p "$TMP/bin"
cat > "$TMP/bin/npx" <<'FAKE'
#!/bin/sh
sleep 3
exit 1
FAKE
chmod +x "$TMP/bin/npx"

sleep 300 &
ALIVE=$!

FAILED=0
pass() { echo "GEÇTİ  $1"; }
fail() { echo "DÜŞTÜ  $1" >&2; FAILED=1; }

# Sahibi canlı bir kilit, iki betiğin de yazdığı biçimde. `e2e.sh` alanları
# boşlukla ayırıp `pid=`i ORTAYA, `serve-prod.sh` SATIR BAŞINA yazıyor --
# ayrıştırma ikisini de okumak zorunda, o yüzden sınav ikisini de veriyor.
write_e2e_lock() {
  printf 'who=sınav pid=%s ppid=1 parent=lock-test cwd=%s at=sınav head=sınav suite=sınav\n' \
    "$1" "$ROOT" > "$2"
}
write_build_lock() {
  printf 'pid=%s at=sınav port=3099 head=sınav\n' "$1" > "$2"
}

# Kilit belirene kadar bekle: "aldı mı" sorusunun cevabı, silinmiş olmasının
# önemli olabilmesi için gerekli -- hiç yazılmamış bir kilidin yokluğu bir
# şey kanıtlamaz.
wait_for_lock() {
  for _ in $(seq 1 200); do
    [ -s "$1" ] && return 0
    sleep 0.05
  done
  return 1
}

echo "== 1. SENARYO: sahibi CANLI olan kilitte durmak =="

LOCK="$TMP/e2e-canli"
write_e2e_lock "$ALIVE" "$LOCK"
OUT="$(E2E_LOCK_FILE="$LOCK" ./scripts/e2e.sh 2>&1)"; CODE=$?
echo "$OUT" | sed 's/^/    /'
if [ "$CODE" = 1 ] && printf '%s' "$OUT" | grep -q "koşu sürüyor"; then
  pass "e2e.sh: canlı sahip tanındı (exit 1, DURDUM satırı basıldı)"
else
  fail "e2e.sh: canlı sahip TANINMADI (exit $CODE) -- OWNER_PID boş geliyor olabilir"
fi
if grep -q "pid=$ALIVE" "$LOCK" 2>/dev/null; then
  pass "e2e.sh: reddedilen koşu kilide dokunmadı"
else
  fail "e2e.sh: reddedilen koşu BAŞKASININ kilidini bozdu"
fi

if [ -z "$SKIP_BUILD" ]; then
  LOCK="$TMP/build-canli"
  write_build_lock "$ALIVE" "$LOCK"
  OUT="$(BUILD_LOCK_FILE="$LOCK" ./scripts/serve-prod.sh 3099 2>&1)"; CODE=$?
  echo "$OUT" | sed 's/^/    /'
  if [ "$CODE" = 4 ] && printf '%s' "$OUT" | grep -q "başka bir derleme sürüyor"; then
    pass "serve-prod.sh: canlı sahip tanındı (exit 4, DURDUM satırı basıldı)"
  else
    fail "serve-prod.sh: canlı sahip TANINMADI (exit $CODE)"
  fi
fi

echo "== 2. SENARYO: çıkışta KENDİ kilidini silmek =="

LOCK="$TMP/e2e-kendi"
rm -f "$LOCK"
( PATH="$TMP/bin:$PATH" E2E_LOCK_FILE="$LOCK" ./scripts/e2e.sh >/dev/null 2>&1 ) &
SH=$!
if wait_for_lock "$LOCK"; then
  echo "    kilit alındı: $(cat "$LOCK")"
  wait "$SH"
  if [ -e "$LOCK" ]; then
    fail "e2e.sh: çıkışta kendi kilidini SİLMEDİ -- $(cat "$LOCK")"
  else
    pass "e2e.sh: çıkışta kendi kilidini sildi"
  fi
else
  wait "$SH"
  fail "e2e.sh: kilit hiç yazılmadı, sınav ölçmedi"
fi

if [ -z "$SKIP_BUILD" ]; then
  LOCK="$TMP/build-kendi"
  rm -f "$LOCK"
  ( PATH="$TMP/bin:$PATH" BUILD_LOCK_FILE="$LOCK" ./scripts/serve-prod.sh 3099 >/dev/null 2>&1 ) &
  SH=$!
  if wait_for_lock "$LOCK"; then
    echo "    kilit alındı: $(cat "$LOCK")"
    wait "$SH"
    if [ -e "$LOCK" ]; then
      fail "serve-prod.sh: çıkışta kendi kilidini SİLMEDİ -- $(cat "$LOCK")"
    else
      pass "serve-prod.sh: çıkışta kendi kilidini sildi"
    fi
  else
    wait "$SH"
    fail "serve-prod.sh: kilit hiç yazılmadı, sınav ölçmedi"
  fi
fi

echo "== 3. SENARYO: BAŞKASININ kilidini silmemek =="

LOCK="$TMP/e2e-baska"
rm -f "$LOCK"
( PATH="$TMP/bin:$PATH" E2E_LOCK_FILE="$LOCK" ./scripts/e2e.sh >/dev/null 2>&1 ) &
SH=$!
if wait_for_lock "$LOCK"; then
  # Koşu sürerken biri --force ile üzerine yazdı: kilit artık ONUN.
  write_e2e_lock "$ALIVE" "$LOCK"
  wait "$SH"
  if grep -q "pid=$ALIVE" "$LOCK" 2>/dev/null; then
    pass "e2e.sh: başkasının kilidi ayakta kaldı"
  else
    fail "e2e.sh: BAŞKASININ kilidini sildi -- kilit çözdüğü problemi geri getirir"
  fi
else
  wait "$SH"
  fail "e2e.sh: kilit hiç yazılmadı, sınav ölçmedi"
fi

if [ -z "$SKIP_BUILD" ]; then
  LOCK="$TMP/build-baska"
  rm -f "$LOCK"
  ( PATH="$TMP/bin:$PATH" BUILD_LOCK_FILE="$LOCK" ./scripts/serve-prod.sh 3099 >/dev/null 2>&1 ) &
  SH=$!
  if wait_for_lock "$LOCK"; then
    write_build_lock "$ALIVE" "$LOCK"
    wait "$SH"
    if grep -q "pid=$ALIVE" "$LOCK" 2>/dev/null; then
      pass "serve-prod.sh: başkasının kilidi ayakta kaldı"
    else
      fail "serve-prod.sh: BAŞKASININ kilidini sildi"
    fi
  else
    wait "$SH"
    fail "serve-prod.sh: kilit hiç yazılmadı, sınav ölçmedi"
  fi
fi

if [ "$FAILED" != 0 ]; then
  echo "== DÜŞEN VAR ==" >&2
  exit 1
fi
if [ -n "$SKIP_BUILD" ]; then
  echo "== e2e KİLİDİ: ÜÇ DAVRANIŞ GEÇTİ · DERLEME KİLİDİ: ÖLÇÜLMEDİ ==" >&2
  echo "   Sebebi: MEASURING var, serve-prod.sh kilide gelmeden exit 3 veriyor." >&2
  echo "   Ölçüm bitince yeniden koş; bu koşu ALTI davranışın üçünü sınadı." >&2
  exit 2
fi
echo "== ALTI DAVRANIŞ DA GEÇTİ =="
