import { INITIAL_NAMES } from '../data/defaultNames';
import type { NameItem } from '../data/defaultNames';
import { DEFAULT_VIETPHRASE } from '../data/vietphraseData';
import { DEFAULT_IGNORED_PHRASES, DEFAULT_LUAT_NHAN, DEFAULT_NAMES2, DEFAULT_PRONOUNS } from '../data/quickTranslatorData';
import { getHanVietChar } from '../data/hanvietData';
import { simplifyChinese } from './simplifyChinese';
import { capitalizeLineStarts, normalizeVietnameseTypography } from './vietnameseTypography';

export interface QuickTranslatorPortOptions {
  namesMainMap?: Record<string, string>;
  phienAmMap?: Record<string, string>;
  luatNhanMap?: Record<string, string>;
  pronounsMap?: Record<string, string>;
  ignoredPhrases?: string[];
  /** Disable omission when previewing the meaning of ignored phrases. */
  applyIgnoredPhrases?: boolean;
  translationAlgorithm?: 0 | 1 | 2;
  wrapType?: 0 | 1 | 2 | 3;
  prioritizedName?: boolean;
  /** Uppercase the first Unicode letter of every output line. Defaults to true. */
  capitalizeLines?: boolean;
  /** Internal batch mode: avoid allocating source-to-output segments when only text is needed. */
  collectSegments?: boolean;
}

export interface QuickTranslationSegment {
  text: string;
  sourceStart: number;
  sourceEnd: number;
}

const firstMeaning = (value: string) => value.split(/[\/|]/, 1)[0];
type Lookup = { has(key: string): boolean; get(key: string): string | undefined };
const owns = (dictionary: Record<string, string>, key: string) => Object.prototype.hasOwnProperty.call(dictionary, key);
const ownValue = (dictionary: Record<string, string>, key: string) => owns(dictionary, key) ? dictionary[key] : undefined;

const recordMaxLengths = new WeakMap<Record<string, string>, number>();
const namesMaxLengths = new WeakMap<NameItem[], number>();
type PreparedDictionaries = {
  names: NameItem[];
  namesMainMap?: Record<string, string>;
  phienAmMap?: Record<string, string>;
  luatNhanMap?: Record<string, string>;
  pronounsMap?: Record<string, string>;
  ignoredPhrases?: string[];
  applyIgnoredPhrases?: boolean;
  value: ReturnType<typeof buildDictionaries>;
};
const dictionaryCache = new WeakMap<Record<string, string>, PreparedDictionaries[]>();
function maxRecordKeyLength(dictionary: Record<string, string>) {
  const cached = recordMaxLengths.get(dictionary);
  if (cached !== undefined) return cached;
  let maximum = 1;
  for (const key of Object.keys(dictionary)) maximum = Math.max(maximum, key.length);
  recordMaxLengths.set(dictionary, maximum);
  return maximum;
}
function maxNameKeyLength(names: NameItem[]) {
  const cached = namesMaxLengths.get(names);
  if (cached !== undefined) return cached;
  let maximum = 1;
  for (const name of names) maximum = Math.max(maximum, name.chinese.length);
  namesMaxLengths.set(names, maximum);
  return maximum;
}

