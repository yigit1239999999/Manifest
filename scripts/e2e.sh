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

if [ -f "$LOCK" ]; then
  OWNER_PID=$(sed -n 's/.*pid=\([0-9]*\).*/\1/p' "$LOCK")
  if [ -n "$OWNER_PID" ] && kill -0 "$OWNER_PID" 2>/dev/null; then
    if [ -z "$FORCE" ]; then
      echo "DURDUM: koşu sürüyor -- $(cat "$LOCK")" >&2
      echo "  bitmesini bekle. Gerçekten ezmek istiyorsan: $0 --force ..." >&2
      exit 1
    fi
    echo "UYARI: canlı bir koşu (pid $OWNER_PID) --force ile eziliyor." >&2
  else
    echo "BAYAT KİLİT devralınıyor: $(cat "$LOCK")" >&2
    echo "  (pid ${OWNER_PID:-yok} çalışmıyor -- koşu çökmüş ya da kapatılmış.)" >&2
  fi
fi

printf 'who=%s pid=%s at=%s head=%s suite=%s\n' \
  "${E2E_RUNNER:-bilinmiyor}" "$$" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$(git rev-parse --short HEAD)" "${*:-tam-süit}" > "$LOCK"
# Yalnız KENDİ kilidimizi sileriz: başkasının kilidini silmek, çözdüğümüz
# problemi geri getirir.
trap '[ "$(sed -n "s/.*pid=\([0-9]*\).*/\1/p" "$LOCK" 2>/dev/null)" = "$$" ] && rm -f "$LOCK"' EXIT

# Artefaktın sahibi belli olsun: paylaşımlı `test-results/` yüzünden iki süit
# aynı dizine yazıp son yazan kazanıyordu, ve bugün dört hata bağlamının
# hangi koşuya ait olduğu söylenemedi (dev). Sahibi belirsiz kanıt, kanıt değil.
rm -rf test-results

echo "== KOŞU BAŞI ==";  git rev-parse --short HEAD; git status --porcelain
npx playwright test "$@"; STATUS=$?
echo "== KOŞU SONU ==";  git rev-parse --short HEAD; git status --porcelain
exit $STATUS
