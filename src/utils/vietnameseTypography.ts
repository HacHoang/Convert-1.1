/**
 * Converts CJK/full-width punctuation to the Latin punctuation used in
 * Vietnamese prose.  Keep line breaks intact so chapter and paragraph layout
 * is not changed while text is prepared for preview or export.
 */
const CJK_PUNCTUATION: Record<string, string> = {
  '，': ',', '。': '.', '！': '!', '？': '?', '；': ';', '：': ':', '、': ',',
  '（': '(', '）': ')', '【': '[', '】': ']', '《': '"', '》': '"',
  '「': '"', '」': '"', '『': '"', '』': '"', '“': '"', '”': '"', '‘': "'", '’': "'",
  '．': '.', '…': '...', '—': '—',
};

/** Uppercases the first Unicode letter on every line, preserving any leading symbols. */
export function capitalizeLineStarts(text: string): string {
  if (!text) return text;
  return text.replace(/(^|[\r\n])([^\p{L}\r\n]*)(\p{L})/gu, (_match, boundary: string, prefix: string, letter: string) =>
    boundary + prefix + letter.toLocaleUpperCase('vi-VN'));
}

/** Normalizes punctuation and its surrounding whitespace for Vietnamese text. */
export function normalizeVietnameseTypography(text: string, capitalizeLines = false): string {
  if (!text) return text;

  let result = text.replace(/[，。！？；：（）【】《》「」『』“”‘’．、…]/g, char => CJK_PUNCTUATION[char] ?? char);
  // A punctuation mark attaches to the preceding word. Do not alter leading
  // whitespace at a line boundary, which may be intentional indentation.
  result = result.replace(/([^\s])\s+([,.;:!?\)\]])/g, '$1$2');
  // Use one ordinary space after sentence punctuation when another word follows.
  result = result.replace(/([,.;:!?])(?=[^\s\)\]}'”])/g, '$1 ');
  result = result.replace(/([,.;:!?])[ \t]{2,}/g, '$1 ');
  result = result.replace(/"[ \t]+(?=\S)/g, '"').replace(/[ \t]+"/g, '"');
  return capitalizeLines ? capitalizeLineStarts(result) : result;
}