function buildDictionaries(names: NameItem[], vietphrase: Record<string, string>, options: QuickTranslatorPortOptions) {
  // TranslatorEngine.loadVietPhraseDictionary: Names chính, Names phụ, rồi
  // VietPhrase; khóa Name luôn thắng khóa trùng trong VietPhrase.
  // Legacy profiles may have the initialization marker but no IndexedDB
  // snapshots. Keep the shipped dictionaries as a fallback in that case.
  const vietphrasePrototype = Object.getPrototypeOf(vietphrase);
  const useBuiltIns = vietphrasePrototype === Object.prototype || vietphrasePrototype === null;
  const mainNames = { ...(useBuiltIns ? DEFAULT_NAMES2 : {}), ...(options.namesMainMap || {}) };
  const ignoredPhrases = new Set(options.applyIgnoredPhrases === false ? [] : [...(useBuiltIns ? DEFAULT_IGNORED_PHRASES : []), ...(options.ignoredPhrases || [])]);
  const secondaryNames = new Map([...INITIAL_NAMES, ...names].map(name => [name.chinese, name.vietnamese]));
  const nameDictionary: Lookup = {
    has: key => secondaryNames.has(key) || owns(mainNames, key),
    get: key => secondaryNames.has(key) ? secondaryNames.get(key) : ownValue(mainNames, key),
  };
  const mergedVietphrase = { ...(useBuiltIns ? DEFAULT_VIETPHRASE : {}), ...vietphrase };
  const dictionary: Lookup = {
    has: key => ignoredPhrases.has(key) || nameDictionary.has(key) || owns(vietphrase, key),
    get: key => {
      if (ignoredPhrases.has(key)) return '';
      const value = nameDictionary.get(key) ?? ownValue(mergedVietphrase, key);
      return value === undefined ? undefined : firstMeaning(value);
    },
  };
  const pronouns = { ...(useBuiltIns ? DEFAULT_PRONOUNS : {}), ...(options.pronounsMap || {}) };
  const nhanDictionary: Lookup = {
    has: key => owns(pronouns, key) || nameDictionary.has(key),
    get: key => {
      const value = ownValue(pronouns, key) ?? nameDictionary.get(key);
      return value === undefined ? undefined : firstMeaning(value);
    },
  };
  // Dictionaries.config của bộ nguồn đặt ThuatToanNhan=2: Pronouns + Names.
  const rules = Object.entries({ ...(useBuiltIns ? DEFAULT_LUAT_NHAN : {}), ...(options.luatNhanMap || {}) })
    .filter(([pattern]) => pattern.includes('{0}'))
    .sort(([left], [right]) => right.length - left.length || left.localeCompare(right));
  const maxNameLength = Math.max(maxNameKeyLength(names), maxRecordKeyLength(mainNames));
  const maxIgnoredLength = [...ignoredPhrases].reduce((maximum, phrase) => Math.max(maximum, phrase.length), 1);
  const maxDictionaryLength = Math.max(maxNameLength, maxRecordKeyLength(mergedVietphrase), maxIgnoredLength);
  return { dictionary, nameDictionary, nhanDictionary, rules, maxNameLength, maxDictionaryLength };
}

/** Reuse immutable lookup structures for a whole batch instead of rebuilding them for every chapter. */
function createDictionaries(names: NameItem[], vietphrase: Record<string, string>, options: QuickTranslatorPortOptions) {
  const cached = dictionaryCache.get(vietphrase) || [];
  const match = cached.find(item => item.names === names
    && item.namesMainMap === options.namesMainMap
    && item.phienAmMap === options.phienAmMap
    && item.luatNhanMap === options.luatNhanMap
    && item.pronounsMap === options.pronounsMap
    && item.ignoredPhrases === options.ignoredPhrases
    && item.applyIgnoredPhrases === options.applyIgnoredPhrases);
  if (match) return match.value;
  const value = buildDictionaries(names, vietphrase, options);
  const entry = { names, namesMainMap: options.namesMainMap, phienAmMap: options.phienAmMap, luatNhanMap: options.luatNhanMap, pronounsMap: options.pronounsMap, ignoredPhrases: options.ignoredPhrases, applyIgnoredPhrases: options.applyIgnoredPhrases, value };
  // Retain only the most recent configuration per dictionary; style changes must not accumulate snapshots.
  dictionaryCache.set(vietphrase, [entry]);
  return value;
}

function containsName(source: string, start: number, length: number, names: Lookup, maxNameLength: number) {
  if (length < 2 || names.has(source.slice(start, start + length))) return false;
  const end = start + length - 1;
  for (let index = start + 1; index <= end; index++) {
    for (let size = Math.min(maxNameLength, source.length - index); size >= 2; size--) {
      if (index + size <= source.length && names.has(source.slice(index, index + size))) return true;
    }
  }
  return false;
}

function isLongestPhrase(source: string, start: number, length: number, dictionary: Lookup, algorithm: number, maxDictionaryLength: number) {
  if (length < 2) return true;
  const minimum = algorithm === 0 ? length : Math.max(3, length);
  const end = start + length - 1;
  for (let index = start + 1; index <= end; index++) {
    for (let size = Math.min(maxDictionaryLength, source.length - index); size > minimum; size--) {
      if (index + size <= source.length && dictionary.has(source.slice(index, index + size))) return false;
    }
  }
  return true;
}

function isChinese(char: string, phienAm: Record<string, string>, useBuiltIns = true) {
  return owns(phienAm, char) || useBuiltIns && getHanVietChar(char) !== char;
}
function isAllChinese(text: string, phienAm: Record<string, string>, useBuiltIns = true) {
  return [...text].every(char => isChinese(char, phienAm, useBuiltIns));
}

