<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
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
