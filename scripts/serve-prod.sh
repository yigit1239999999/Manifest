#!/usr/bin/env bash
# Build, stamp, serve -- in that order, so the stamp cannot disagree with
# what is on the port.
#
# The stamp used to be written by hand, and three times in one day it said
# something the screen contradicted: a measurement was taken against a
# commit the build did not contain, and the reading looked right at the
# moment it was taken. A ground you can only learn by asking someone is not
# a ground. So SERVED_COMMIT.txt is written HERE, after the build exits 0,
# from `.next/BUILD_ID` itself rather than from what the operator believed.
#
# It also records whether the tree was clean. A build taken from a dirty
# tree is not the commit it names -- with two developers in one tree that
# is the ordinary case, not the exception, and the difference is invisible
# once the server is up.
set -euo pipefail

PORT="${1:-3005}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMMIT="$(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  TREE="KİRLİ -- bu derleme $COMMIT DEĞİLDİR, $COMMIT + commit edilmemiş iş"
  DIRTY="$(git status --short --untracked-files=no | wc -l | tr -d ' ') yol"
else
  TREE="temiz"
  DIRTY="0"
fi

echo "==> derleniyor: $COMMIT ($TREE)"
npx prisma generate >/dev/null
npm run build

BUILD_ID="$(cat .next/BUILD_ID)"

# Written only now: an unfinished build leaves the previous stamp standing,
# which is the honest answer, because the previous build is what is served.
cat > SERVED_COMMIT.txt <<STAMP
PORT      $PORT
COMMIT    $COMMIT
BUILD_ID  $BUILD_ID
TREE      $TREE
DEĞİŞEN   $DIRTY
YAZILDI   $(date -u +%Y-%m-%dT%H:%M:%SZ)

Bu dosyayı elle yazma. \`scripts/serve-prod.sh\` derleme 0 ile bitince
yazar; elle yazılan damga bugün üç kez ekranla çeliştiği için böyle.
STAMP

if lsof -ti ":$PORT" >/dev/null 2>&1; then
  echo "==> $PORT üzerindeki eski sunucu kapatılıyor"
  kill $(lsof -ti ":$PORT") 2>/dev/null || true
  sleep 2
fi

echo "==> sunuluyor: $PORT"
npx next start -p "$PORT" > "/tmp/next$PORT.log" 2>&1 &

# Poll rather than sleep a fixed number of seconds. The first version slept
# six and printed whatever curl said at that instant; on a slower start that
# printed 000, which reads as "the build failed" when the server was simply
# still coming up. A script whose job is to stop the ground being misread
# must not misreport the ground itself.
CODE=000
for _ in $(seq 1 40); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 5 "http://localhost:$PORT/" || echo 000)
  case "$CODE" in 000|"") sleep 1 ;; *) break ;; esac
done

printf "==> %s -> %s" "$PORT" "$CODE"
if [ "$CODE" = "000" ]; then
  echo "  (AYAĞA KALKMADI -- tail -40 /tmp/next$PORT.log)"
else
  echo "  (ayakta)"
fi
cat SERVED_COMMIT.txt