function findLuatNhan(text: string, dictionary: Lookup, rules: [string, string][]) {
  for (const [pattern, translation] of rules) {
    if (text.length < pattern.length - 2) continue;
    const expression = pattern.replace('{0}', '([^,\\. ?]{1,10})');
    const regex = new RegExp(expression, 'g');
    for (let attempt = 0; attempt < 2; attempt++) {
      const match = regex.exec(text);
      if (!match) break;
      const value = match[1];
      if (pattern.startsWith('{0}')) {
        for (let offset = 0; offset < value.length; offset++) {
          const subject = value.slice(offset);
          if (dictionary.has(subject)) return { index: match.index + offset, length: match[0].length - offset, pattern, translation, subject };
        }
      } else if (pattern.endsWith('{0}')) {
        for (let size = value.length; size > 0; size--) {
          const subject = value.slice(0, size);
          if (dictionary.has(subject)) return { index: match.index, length: match[0].length - (value.length - size), pattern, translation, subject };
        }
      } else if (dictionary.has(value)) {
        return { index: match.index, length: match[0].length, pattern, translation, subject: value };
      }
    }
  }
  return null;
}

function translateLuatNhan(text: string, dictionary: Lookup, rules: [string, string][]) {
  for (const [pattern, translation] of rules) {
    const match = new RegExp('^' + pattern.replace('{0}', '(.+)') + '$').exec(text);
    const meaning = match ? dictionary.get(match[1]) : undefined;
    if (match && meaning !== undefined) return meaning.split(/[\/|]/).map(value => translation.replace('{0}', value)).join('/');
  }
  return null;
}

function upperFirst(text: string) {
  return capitalizeLineStarts(text);
}

function capitalizeSegmentLineStarts(segments: QuickTranslationSegment[]) {
  let waitingForFirstLetter = true;
  return segments.map(segment => {
    let text = '';
    for (const char of segment.text) {
      if (char === '\r' || char === '\n') {
        waitingForFirstLetter = true;
        text += char;
      } else if (waitingForFirstLetter && /\p{L}/u.test(char)) {
        text += char.toLocaleUpperCase('vi-VN');
        waitingForFirstLetter = false;
      } else {
        text += char;
      }
    }
    return { ...segment, text };
  });
}

function appendTranslated(output: string, translated: string, last: string, capitalize: boolean) {
  if (/\n$|\t$|\. $|"$|'$|\? $|! $|\." $|\?" $|!" $|: $/.test(last)) last = capitalize ? upperFirst(translated) : translated;
  else if (last.endsWith(' ') || last.endsWith('(')) last = translated;
  else last = ' ' + translated;
  if ((!translated || /^[,.?!]/.test(translated)) && output.endsWith(' ')) output = output.slice(0, -1);
  return { output: output + last, last };
}

