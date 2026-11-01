export function chapterIdsOutsidePositionRange(chapters: readonly { id: string }[], first: number, last: number) {
  return chapters.flatMap((chapter, index) => index + 1 < first || index + 1 > last ? [chapter.id] : []);
}
