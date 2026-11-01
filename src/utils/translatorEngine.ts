import { styleRevision, stylePhraseDictionary, styleNameDictionary, type TranslationStyle } from './translationStyle';
import { filterWebsiteNotices } from './paragraphFilters';
import { assignedMeanings, preferredMeaning, meaningStyleRevision, meaningStyleSnapshot } from './meaningStyles';
/**
 * Hermes Core Engine
 * Thuật toán Forward Maximum Matching (FMM) + QuickTranslator Multiplication Rules (Luật Nhân cấp 2)
 * Xử lý chính xác các trợ từ như 了 (liễu), 的 (đích), 着 (trước), v.v.
 * Offline dictionary conversion inspired by QuickTranslator data formats.
 */

import { HANVIET_DICT, getHanVietChar, getPinyinChar } from '../data/hanvietData';
import { DEFAULT_VIETPHRASE } from '../data/vietphraseData';
import { INITIAL_NAMES, NameItem } from '../data/defaultNames';
import { 
  DEFAULT_PRONOUNS, 
  DEFAULT_LUAT_NHAN, 
  DEFAULT_IGNORED_PHRASES, 
  DEFAULT_NAMES2 
} from '../data/quickTranslatorData';

export interface TranslatedToken {
  id: string;
  original: string;
  translated: string;
  hanviet: string;
  pinyin: string;
  isName: boolean;
  isCustom: boolean;
  isPunctuation: boolean;
  category?: string;
  alternatives?: string[];
  rawVietphrase?: string;
  charStart?: number;
  charEnd?: number;
}

