import type { SavedChapter } from '../context/AppContext';
import { detectChapterHeading } from './chapterHeading';

export type ChapterInput = Omit<SavedChapter, 'id' | 'savedAt'>;
export interface ChapterSaveOptions { duplicatePolicy?: 'skip' | 'overwrite'; overwriteIds?: string[] }
const normalize = (text: string) => text.normalize('NFC').replace(/\r\n?/g, '\n').trim();
const normalizedTitle = (text: string) => normalize(text).replace(/\s+/g, ' ').toLocaleLowerCase('vi');
function part(chapter: ChapterInput): string {
  const match = `${chapter.title}\n${chapter.originalText.split('\n')[0]}`.match(/[（(]\s*(\d+)\s*[/／]\s*(\d+)\s*[)）]/);
  return match ? `${Number(match[1])}/${Number(match[2])}` : '';
}
function identity(chapter: ChapterInput): string {
  const heading = detectChapterHeading(chapter.chapterPrefix || '') || detectChapterHeading(chapter.title) || detectChapterHeading(chapter.originalText);
  return heading ? `${heading.prefix.toLowerCase()}|${part(chapter)}` : '';
}
type IndexedChapter = { row: SavedChapter; scope: string; source: string; url: string; key: string; title: string; part: string };
/** Index once for large batches instead of repeatedly scanning every stored chapter. */
export function createLibraryChapterMatcher(existing: SavedChapter[]) {
  const indexes = { source: new Map<string, IndexedChapter[]>(), url: new Map<string, IndexedChapter[]>(), key: new Map<string, IndexedChapter[]>(), title: new Map<string, IndexedChapter[]>() };
  const records = new Map<string, IndexedChapter>();
  const indexKey = (scope: string, value: string) => JSON.stringify([scope, value]);
  const update = (row: SavedChapter) => {
    const previous = records.get(row.id);
    if (previous) for (const field of ['source', 'url', 'key', 'title'] as const) {
      if (!previous[field]) continue;
      const key = indexKey(previous.scope, previous[field]);
      indexes[field].set(key, (indexes[field].get(key) || []).filter(item => item.row.id !== row.id));
    }
    const record: IndexedChapter = { row, scope: row.novelId ? `id:${row.novelId}` : `title:${row.novelTitle || ''}`,
      source: normalize(row.originalText), url: row.sourceUrl?.split('#')[0] || '', key: identity(row),
      title: normalizedTitle(row.title), part: part(row) };
    records.set(row.id, record);
    for (const field of ['source', 'url', 'key', 'title'] as const) {
      if (!record[field]) continue;
      const key = indexKey(record.scope, record[field]);
      const values = indexes[field].get(key) || []; values.push(record); indexes[field].set(key, values);
    }
  };
  existing.forEach(update);
  const find = (incoming: ChapterInput): SavedChapter | undefined => {
    const scopes = incoming.novelId ? [`id:${incoming.novelId}`, ...(incoming.novelTitle ? [`title:${incoming.novelTitle}`] : [])] :
      incoming.novelTitle ? [`title:${incoming.novelTitle}`] : [];
    const key = identity(incoming), incomingPart = part(incoming);
    const compatible = (record: IndexedChapter) => record.part === incomingPart && (!record.key || !key || record.key === key);
    const lookup = (field: keyof typeof indexes, value: string) => value ? scopes.flatMap(scope => indexes[field].get(indexKey(scope, value)) || []) : [];
    const exact = lookup('source', normalize(incoming.originalText)).find(compatible);
    if (exact) return exact.row;
    const byUrl = lookup('url', incoming.sourceUrl?.split('#')[0] || '').find(compatible);
    if (byUrl) return byUrl.row;
    const matches = (key ? lookup('key', key) : lookup('title', normalizedTitle(incoming.title))).filter(record => record.part === incomingPart);
    // Existing libraries may already contain revisions of the same chapter.
    // Resolve by title too instead of treating ambiguous number matches as new chapters.
    const sameTitle = matches.find(record => record.title === normalizedTitle(incoming.title));
    if (sameTitle) return sameTitle.row;
    return matches.length === 1 ? matches[0].row : undefined;
  };
  return { find, update };
}

export function findLibraryChapter(existing: SavedChapter[], incoming: ChapterInput): SavedChapter | undefined {
  return createLibraryChapterMatcher(existing).find(incoming);
}

export function mergeLibraryChapters(existing: SavedChapter[], incoming: ChapterInput[], options: ChapterSaveOptions = {}) {
  const result = [...existing];
  const added: SavedChapter[] = [];
  const ids: string[] = [];
  const matcher = createLibraryChapterMatcher(existing);
  const positions = new Map(existing.map((row, index) => [row.id, index]));
  const addedIds = new Set<string>();
  const processedIds = new Set<string>();
  let overwritten = 0, skipped = 0;
  for (const chapter of incoming) {
    let match = matcher.find(chapter);
    // Different prose can be another revision or merely different website adverts.
    // A same-number, same-title item is still the same chapter. Explicit part
    // markers are included in identity; differently titled unlabeled parts survive.
    if (match && addedIds.has(match.id) && normalize(match.originalText) !== normalize(chapter.originalText) && normalizedTitle(match.title) !== normalizedTitle(chapter.title)) match = undefined;
    if (match) {
      ids.push(match.id);
      if (addedIds.has(match.id) || processedIds.has(match.id)) { skipped++; continue; }
      processedIds.add(match.id);
      if (options.duplicatePolicy !== 'overwrite') { skipped++; continue; }
      if (options.overwriteIds && !options.overwriteIds.includes(match.id)) throw new Error('Thư viện đã thay đổi. Hãy kiểm tra và xác nhận ghi đè lại.');
      const updated = { ...match, ...chapter, id: match.id, savedAt: Date.now() };
      result[positions.get(match.id)!] = updated;
      matcher.update(updated);
      overwritten++;
    } else {
      const row = { ...chapter, id: `chap-${crypto.randomUUID()}`, savedAt: Date.now() };
      added.push(row); ids.push(row.id); addedIds.add(row.id); matcher.update(row);
    }
  }
  return { chapters: [...added, ...result], count: added.length, overwritten, skipped, ids };
}

/** Repair only matching book + chapter number + explicit part + full title.
 * Keep stable IDs for reading positions, with the newest saved version's content.
 * Callers must preserve a recovery snapshot before persisting this plan.
 */
export function planLibraryDuplicateRepair(chapters: SavedChapter[], novelId: string) {
  const groups = new Map<string, SavedChapter[]>();
  for (const row of chapters) {
    if (row.novelId !== novelId || !identity(row)) continue;
    const key = JSON.stringify([identity(row), normalizedTitle(row.title)]);
    const group = groups.get(key) || []; group.push(row); groups.set(key, group);
  }
  const replacements = new Map<string, SavedChapter>();
  const redirectedIds: Record<string, string> = {};
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const survivor = group[0];
    const newest = group.reduce((latest, row) => row.savedAt > latest.savedAt ? row : latest, survivor);
    replacements.set(survivor.id, { ...newest, id: survivor.id });
    for (const row of group.slice(1)) redirectedIds[row.id] = survivor.id;
  }
  return { chapters: chapters.filter(row => !redirectedIds[row.id]).map(row => replacements.get(row.id) || row), redirectedIds,
    removedCount: Object.keys(redirectedIds).length };
}