/** Port trực tiếp ChineseToVietPhraseOneMeaningForBatch từ TranslatorEngine 1.4. */
export function quickTranslateOneMeaningForBatchDetailed(
  source: string,
  names: NameItem[],
  vietphrase: Record<string, string>,
  options: QuickTranslatorPortOptions = {},
) {
  if (!source) return { text: '', segments: [] as QuickTranslationSegment[] };
  const lookupSource = simplifyChinese(source);
  const phienAm = options.phienAmMap || {};
  const vietphrasePrototype = Object.getPrototypeOf(vietphrase);
  const useBuiltIns = vietphrasePrototype === Object.prototype || vietphrasePrototype === null;
  const { dictionary, nameDictionary, nhanDictionary, rules, maxNameLength, maxDictionaryLength } = createDictionaries(names, vietphrase, options);
  const algorithm = options.translationAlgorithm ?? 1;
  const wrapType = options.wrapType ?? 0;
  const prioritizedName = options.prioritizedName ?? true;
  const capitalizeLines = options.capitalizeLines !== false;
  let output = '', last = '', index = 0;
  const collectSegments = options.collectSegments !== false;
  const segments: QuickTranslationSegment[] = [];
  let failedLuatNhanUntil = -1, nextRuleStart = -1, nextRuleEnd = -1;
  const append = (value: string, sourceStart: number, sourceEnd: number) => {
    const previousLength = output.length;
    const result = appendTranslated(output, value, last, capitalizeLines);
    output = result.output; last = result.last;
    if (collectSegments) segments.push({ text: output.slice(previousLength), sourceStart, sourceEnd });
  };
  const appendBoundarySpace = () => {
    output += ' '; last += ' ';
    if (collectSegments && segments.length) segments[segments.length - 1].text += ' ';
  };

  while (index < source.length) {
    let matched = false;
    let allowLuatNhan = true;
    if (source[index] !== '\n' && source[index] !== '\t') {
      for (let size = Math.min(maxDictionaryLength, lookupSource.length - index); size > 0; size--) {
        if (index + size > lookupSource.length) continue;
        const simplifiedPhrase = lookupSource.slice(index, index + size);
        const originalPhrase = source.slice(index, index + size);
        // A traditional source must behave like the equivalent simplified
        // source used by Quick Translator whenever that normalized key exists.
        const phrase = dictionary.has(simplifiedPhrase)
          ? simplifiedPhrase
          : nameDictionary.has(originalPhrase) || originalPhrase.length > 20 && dictionary.has(originalPhrase)
            ? originalPhrase
            : simplifiedPhrase;
        if (dictionary.has(phrase)) {
          const allowedByName = !prioritizedName || !containsName(source, index, size, nameDictionary, maxNameLength)
            && !containsName(lookupSource, index, size, nameDictionary, maxNameLength);
          const allowedByAlgorithm = ![0, 2].includes(algorithm)
            || isLongestPhrase(source, index, size, dictionary, algorithm, maxDictionaryLength)
              && isLongestPhrase(lookupSource, index, size, dictionary, algorithm, maxDictionaryLength)
            || prioritizedName && nameDictionary.has(phrase);
          if (allowedByName && allowedByAlgorithm) {
            const value = dictionary.get(phrase) || '';
            if (value) {
              append(wrapType === 0 ? value : `[${value}]`, index, index + size);
              if (index + size < source.length && isChinese(source[index + size], phienAm, useBuiltIns)) appendBoundarySpace();
            }
            index += size; matched = true; break;
          }
          } else if (!phrase.includes('\n') && !phrase.includes('\t') && allowLuatNhan && size > 2
          && failedLuatNhanUntil < index + size - 1 && isAllChinese(phrase, phienAm, useBuiltIns)) {
          if (index < nextRuleStart) {
            if (nextRuleStart < index + size && size <= nextRuleEnd - nextRuleStart) size = nextRuleStart - index + 1;
          } else {
            const rule = findLuatNhan(phrase, nhanDictionary, rules);
            nextRuleStart = index + (rule?.index ?? -1);
            nextRuleEnd = nextRuleStart + (rule?.length ?? -1);
            if (rule?.index === 0 && isLongestPhrase(lookupSource, index - 1, rule.length - 1, dictionary, algorithm, maxDictionaryLength)) {
              const full = lookupSource.slice(index, index + rule.length);
              const value = translateLuatNhan(full, nhanDictionary, rules);
              if (value !== null) {
              append(wrapType === 0 ? value : `[${value}]`, index, index + rule.length);
                if (index + rule.length < source.length && isChinese(source[index + rule.length], phienAm, useBuiltIns)) appendBoundarySpace();
                index += rule.length; matched = true; break;
              }
            } else if (!rule || rule.index <= 0) {
              failedLuatNhanUntil = index + size - 1;
              allowLuatNhan = false;
            }
          }
        }
      }
    }
    if (matched) continue;
    const previousLength = output.length;
    const char = source[index];
    if (isChinese(char, phienAm, useBuiltIns)) {
      const hanviet = phienAm[char] || getHanVietChar(char);
      append(wrapType === 1 ? `[${hanviet}]` : hanviet, index, index + 1);
      if (index + 1 < source.length && isChinese(source[index + 1], phienAm, useBuiltIns)) appendBoundarySpace();
    } else if ((char === '"' || char === "'") && !/[ .?!\t]$/.test(last) && index < source.length - 1 && source[index + 1] !== ' ' && source[index + 1] !== ',') {
      output += ' ' + char; last += ' ' + char;
    } else {
      output += char; last += char;
    }
    if (collectSegments && !isChinese(char, phienAm, useBuiltIns)) segments.push({ text: output.slice(previousLength), sourceStart: index, sourceEnd: index + 1 });
    index++;
  }
  return {
    text: normalizeVietnameseTypography(output, capitalizeLines),
    segments: capitalizeLines ? capitalizeSegmentLineStarts(segments) : segments,
  };
}

export function quickTranslateOneMeaningForBatch(
  source: string,
  names: NameItem[],
  vietphrase: Record<string, string>,
  options: QuickTranslatorPortOptions = {},
) {
  return quickTranslateOneMeaningForBatchDetailed(source, names, vietphrase, { ...options, collectSegments: false }).text;
}
