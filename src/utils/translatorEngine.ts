/**
 * TTV Translate Core Engine
 * Thuật toán Forward Maximum Matching (FMM) phân đoạn và dịch Vietphrase / Hán Việt
 * Tương thích cơ chế Quick Translator và TTV Translate Android.
 */

import { HANVIET_DICT, getHanVietChar, getPinyinChar } from '../data/hanvietData';
import { DEFAULT_VIETPHRASE } from '../data/vietphraseData';
import { INITIAL_NAMES, NameItem } from '../data/defaultNames';

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
 * Ví dụ: "Đúng."/"Vâng."/"Được." hoặc "đúng/phải/vâng"
 * Trả về nghĩa chính (đầu tiên) và danh sách tất cả các nghĩa thay thế.
 */
export function parseVietphraseMeanings(raw: string): { primary: string; alternatives: string[] } {
  if (!raw) return { primary: '', alternatives: [] };
  if (!raw.includes('/')) {
    const clean = cleanMeaningItem(raw);
    return { primary: clean, alternatives: [clean] };
  }

  const parts = raw.split('/').map(p => cleanMeaningItem(p)).filter(Boolean);
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
 * Ví dụ: raw = "Đúng."/"Vâng."/"Được.", chosenMeaning = "Vâng." -> "Vâng."/"Đúng."/"Được."
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

/**
 * Trình biên dịch chính của TTV Translate
 */
export function convertText(
  source: string,
  userNames: NameItem[] = [],
  userVietphrase: Record<string, string> = {},
  options: {
    prioritizeNames?: boolean;
    capitalizeSentences?: boolean;
  } = {}
): TranslationResult {
  if (!source || !source.trim()) {
    return {
      fullText: '',
      tokens: [],
      hanvietText: '',
      originalText: '',
      paragraphs: []
    };
  }

  // 1. Xây dựng tra cứu Names Map
  const customNamesMap = new Map<string, { viet: string; category: string; isCustom: boolean }>();
  
  // Nạp Initial Names trước
  for (const n of INITIAL_NAMES) {
    customNamesMap.set(n.chinese, {
      viet: n.vietnamese,
      category: n.category,
      isCustom: false
    });
  }

  // Nạp User Names đè lên
  for (const n of userNames) {
    customNamesMap.set(n.chinese, {
      viet: n.vietnamese,
      category: n.category,
      isCustom: true
    });
  }

  // 2. Xây dựng Vietphrase Map
  const mergedVietphrase = new Map<string, { viet: string; isCustom: boolean }>();
  for (const [k, v] of Object.entries(DEFAULT_VIETPHRASE)) {
    mergedVietphrase.set(k, { viet: v, isCustom: false });
  }
  for (const [k, v] of Object.entries(userVietphrase)) {
    mergedVietphrase.set(k, { viet: v, isCustom: true });
  }

  const rawParagraphs = source.split(/\r?\n/);
  const resultParagraphs: TranslationResult['paragraphs'] = [];
  const allTokens: TranslatedToken[] = [];
  const fullTextLines: string[] = [];
  const hanvietLines: string[] = [];

  let tokenIndex = 0;
  const MAX_WINDOW = 12; // Cửa sổ tối đa tìm từ ghép

  for (const p of rawParagraphs) {
    if (!p.trim()) {
      resultParagraphs.push({
        original: '',
        vietphrase: '',
        hanviet: '',
        tokens: []
      });
      fullTextLines.push('');
      hanvietLines.push('');
      continue;
    }

    const pTokens: TranslatedToken[] = [];
    const pVietWords: string[] = [];
    const pHanvietWords: string[] = [];

    let i = 0;
    const len = p.length;

    while (i < len) {
      const char = p[i];

      // Nếu là dấu câu hoặc khoảng trắng
      if (isPunctuationOrSpace(char)) {
        const normPunct = normalizePunctuation(char);
        const token: TranslatedToken = {
          id: `tok-${tokenIndex++}`,
          original: char,
          translated: normPunct,
          hanviet: normPunct,
          pinyin: '',
          isName: false,
          isCustom: false,
          isPunctuation: true
        };
        pTokens.push(token);
        allTokens.push(token);
        pVietWords.push(normPunct);
        pHanvietWords.push(normPunct);
        i++;
        continue;
      }

      // Tìm chuỗi dài nhất khớp trong Name hoặc Vietphrase (Forward Maximum Matching)
      let matched = false;
      const windowLen = Math.min(len - i, MAX_WINDOW);

      for (let w = windowLen; w >= 2; w--) {
        const sub = p.substring(i, i + w);

        // 1. Khớp Name (Tên riêng, môn phái, địa danh)
        if (customNamesMap.has(sub)) {
          const nameInfo = customNamesMap.get(sub)!;
          const translatedName = titleCase(nameInfo.viet);
          
          // Tạo Hán Việt và Pinyin cho cụm
          const hvList: string[] = [];
          const pyList: string[] = [];
          for (const c of sub) {
            hvList.push(getHanVietChar(c));
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
            category: nameInfo.category
          };

          pTokens.push(token);
          allTokens.push(token);
          pVietWords.push(translatedName);
          pHanvietWords.push(hvStr);
          i += w;
          matched = true;
          break;
        }

        // 2. Khớp Vietphrase
        if (mergedVietphrase.has(sub)) {
          const vpInfo = mergedVietphrase.get(sub)!;
          const { primary, alternatives } = parseVietphraseMeanings(vpInfo.viet);
          const hvList: string[] = [];
          const pyList: string[] = [];
          for (const c of sub) {
            hvList.push(getHanVietChar(c));
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
            rawVietphrase: vpInfo.viet
          };

          pTokens.push(token);
          allTokens.push(token);
          pVietWords.push(primary);
          pHanvietWords.push(hvStr);
          i += w;
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // 3. Nếu không khớp cụm dài, tra cứu 1 ký tự đơn
      const singleChar = p[i];
      const hv = getHanVietChar(singleChar);
      const py = getPinyinChar(singleChar);

      // Tra cứu xem có trong Vietphrase 1 từ không
      let singleTranslation = hv;
      let isCust = false;
      let singleAlternatives: string[] | undefined = undefined;
      let singleRawVp: string | undefined = undefined;

      if (customNamesMap.has(singleChar)) {
        const n = customNamesMap.get(singleChar)!;
        singleTranslation = titleCase(n.viet);
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
        rawVietphrase: singleRawVp
      };

      pTokens.push(token);
      allTokens.push(token);
      pVietWords.push(singleTranslation);
      pHanvietWords.push(hv);
      i++;
    }

    // Ghép câu mượt mà
    const joinedViet = cleanAndFormatSentence(pVietWords.join(' '));
    const joinedHanviet = cleanAndFormatSentence(pHanvietWords.join(' '));

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
 * Làm sạch khoảng trắng xung quanh dấu câu và viết hoa đầu câu
 */
export function cleanAndFormatSentence(str: string): string {
  if (!str) return '';
  let res = str
    .replace(/\s+([,.:;!?\)\]])/g, '$1')
    .replace(/([\(\[])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // Viết hoa chữ cái đầu tiên của câu sau dấu chấm, chấm than, chấm hỏi
  res = res.replace(/(^|[.!?]\s+)([a-zà-ỹ])/g, (_, p1, p2) => p1 + p2.toUpperCase());
  return res;
}

/**
 * Tra cứu thông tin chi tiết của 1 từ/cụm từ tiếng Trung
 */
export function inspectChinesePhrase(
  phrase: string,
  userNames: NameItem[] = [],
  userVietphrase: Record<string, string> = {}
) {
  const chars = Array.from(phrase);
  const hanvietList = chars.map(c => getHanVietChar(c));
  const pinyinList = chars.map(c => getPinyinChar(c)).filter(Boolean);

  const hanviet = hanvietList.join(' ');
  const pinyin = pinyinList.join(' ');

  // Kiểm tra đã có trong Name hay chưa
  const inUserNames = userNames.find(n => n.chinese === phrase);
  const inDefaultNames = INITIAL_NAMES.find(n => n.chinese === phrase);
  const existingName = inUserNames || inDefaultNames;

  // Kiểm tra Vietphrase
  const inUserVp = userVietphrase[phrase];
  const inDefaultVp = DEFAULT_VIETPHRASE[phrase];
  const existingVp = inUserVp || inDefaultVp;

  return {
    phrase,
    hanviet,
    hanvietTitle: titleCase(hanviet),
    pinyin,
    existingName: existingName ? existingName.vietnamese : null,
    existingVp: existingVp || null,
    suggestedVietnamese: existingName?.vietnamese || existingVp || titleCase(hanviet)
  };
}