/** Shared spacing for on-screen tokens, copying, saving and speech. */
export function separatorBeforeToken(tokens: TranslatedToken[], index: number, overrides: Record<string, string> = {}): string {
  const current = (overrides[tokens[index].id] ?? tokens[index].translated).trim();
  if (!current) return '';
  let previous = index - 1;
  while (previous >= 0 && !(overrides[tokens[previous].id] ?? tokens[previous].translated).trim()) previous--;
  if (previous < 0) return '';
  const opens = (token: TranslatedToken, at: number) => {
    if (!token.isPunctuation) return false;
    if (/^[“‘「『《（【(\[]$/.test(token.original)) return true;
    if (/^["']$/.test(token.original)) return tokens.slice(0, at + 1).filter(t => t.isPunctuation && t.original === token.original).length % 2 === 1;
    return false;
  };
  if (opens(tokens[previous], previous)) return '';
  if (tokens[index].isPunctuation && !opens(tokens[index], index) && /^[,.:;!?\)\]"'”’]/.test(current)) return '';
  return ' ';
}

export function formatTranslatedTokens(tokens: TranslatedToken[], overrides: Record<string, string> = {}): string {
  return tokens.map((token, index) => separatorBeforeToken(tokens, index, overrides) + (overrides[token.id] ?? token.translated).trim()).join('');
}

/**
 * Làm sạch ký tự bao bọc một nghĩa (nháy kép, nháy đơn, khoảng trắng thừa)
 */
export function cleanMeaningItem(str: string): string {
  let s = str.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  } else if (s.startsWith('“') && s.endsWith('”')) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Phân tích cụm Vietphrase có nhiều nghĩa (phân tách bởi dấu '/')
 * Hỗ trợ chuẩn QuickTranslator:
 * Nếu chuỗi bắt đầu bằng '/' (ví dụ: "/liễu" hoặc "/liễu/rồi" hoặc "như thế/kéo//đích")
 * thì nghĩa chính đầu tiên là RỖNG "" (lược bỏ trợ từ), các nghĩa sau là nghĩa thay thế.
 */
export function parseVietphraseMeanings(raw: string): { primary: string; alternatives: string[] } {
  if (!raw) return { primary: '', alternatives: [] };

  // Trường hợp bắt đầu bằng '/': quy ước QuickTranslator nghĩa chính là rỗng (lược bỏ trợ từ)
  if (raw.startsWith('/')) {
    const rawParts = raw.split('/').map(p => cleanMeaningItem(p));
    const nonEmpties = rawParts.filter(Boolean);
    return {
      primary: '',
      alternatives: nonEmpties.length > 0 ? nonEmpties : ['']
    };
  }

  if (!raw.includes('/')) {
    const clean = cleanMeaningItem(raw);
    return { primary: clean, alternatives: [clean] };
  }

  const rawParts = raw.split('/').map(p => cleanMeaningItem(p));
  if (rawParts[0] === '') {
    const nonEmpties = rawParts.filter(Boolean);
    return {
      primary: '',
      alternatives: nonEmpties.length > 0 ? nonEmpties : ['']
    };
  }

  const parts = rawParts.filter(Boolean);
  if (parts.length === 0) {
    const clean = cleanMeaningItem(raw);
    return { primary: clean, alternatives: [clean] };
  }

  return {
    primary: parts[0],
    alternatives: parts,
  };
}

/**
 * Tái sắp xếp thứ tự nghĩa trong chuỗi Vietphrase từ điển khi người dùng chọn nghĩa ưu tiên
 */
export function reorderVietphraseMeanings(raw: string, chosenMeaning: string): string {
  const { alternatives } = parseVietphraseMeanings(raw);
  const cleanChosen = cleanMeaningItem(chosenMeaning);

  const remaining = alternatives.filter(a => a.toLowerCase() !== cleanChosen.toLowerCase());
  const newOrder = [cleanChosen, ...remaining];

  const hasQuotes = raw.includes('"') || raw.includes('“');
  if (hasQuotes) {
    return newOrder.map(m => `"${m}"`).join('/');
  }
  return newOrder.join('/');
}

export interface TranslationResult {
  fullText: string;
  tokens: TranslatedToken[];
  hanvietText: string;
  originalText: string;
  paragraphs: Array<{
    original: string;
    vietphrase: string;
    hanviet: string;
    tokens: TranslatedToken[];
  }>;
}

// Chuyển ký tự đầu thành chữ hoa
export function capitalizeWord(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Viết hoa từng từ trong tên riêng (Title Case)
export function titleCase(str: string): string {
  if (!str) return '';
  return str
    .split(/\s+/)
    .map(w => capitalizeWord(w))
    .join(' ');
}

// Kiểm tra ký tự phân cách / dấu câu
const PUNCTUATION_REGEX = /^[，。！？；：“”‘’（）《》【】…—、\s\n\r\t.,!?;:'"()[\]\-_/\\]$/;

export function isPunctuationOrSpace(char: string): boolean {
  return PUNCTUATION_REGEX.test(char);
}

// Thay thế dấu câu tiếng Trung sang dấu câu tiếng Việt chuẩn
const PUNCT_MAP: Record<string, string> = {
  '，': ', ',
  '。': '. ',
  '！': '! ',
  '？': '? ',
  '；': '; ',
  '：': ': ',
  '“': ' "',
  '”': '" ',
  '‘': " '",
  '’': "' ",
  '（': ' (',
  '）': ') ',
  '《': ' "',
  '》': '" ',
  '【': ' [',
  '】': '] ',
  '、': ', ',
  '…': '...',
  '—': ' - ',
};

export function normalizePunctuation(char: string): string {
  return PUNCT_MAP[char] || char;
}

// Cấu trúc luật nhân đã phân tích
interface ParsedRule {
  prefix: string;
  suffix: string;
  patternVn: string;
  totalLength: number;
}

// Danh sách luật nhân tiền xử lý
const PARSED_LUAT_NHAN_RULES: ParsedRule[] = Object.entries(DEFAULT_LUAT_NHAN)
  .filter(([k]) => k.includes('{0}'))
  .map(([k, v]) => {
    const [prefix, suffix] = k.split('{0}');
    return {
      prefix: prefix || '',
      suffix: suffix || '',
      patternVn: v,
      totalLength: (prefix || '').length + (suffix || '').length
    };
  })
  .sort((a, b) => b.totalLength - a.totalLength);

// Danh sách đại từ sắp xếp theo độ dài giảm dần
const SORTED_PRONOUNS = Object.entries(DEFAULT_PRONOUNS)
  .sort((a, b) => b[0].length - a[0].length);

/**
 * Trình biên dịch chính của Hermes
 * Áp dụng FMM + Luật Nhân cấp 2 + Bộ lọc quảng cáo
 */
const EMPTY_NAMES: NameItem[] = [];
const namesCache = new WeakMap<NameItem[], Map<string, { viet: string; category: string; isCustom: boolean }>>();
const mainNamesCache = new WeakMap<Record<string, string>, typeof namesCache>();
const phraseCache = new WeakMap<Record<string, string>, Map<TranslationStyle, Map<string, { viet: string; isCustom: boolean }>>>();
const cachedStyleRevisions = new WeakMap<object, number>();
const lengthIndexes = new WeakMap<object, Map<string, number[]>>();
function dictionaryLengths(dictionary: Map<string, unknown>) {
  const cached = lengthIndexes.get(dictionary);
  if (cached) return cached;
  const sets = new Map<string, Set<number>>();
  for (const key of dictionary.keys()) {
    if (!key) continue;
    if (!sets.has(key[0])) sets.set(key[0], new Set());
    sets.get(key[0])!.add(key.length);
  }
  const index = new Map([...sets].map(([char, lengths]) => [char, [...lengths].sort((a, b) => b - a)]));
  lengthIndexes.set(dictionary, index);
  return index;
}

export function convertText(
  source: string,
  userNames: NameItem[] = EMPTY_NAMES,
  userVietphrase: Record<string, string> = DEFAULT_VIETPHRASE,
  options: {
    style?: TranslationStyle;
    prioritizeNames?: boolean;
    capitalizeSentences?: boolean;
    customLuatNhan?: Record<string, string>;
    customPronouns?: Record<string, string>;
    customIgnored?: string[];
    namesMainMap?: Record<string, string>;
    customPhienAm?: Record<string, string>;
  } = {}
): TranslationResult {
  const hanvietChar = (char: string) => options.customPhienAm ? options.customPhienAm[char] ?? char : getHanVietChar(char);
  if (!source || !source.trim()) {
    return {
      fullText: '',
      tokens: [],
      hanvietText: '',
      originalText: '',
      paragraphs: []
    };
  }

  // 1. Tiền xử lý: Danh sách cụm từ bỏ qua (giữ nguyên chữ Hán không dịch)
  const ignoredList = [...(options.customIgnored || DEFAULT_IGNORED_PHRASES)].sort((a, b) => b.length - a.length);
  // Hide a copied home breadcrumb only when it directly precedes a chapter heading.
  // Mask rather than remove it so selection offsets still refer to the original text.
  const cleanSource = filterWebsiteNotices(source, true).replace(
    /^(\s*(?:首页|首頁|主页|主頁)\s*[/／>›»|]\s*)(?=第\s*[0-9零〇一二两兩三四五六七八九十百千万萬]+\s*[章回节節卷])/u,
    prefix => prefix.replace(/[^\r\n]/g, ' '),
  );


  // 2. Xây dựng tra cứu Names Map: INITIAL_NAMES -> DEFAULT_NAMES2 -> userNames
  let activeNamesCache = namesCache;
  if (options.namesMainMap) {
    if (!mainNamesCache.has(options.namesMainMap)) mainNamesCache.set(options.namesMainMap, new WeakMap());
    activeNamesCache = mainNamesCache.get(options.namesMainMap)!;
  }
  let customNamesMap = activeNamesCache.get(userNames);
  if (!customNamesMap) {
  customNamesMap = new Map<string, { viet: string; category: string; isCustom: boolean }>();
  
  for (const n of options.namesMainMap ? [] : INITIAL_NAMES) {
    customNamesMap.set(n.chinese, {
      viet: n.vietnamese,
      category: n.category,
      isCustom: false
    });
  }

  // Nạp Names2 (Tệp Name phụ từ QuickTranslator)
  for (const [k, v] of Object.entries(options.namesMainMap || DEFAULT_NAMES2)) {
    customNamesMap.set(k, {
      viet: v,
      category: 'Nhân vật',
      isCustom: Boolean(options.namesMainMap)
    });
  }

  // Nạp User Names đè lên trên cùng
  for (const n of userNames) {
    customNamesMap.set(n.chinese, {
      viet: n.vietnamese,
      category: n.category,
      isCustom: true
    });
  }

  activeNamesCache.set(userNames, customNamesMap);
  }

  // 3. Xây dựng Vietphrase Map
  const style = options.style || 'neutral';
  const styleNames = Object.entries(styleNameDictionary(style));
  if (styleNames.length) {
    customNamesMap = new Map(customNamesMap);
    for (const [chinese, viet] of styleNames) {
      if (!customNamesMap.get(chinese)?.isCustom) {
        customNamesMap.set(chinese, { viet, category: 'Nhân vật', isCustom: false });
      }
    }
  }
  const secondaryKeys = new Set(userNames.map(name => name.chinese));
  let namesCloned = false;
  for (const kind of ['names_main', 'names'] as const) {
    for (const key of Object.keys(meaningStyleSnapshot()[kind] || {})) {
      if ((kind === 'names') !== secondaryKeys.has(key)) continue;
      const existing = customNamesMap.get(key);
      const selected = preferredMeaning(kind, key, style);
      if (existing && selected !== undefined && parseVietphraseMeanings(existing.viet).alternatives.includes(selected)) {
        if (!namesCloned) { customNamesMap = new Map(customNamesMap); namesCloned = true; }
        customNamesMap.set(key, { ...existing, viet: selected });
      }
    }
  }
  const dictionaryRevision = styleRevision() + meaningStyleRevision();
  if (cachedStyleRevisions.get(userVietphrase) !== dictionaryRevision) {
    phraseCache.delete(userVietphrase);
    cachedStyleRevisions.set(userVietphrase, dictionaryRevision);
  }
  const stylePhrases = stylePhraseDictionary(style);
  let mergedVietphrase = phraseCache.get(userVietphrase)?.get(style);
  if (!mergedVietphrase) {
  mergedVietphrase = new Map<string, { viet: string; isCustom: boolean }>();
  // An explicitly supplied dictionary is authoritative, including an empty one.
  for (const [k, v] of Object.entries(userVietphrase)) {
    mergedVietphrase.set(k, { viet: v, isCustom: true });
  }

  for (const [key, value] of Object.entries(stylePhrases)) {
    if (assignedMeanings('vietphrase', key)) continue;
    const existing = mergedVietphrase.get(key);
    const original = existing?.viet || '';
    // Keep the source meanings available for inspection and manual selection.
    const alternatives = original.split('/').filter(meaning => meaning.trim() && meaning.trim() !== value);
    mergedVietphrase.set(key, { viet: [value, ...alternatives].join('/'), isCustom: false });
  }
  for (const key of Object.keys(meaningStyleSnapshot().vietphrase || {})) {
    const existing = mergedVietphrase.get(key);
    const selected = preferredMeaning('vietphrase', key, style);
    if (existing && selected !== undefined && parseVietphraseMeanings(existing.viet).alternatives.includes(selected)) {
      const others = parseVietphraseMeanings(existing.viet).alternatives.filter(meaning => meaning !== selected);
      mergedVietphrase.set(key, { ...existing, viet: [selected, ...others].join('/') });
    }
  }
  if (!phraseCache.has(userVietphrase)) phraseCache.set(userVietphrase, new Map());
  // Retain only one compiled style per dictionary; switching must not triple the large map.
  phraseCache.get(userVietphrase)!.clear();
  phraseCache.get(userVietphrase)!.set(style, mergedVietphrase);
  }

  // Chuẩn bị danh sách luật nhân và đại từ (có merge custom nếu có)
  const activePronouns = options.customPronouns ? Object.entries(options.customPronouns) : SORTED_PRONOUNS;
  const activeLuatNhanRules = options.customLuatNhan 
    ? Object.entries(options.customLuatNhan)
        .filter(([k]) => k.includes('{0}'))
        .map(([k, v]) => {
          const [prefix, suffix] = k.split('{0}');
          return {
            prefix: prefix || '',
            suffix: suffix || '',
            patternVn: v,
            totalLength: (prefix || '').length + (suffix || '').length
          };
        })
        .sort((a, b) => b.totalLength - a.totalLength)
    : PARSED_LUAT_NHAN_RULES;

  // 4. Phân tách văn bản thành từng câu riêng biệt dựa vào các dấu kết thúc câu: 。！？!?
  const rawLines = cleanSource.split(/\r?\n/);
  const sentenceChunks: string[] = [];

  for (const line of rawLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Keep source paragraphs intact, including quotes and punctuation in keys.
    sentenceChunks.push(trimmedLine);
  }

  const resultParagraphs: TranslationResult['paragraphs'] = [];
  const allTokens: TranslatedToken[] = [];
  const fullTextLines: string[] = [];
  const hanvietLines: string[] = [];

  let tokenIndex = 0;
  const nameLengths = dictionaryLengths(customNamesMap);
  const phraseLengths = dictionaryLengths(mergedVietphrase);

  let lastSearchIndex = 0;
  for (const p of sentenceChunks) {
    const pTokens: TranslatedToken[] = [];
    const pVietWords: string[] = [];
    const pHanvietWords: string[] = [];

    const pStart = cleanSource.indexOf(p, lastSearchIndex);
    if (pStart !== -1) {
      lastSearchIndex = pStart + p.length;
    }
    const currentBaseOffset = pStart !== -1 ? pStart : 0;

    let i = 0;
    const len = p.length;

    while (i < len) {
      const char = p[i];
      const lengths = [...new Set([...(nameLengths.get(char) || []), ...(phraseLengths.get(char) || [])])]
        .filter(length => length <= len - i).sort((a, b) => b - a);
      const directLength = lengths.find(length => customNamesMap.has(p.slice(i, i + length)) || mergedVietphrase.has(p.slice(i, i + length))) || 0;
      const preferredNameLength = options.prioritizeNames
        ? (nameLengths.get(char) || []).find(length => length <= len - i && customNamesMap.has(p.slice(i, i + length))) || 0 : 0;

      // Nếu là dấu câu hoặc khoảng trắng
      if (isPunctuationOrSpace(char) && directLength < 2) {
        const normPunct = normalizePunctuation(char);
        const token: TranslatedToken = {
          id: `tok-${tokenIndex++}`,
          original: char,
          translated: normPunct,
          hanviet: normPunct,
          pinyin: '',
          isName: false,
          isCustom: false,
          isPunctuation: true,
          charStart: currentBaseOffset + i,
          charEnd: currentBaseOffset + i + 1,
        };
        pTokens.push(token);
        allTokens.push(token);
        pVietWords.push(normPunct);
        pHanvietWords.push(normPunct);
        i++;
        continue;
      }

      let matched = false;

      // ƯU TIÊN 0: Cụm từ Bỏ qua (IgnoredChinesePhrases - Giữ nguyên chữ Hán gốc, không dịch)
      let matchedIgnored = false;
      for (const ign of ignoredList) {
        if (ign && p.startsWith(ign, i)) {
          const token: TranslatedToken = {
            id: `tok-${tokenIndex++}`,
            original: ign,
            translated: '', // Omit ignored phrases without changing source offsets
            hanviet: '',
            pinyin: '',
            isName: false,
            isCustom: true,
            isPunctuation: false,
            charStart: currentBaseOffset + i,
            charEnd: currentBaseOffset + i + ign.length,
          };
          pTokens.push(token);
          allTokens.push(token);


          i += ign.length;
          matched = true;
          matchedIgnored = true;
          break;
        }
      }
      if (matchedIgnored) continue;

      // Keep Latin words, Vietnamese diacritics and numeric runs intact.
      const literal = p.slice(i).match(/^[\p{Script=Latin}\p{M}\p{N}]+/u)?.[0];
      if (literal && directLength < 2) {
        const token: TranslatedToken = { id: `tok-${tokenIndex++}`, original: literal, translated: literal, hanviet: literal, pinyin: '', isName: false, isCustom: false, isPunctuation: false, charStart: currentBaseOffset + i, charEnd: currentBaseOffset + i + literal.length };
        pTokens.push(token); allTokens.push(token);
        pVietWords.push(literal); pHanvietWords.push(literal);
        i += literal.length;
        continue;
      }


      // ƯU TIÊN 1: So khớp THUẬT TOÁN NHÂN (Luật Nhân cấp 2: Pronouns + Names)
      for (const rule of activeLuatNhanRules) {
        if (rule.prefix && !p.startsWith(rule.prefix, i)) {
          continue;
        }

        const subjIdx = i + rule.prefix.length;
        if (subjIdx >= len) continue;

        let matchedSubjCn = '';
        let matchedSubjVn = '';

        // A. Kiểm tra Pronouns trước
        for (const [proCn, proVn] of activePronouns) {
          if (p.startsWith(proCn, subjIdx)) {
            if (proCn.length > matchedSubjCn.length) {
              matchedSubjCn = proCn;
              matchedSubjVn = (stylePhrases[proCn] ?? proVn).split('/')[0];
            }
          }
        }

        // B. Kiểm tra Names nếu chưa khớp đại từ
        {
          for (const nw of nameLengths.get(p[subjIdx]) || []) {
            if (nw > len - subjIdx) continue;
            const nameSub = p.substring(subjIdx, subjIdx + nw);
            if (customNamesMap.has(nameSub)) {
              if (nameSub.length > matchedSubjCn.length) {
                matchedSubjCn = nameSub;
                matchedSubjVn = titleCase(parseVietphraseMeanings(customNamesMap.get(nameSub)!.viet).primary);
              }
              break;
            }
          }
        }

        if (matchedSubjCn) {
          const suffixIdx = subjIdx + matchedSubjCn.length;
          if (!rule.suffix || p.startsWith(rule.suffix, suffixIdx)) {
            // Khớp thành công Luật Nhân!
            const totalRuleLen = rule.prefix.length + matchedSubjCn.length + rule.suffix.length;
            // An explicit phrase wins ties; Name priority must also apply here.
            if (preferredNameLength || totalRuleLen <= directLength) continue;
            const fullMatchedCn = p.substring(i, i + totalRuleLen);
            const translatedVn = parseVietphraseMeanings(rule.patternVn).primary.replaceAll('{0}', matchedSubjVn);

            const hvList: string[] = [];
            for (const c of fullMatchedCn) {
              hvList.push(hanvietChar(c));
            }
            const hvStr = hvList.join(' ');

            const token: TranslatedToken = {
              id: `tok-${tokenIndex++}`,
              original: fullMatchedCn,
              translated: translatedVn,
              hanviet: hvStr,
              pinyin: '',
              isName: false,
              isCustom: false,
              isPunctuation: false,
              charStart: currentBaseOffset + i,
              charEnd: currentBaseOffset + i + totalRuleLen,
            };

            pTokens.push(token);
            allTokens.push(token);
            pVietWords.push(translatedVn);
            pHanvietWords.push(hvStr);
            i += totalRuleLen;
            matched = true;
            break;
          }
        }
      }

      if (matched) continue;

      // ƯU TIÊN 2 & 3: Tìm chuỗi dài nhất khớp trong Name hoặc Vietphrase (Forward Maximum Matching)
      for (const w of preferredNameLength ? [preferredNameLength] : lengths) {
        if (w < 1 || w > len - i) continue;
        const sub = p.substring(i, i + w);

        // 2. Khớp Name (Tên riêng, môn phái, địa danh)
        if (customNamesMap.has(sub)) {
          const nameInfo = customNamesMap.get(sub)!;
          const translatedName = titleCase(parseVietphraseMeanings(nameInfo.viet).primary);
          
          const hvList: string[] = [];
          const pyList: string[] = [];
          for (const c of sub) {
            hvList.push(hanvietChar(c));
            pyList.push(getPinyinChar(c));
          }
          const hvStr = titleCase(hvList.join(' '));
          const pyStr = pyList.filter(Boolean).join(' ');

          const token: TranslatedToken = {
            id: `tok-${tokenIndex++}`,
            original: sub,
            translated: translatedName,
            hanviet: hvStr,
            pinyin: pyStr,
            isName: true,
            isCustom: nameInfo.isCustom,
            isPunctuation: false,
            category: nameInfo.category,
            charStart: currentBaseOffset + i,
            charEnd: currentBaseOffset + i + w,
          };

          pTokens.push(token);
          allTokens.push(token);
          pVietWords.push(translatedName);
          pHanvietWords.push(hvStr);
          i += w;
          matched = true;
          break;
        }

        // 3. Khớp Vietphrase
        if (mergedVietphrase.has(sub)) {
          const vpInfo = mergedVietphrase.get(sub)!;
          const { primary, alternatives } = parseVietphraseMeanings(vpInfo.viet);
          const hvList: string[] = [];
          const pyList: string[] = [];
          for (const c of sub) {
            hvList.push(hanvietChar(c));
            pyList.push(getPinyinChar(c));
          }
          const hvStr = hvList.join(' ');
          const pyStr = pyList.filter(Boolean).join(' ');

          const token: TranslatedToken = {
            id: `tok-${tokenIndex++}`,
            original: sub,
            translated: primary,
            hanviet: hvStr,
            pinyin: pyStr,
            isName: false,
            isCustom: vpInfo.isCustom,
            isPunctuation: false,
            alternatives,
            rawVietphrase: vpInfo.viet,
            charStart: currentBaseOffset + i,
            charEnd: currentBaseOffset + i + w,
          };

          pTokens.push(token);
          allTokens.push(token);
          if (primary !== '') {
            pVietWords.push(primary);
          }
          pHanvietWords.push(hvStr);
          i += w;
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // 4. Nếu không khớp cụm dài, tra cứu 1 ký tự đơn
      const singleChar = p[i];
      const hv = hanvietChar(singleChar);
      const py = getPinyinChar(singleChar);

      let singleTranslation = hv;
      let isCust = false;
      let singleAlternatives: string[] | undefined = undefined;
      let singleRawVp: string | undefined = undefined;

      if (customNamesMap.has(singleChar)) {
        const n = customNamesMap.get(singleChar)!;
        singleTranslation = titleCase(parseVietphraseMeanings(n.viet).primary);
        isCust = n.isCustom;
      } else if (mergedVietphrase.has(singleChar)) {
        const vp = mergedVietphrase.get(singleChar)!;
        const parsed = parseVietphraseMeanings(vp.viet);
        singleTranslation = parsed.primary;
        singleAlternatives = parsed.alternatives;
        singleRawVp = vp.viet;
        isCust = vp.isCustom;
      }

      const token: TranslatedToken = {
        id: `tok-${tokenIndex++}`,
        original: singleChar,
        translated: singleTranslation,
        hanviet: hv,
        pinyin: py,
        isName: customNamesMap.has(singleChar),
        isCustom: isCust,
        isPunctuation: false,
        alternatives: singleAlternatives,
        rawVietphrase: singleRawVp,
        charStart: currentBaseOffset + i,
        charEnd: currentBaseOffset + i + 1,
      };

      pTokens.push(token);
      allTokens.push(token);
      if (singleTranslation !== '') {
        pVietWords.push(singleTranslation);
      }
      pHanvietWords.push(hv);
      i++;
    }

    if (options.capitalizeSentences !== false) {
      let start = true;
      for (const tok of pTokens) {
        if (!tok.isPunctuation && tok.translated && start) {
          tok.translated = capitalizeFirstLetter(tok.translated);
          tok.hanviet = capitalizeFirstLetter(tok.hanviet);
          start = false;
        }
        if (/[。！？.!?]/.test(tok.original) && tok.isPunctuation) start = true;
      }
    }

    // Ghép câu mượt mà
    const joinedViet = formatTranslatedTokens(pTokens);
    const joinedHanviet = cleanAndFormatSentence(pHanvietWords.join(' '), options.capitalizeSentences !== false);

    resultParagraphs.push({
      original: p,
      vietphrase: joinedViet,
      hanviet: joinedHanviet,
      tokens: pTokens
    });

    fullTextLines.push(joinedViet);
    hanvietLines.push(joinedHanviet);
  }

  return {
    fullText: fullTextLines.join('\n\n'),
    tokens: allTokens,
    hanvietText: hanvietLines.join('\n\n'),
    originalText: source,
    paragraphs: resultParagraphs
  };
}

/**
 * Viết hoa chữ cái đầu tiên (bỏ qua ký tự mở đầu như dấu ngoặc, nháy nếu có)
 */
export function capitalizeFirstLetter(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  const match = trimmed.match(/^([^a-zA-Zà-ỹÀ-Ỹ]*)([a-zA-Zà-ỹÀ-Ỹ])(.*)$/s);
  if (match) {
    const prefix = match[1];
    const firstChar = match[2].toUpperCase();
    const rest = match[3];
    return prefix + firstChar + rest;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Làm sạch khoảng trắng xung quanh dấu câu và viết hoa đầu câu
 */
export function cleanAndFormatSentence(str: string, capitalize = true): string {
  if (!str) return '';
  let res = str
    .replace(/\s+([,.:;!?\)\]”’"'])/g, '$1')
    .replace(/([\(\[“‘"'])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // Viết hoa chữ cái đầu tiên của câu
  if (capitalize) res = capitalizeFirstLetter(res);

  // Viết hoa chữ cái sau dấu chấm, chấm than, chấm hỏi bên trong
  if (capitalize) res = res.replace(/([.!?。！？]\s*)([a-zà-ỹ])/g, (_, p1, p2) => p1 + p2.toUpperCase());
  return res;
}

/**
 * Tra cứu thông tin chi tiết của 1 từ/cụm từ tiếng Trung
 */
export function inspectChinesePhrase(
  phrase: string,
  userNames: NameItem[] = [],
  userVietphrase: Record<string, string> = DEFAULT_VIETPHRASE,
  dictionaries: { namesMainMap?: Record<string, string>; customPhienAm?: Record<string, string> } = {},
) {
  const chars = Array.from(phrase);
  const hanvietList = chars.map(c => dictionaries.customPhienAm ? dictionaries.customPhienAm[c] ?? c : getHanVietChar(c));
  const pinyinList = chars.map(c => getPinyinChar(c)).filter(Boolean);

  const hanviet = hanvietList.join(' ');
  const pinyin = pinyinList.join(' ');

  // Kiểm tra đã có trong Name hay chưa
  const inUserNames = userNames.find(n => n.chinese === phrase);
  const inDefaultNames = dictionaries.namesMainMap ? undefined : INITIAL_NAMES.find(n => n.chinese === phrase);
  const inDefaultNames2 = dictionaries.namesMainMap ? dictionaries.namesMainMap[phrase] : DEFAULT_NAMES2[phrase];
  const existingName = inUserNames 
    ? inUserNames.vietnamese 
    : inDefaultNames 
      ? inDefaultNames.vietnamese 
      : inDefaultNames2 || null;

  // Kiểm tra Vietphrase
  const inUserVp = userVietphrase[phrase];
  const existingVp = inUserVp;

  return {
    phrase,
    hanviet,
    hanvietTitle: titleCase(hanviet),
    pinyin,
    existingName,
    existingVp: existingVp || null,
    suggestedVietnamese: existingName || existingVp || titleCase(hanviet)
  };
}
