/**
 * How big a file the import screen accepts, in bytes.
 *
 * One constant with two readers on purpose. The browser checks it before it
 * sends, so the vet is told in a sentence rather than by a request that dies;
 * the route checks it again, because the browser's check is a courtesy and
 * not a control -- anything can post to the endpoint.
 *
 * The number is not a measurement of any real clinic's file, and nobody
 * should read it as one: no file has been seen (#16). It is the point past
 * which we would rather ask than accept quietly. A spreadsheet of a few
 * thousand rows of text is well under it, and something far larger is more
 * likely a different kind of file than a big clinic.
 *
 * Deliberately NOT `experimental.serverActions.bodySizeLimit`. That knob is
 * global: raising it for this one screen raises it for every action in the
 * product, on an experimental key, and the limit stops being visible at the
 * place it applies. A route handler carries its own.
 */
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

/** The same number the way a person reads it, for the sentence on screen. */
export const MAX_IMPORT_MB = MAX_IMPORT_BYTES / (1024 * 1024);
