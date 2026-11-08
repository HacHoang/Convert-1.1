export type LibraryNovelPage = 'details' | 'chapters';

export function libraryPageAfterSwipe(page: LibraryNovelPage, deltaX: number, deltaY: number, threshold = 64): LibraryNovelPage {
  if (Math.abs(deltaX) < threshold || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return page;
  if (page === 'details' && deltaX < 0) return 'chapters';
  if (page === 'chapters' && deltaX > 0) return 'details';
  return page;
}
