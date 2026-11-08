/** Older chapters may only have a title; explicit IDs always take precedence.
 * AppContext removes legacy rows before they can be persisted or displayed. */
export function chapterBelongsToNovel(
  chapter: { novelId?: string; novelTitle?: string },
  novel: { id: string; title: string },
) {
  return chapter.novelId ? chapter.novelId === novel.id : !!chapter.novelTitle && chapter.novelTitle === novel.title;
}

export function countLibraryChapters(
  chapters: { novelId?: string; novelTitle?: string }[],
  novels: { id: string; title: string }[],
) {
  return chapters.filter(chapter => novels.some(novel => chapterBelongsToNovel(chapter, novel))).length;
}
