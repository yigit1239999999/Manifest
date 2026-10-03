<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# We do not use Prettier

Not installed, not in the lockfile, not a gate, and not the house
style. 73 of this repo's files do not match its defaults, so running
it on a file you are working in produces about 75 lines of reflow
around your change, buries it in review, and collides with whoever
else is in that file.

Decided after measuring rather than on principle: there has never
been a formatting disagreement here, and `git blame` is used
constantly — a repo-wide reflow would blind it in exactly the files
that get read most. If formatting ever starts costing something real
(conflicts, review noise, an argument), this gets looked at again
**with the evidence**, and the answer then is one commit that
formats everything while no one has work in the tree.

`npx prettier` still works, because npx fetches it whether or not it
is a dependency. Uninstalling would not have prevented anything; this
paragraph is the only thing that does. If you have already run it,
revert the reflow and keep your own lines — that is what a colleague
did today, and it was right.

# Supabase: yalnızca PetTrack projesi

Bu uygulamanın bağlı olduğu tek veritabanı Supabase'deki **PetTrack**
projesidir: ref `seddtcddfaikqeiruedu`
(`https://seddtcddfaikqeiruedu.supabase.co`, eu-west-1). Kullanıcının
kuralı (3 Ekim 2026): *"Supabase'de her zaman sadece ama sadece buna
dokun."* Hesaptaki diğer projeler bu repoyla ilgisizdir: okunmaz,
sorgulanmaz, değiştirilmez.

Bu veritabanı canlıdır. Prisma migration'ları `_prisma_migrations`
tablosunda izlenir; Supabase panelindeki "Migrations" kutusunun boş
görünmesi bu yüzdendir, normaldir. Uygulanmış bir migration asla
düzenlenmez veya yeniden adlandırılmaz; şema değişikliği yalnızca yeni,
eklemeli bir migration ile ve kullanıcıya haber verilerek uygulanır.
