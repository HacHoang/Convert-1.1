/**
 * TTV Translate Core Engine
 * Thuật toán Forward Maximum Matching (FMM) + QuickTranslator Multiplication Rules (Luật Nhân cấp 2)
 * Xử lý chính xác các trợ từ như 了 (liễu), 的 (đích), 着 (trước), v.v.
 * Tương thích 100% cơ chế Quick Translator và TTV Translate Android.
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
 * Trình biên dịch chính của TTV Translate
 * Áp dụng FMM + Luật Nhân cấp 2 + Bộ lọc quảng cáo
 */
export function convertText(
  source: string,
  userNames: NameItem[] = [],
  userVietphrase: Record<string, string> = {},
  options: {
    prioritizeNames?: boolean;
    capitalizeSentences?: boolean;
    customLuatNhan?: Record<string, string>;
    customPronouns?: Record<string, string>;
    customIgnored?: string[];
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

  // 1. Tiền xử lý: Danh sách cụm từ bỏ qua (giữ nguyên chữ Hán không dịch)
  const ignoredList = [...(options.customIgnored || DEFAULT_IGNORED_PHRASES)].sort((a, b) => b.length - a.length);
  const cleanSource = source;


  // 2. Xây dựng tra cứu Names Map: INITIAL_NAMES -> DEFAULT_NAMES2 -> userNames
  const customNamesMap = new Map<string, { viet: string; category: string; isCustom: boolean }>();
  
  for (const n of INITIAL_NAMES) {
    customNamesMap.set(n.chinese, {
      viet: n.vietnamese,
      category: n.category,
      isCustom: false
    });
  }

  // Nạp Names2 (Tệp Name phụ từ QuickTranslator)
  for (const [k, v] of Object.entries(DEFAULT_NAMES2)) {
    customNamesMap.set(k, {
      viet: v,
      category: 'Nhân vật',
      isCustom: false
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

  // 3. Xây dựng Vietphrase Map
  const mergedVietphrase = new Map<string, { viet: string; isCustom: boolean }>();
  for (const [k, v] of Object.entries(DEFAULT_VIETPHRASE)) {
    mergedVietphrase.set(k, { viet: v, isCustom: false });
  }
  for (const [k, v] of Object.entries(userVietphrase)) {
    mergedVietphrase.set(k, { viet: v, isCustom: true });
  }

  // Chuẩn bị danh sách luật nhân và đại từ (có merge custom nếu có)
  const activePronouns = options.customPronouns ? Object.entries(options.customPronouns) : SORTED_PRONOUNS;
  const activeLuatNhanRules = options.customLuatNhan 
    ? Object.entries({ ...DEFAULT_LUAT_NHAN, ...options.customLuatNhan })
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

    // Tách câu theo dấu ngắt câu tiếng Trung và tiếng Việt: 。！？!?
    const matchedSentences = trimmedLine.match(/[^。！？!?\r\n]+(?:[。！？!?]+["'”’]?|$)/g);
    if (matchedSentences && matchedSentences.length > 0) {
      for (const s of matchedSentences) {
        const trimmedS = s.trim();
        if (trimmedS) {
          sentenceChunks.push(trimmedS);
        }
      }
    } else {
      sentenceChunks.push(trimmedLine);
    }
  }

  const resultParagraphs: TranslationResult['paragraphs'] = [];
  const allTokens: TranslatedToken[] = [];
  const fullTextLines: string[] = [];
  const hanvietLines: string[] = [];

  let tokenIndex = 0;
  const MAX_WINDOW = 12; // Cửa sổ tối đa tìm từ ghép

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
            translated: ign, // Giữ nguyên chữ Hán theo chuẩn QuickTranslator
            hanviet: ign,
            pinyin: '',
            isName: false,
            isCustom: true,
            isPunctuation: false,
            charStart: currentBaseOffset + i,
            charEnd: currentBaseOffset + i + ign.length,
          };
          pTokens.push(token);
          allTokens.push(token);
          pVietWords.push(ign);
          pHanvietWords.push(ign);
          i += ign.length;
          matched = true;
          matchedIgnored = true;
          break;
        }
      }
      if (matchedIgnored) continue;

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
              matchedSubjVn = proVn.split('/')[0];
            }
          }
        }

        // B. Kiểm tra Names nếu chưa khớp đại từ
        if (!matchedSubjCn) {
          for (let nw = Math.min(len - subjIdx, 6); nw >= 2; nw--) {
            const nameSub = p.substring(subjIdx, subjIdx + nw);
            if (customNamesMap.has(nameSub)) {
              matchedSubjCn = nameSub;
              matchedSubjVn = titleCase(customNamesMap.get(nameSub)!.viet);
              break;
            }
          }
        }

        if (matchedSubjCn) {
          const suffixIdx = subjIdx + matchedSubjCn.length;
          if (!rule.suffix || p.startsWith(rule.suffix, suffixIdx)) {
            // Khớp thành công Luật Nhân!
            const totalRuleLen = rule.prefix.length + matchedSubjCn.length + rule.suffix.length;
            const fullMatchedCn = p.substring(i, i + totalRuleLen);
            const translatedVn = rule.patternVn.replace('{0}', matchedSubjVn);

            const hvList: string[] = [];
            for (const c of fullMatchedCn) {
              hvList.push(getHanVietChar(c));
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
      const windowLen = Math.min(len - i, MAX_WINDOW);

      for (let w = windowLen; w >= 2; w--) {
        const sub = p.substring(i, i + w);

        // 2. Khớp Name (Tên riêng, môn phái, địa danh)
        if (customNamesMap.has(sub)) {
          const nameInfo = customNamesMap.get(sub)!;
          const translatedName = titleCase(nameInfo.viet);
          
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
      const hv = getHanVietChar(singleChar);
      const py = getPinyinChar(singleChar);

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

    // Viết hoa chữ cái đầu tiên của câu cho token chữ đầu tiên
    for (const tok of pTokens) {
      if (!tok.isPunctuation && tok.translated) {
        tok.translated = capitalizeFirstLetter(tok.translated);
        tok.hanviet = capitalizeFirstLetter(tok.hanviet);
        break;
      }
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
export function cleanAndFormatSentence(str: string): string {
  if (!str) return '';
  let res = str
    .replace(/\s+([,.:;!?\)\]”’"'])/g, '$1')
    .replace(/([\(\[“‘"'])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // Viết hoa chữ cái đầu tiên của câu
  res = capitalizeFirstLetter(res);

  // Viết hoa chữ cái sau dấu chấm, chấm than, chấm hỏi bên trong
  res = res.replace(/([.!?。！？]\s*)([a-zà-ỹ])/g, (_, p1, p2) => p1 + p2.toUpperCase());
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
  const inDefaultNames2 = DEFAULT_NAMES2[phrase];
  const existingName = inUserNames 
    ? inUserNames.vietnamese 
    : inDefaultNames 
      ? inDefaultNames.vietnamese 
      : inDefaultNames2 || null;

  // Kiểm tra Vietphrase
  const inUserVp = userVietphrase[phrase];
  const inDefaultVp = DEFAULT_VIETPHRASE[phrase];
  const existingVp = inUserVp || inDefaultVp;

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
