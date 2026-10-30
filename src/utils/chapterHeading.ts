import { chineseNumberToInt } from './chapterSplitter';

/** Only accept a chapter marker at the start of an opening line. */
export function detectChapterHeading(text: string): { prefix: string; name: string; raw: string } | null {
  for (const line of text.split(/\r?\n/).slice(0, 20)) {
    const raw = line.trim();
    const chinese = raw.match(/^第\s*(\d+|[零〇一二两三四五六七八九十百千万]+)\s*[章回节節卷部]\s*[:：.\-–—]?\s*(.*)$/);
    const other = raw.match(/^(?:Chương|Hồi|Tiết|Phần|Chapter|Chap)\s*(\d+)(?=$|[\s:：.\-–—])\s*[:：.\-–—]?\s*(.*)$/i);
    const match = chinese || other;
    if (!match) continue;
    const number = /^\d+$/.test(match[1]) ? Number(match[1]) : chineseNumberToInt(match[1]);
    if (number === null || !Number.isSafeInteger(number) || number < 1) continue;
    return { prefix: `Chương ${number}`, name: match[2].trim(), raw };
  }
  return null;
}
