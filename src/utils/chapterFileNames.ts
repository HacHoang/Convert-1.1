type Chapter = { id: string; chapterNum: number; rawTitle: string };

/** Stable names for explicit parts; also protect unlabelled duplicate chapter numbers. */
export function chapterFileNames(chapters: Chapter[], format: 'txt' | 'docx'): Map<string, string> {
  const counts = new Map<number, number>();
  chapters.forEach(chapter => counts.set(chapter.chapterNum, (counts.get(chapter.chapterNum) || 0) + 1));
  const occurrences = new Map<number, number>();
  const used = new Set<string>();
  const names = new Map<string, string>();
  chapters.forEach(chapter => {
    const occurrence = (occurrences.get(chapter.chapterNum) || 0) + 1;
    occurrences.set(chapter.chapterNum, occurrence);
    const part = chapter.rawTitle.match(/[（(]\s*(\d+)\s*[/／]\s*\d+\s*[)）]/)?.[1];
    const stem = `${chapter.chapterNum}${part ? `-${Number(part)}` : counts.get(chapter.chapterNum)! > 1 ? `-${occurrence}` : ''}`;
    let name = `${stem}.${format}`;
    let collision = 2;
    while (used.has(name)) name = `${stem}-${collision++}.${format}`;
    used.add(name);
    names.set(chapter.id, name);
  });
  return names;
}
