// SMS segment math. GSM 03.38 7-bit fits 160 chars (153 per part when
// concatenated); anything outside that alphabet, e.g. Turkish ş/ğ/İ/ı/ç/ö/ü
// (ç ö ü are in GSM-7, ş ğ İ ı are not), forces UCS-2 with 70 chars
// (67 per part). Providers that support the Turkish national shift table
// (Netgsm "encoding: TR") keep the 7-bit budget; we report both so the UI can
// show a realistic cost and templates can stay short.

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED = "^{}\\[~]|€";
// Characters the Turkish national language shift table adds on top of GSM-7.
const GSM7_TURKISH_EXTRA = "ŞşĞğİıÇç";

export interface SegmentInfo {
  encoding: "GSM-7" | "GSM-7-TR" | "UCS-2";
  length: number;
  segments: number;
}

export function smsSegments(text: string): SegmentInfo {
  let extended = 0;
  let needsTurkish = false;
  let needsUcs2 = false;
  for (const ch of text) {
    if (GSM7_BASIC.includes(ch)) continue;
    if (GSM7_EXTENDED.includes(ch)) {
      extended++;
      continue;
    }
    if (GSM7_TURKISH_EXTRA.includes(ch)) {
      needsTurkish = true;
      continue;
    }
    needsUcs2 = true;
  }
  const chars = [...text].length;
  if (needsUcs2) {
    return { encoding: "UCS-2", length: chars, segments: chars <= 70 ? 1 : Math.ceil(chars / 67) };
  }
  const units = chars + extended;
  return {
    encoding: needsTurkish ? "GSM-7-TR" : "GSM-7",
    length: units,
    segments: units <= 160 ? 1 : Math.ceil(units / 153),
  };
}
