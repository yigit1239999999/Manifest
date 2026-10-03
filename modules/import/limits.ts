/**
 * The one real ceiling on an import, and where it comes from.
 *
 * THERE IS NO ROW LIMIT. The owner's words: "2000 satır sınırı koymayalım".
 * The file is read in the browser (`read-file.ts`), so no file is ever
 * uploaded and the file's own size limits nothing.
 *
 * What does have a ceiling is the request that carries the rows to the
 * plan and the write. The host (Vercel) refuses a request body over 4.5 MB,
 * and that is a fact of the platform, not a number we chose. The rows go
 * gzip-compressed and only the columns the clinic is importing go at all,
 * so the ceiling sits far past any clinic's list -- measured on the
 * 4,821-row test file (10 columns), the body was a few hundred kilobytes.
 * A file past it is told so in a sentence that says what to do: split the
 * sheet in two. Importing the second half finds the people from the first
 * by name and phone, so a split file does not double anybody.
 *
 * Both readers use this number: the browser before it sends, so the vet
 * gets the sentence instead of a dead request, and the route, because the
 * browser's check is a courtesy and not a control.
 */
export const MAX_REQUEST_BYTES = 4_400_000;

/** The same number the way a person reads it, for the sentence on screen. */
export const MAX_REQUEST_MB = 4.5;

/**
 * How large the rows may be once decompressed on the server. A guard
 * against a tiny body that inflates without end, not a product limit:
 * well beyond what fits in `MAX_REQUEST_BYTES` of real tabular text.
 */
export const MAX_INFLATED_BYTES = 200 * 1024 * 1024;
