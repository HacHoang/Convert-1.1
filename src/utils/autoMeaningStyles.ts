import { STYLE_PHRASES, type TranslationStyle } from './translationStyle';
import { parseVietphraseMeanings } from './translatorEngine';
import type { MeaningKind, MeaningStyle } from './meaningStyles';

export const AUTO_STYLE_VERSION = 'meaning-rules-v1';
const normalize = (value: string) => value.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
const archaic: TranslationStyle[] = ['classical', 'cultivation', 'martial', 'historical'];
type Rule = { styles: TranslationStyle[]; expression: RegExp };
const boundary = (words: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${words})(?=$|[^\\p{L}\\p{N}])`, 'u');
const rules: Rule[] = [
  { styles: ['classical', 'cultivation'], expression: boundary('tu tiên|tu sĩ|tu luyện|linh khí|linh lực|linh căn|linh thạch|nguyên anh|kim đan|trúc cơ|độ kiếp|phi thăng|nguyên thần|tiên giới|pháp bảo|thần thức|đan điền|động phủ|đạo hữu') },
  { styles: ['classical', 'martial'], expression: boundary('võ lâm|võ công|khinh công|nội lực|kiếm pháp|chưởng pháp|giang hồ|đại hiệp|thiếu hiệp|kiếm hiệp|võ hiệp|chưởng môn|bang chủ') },
  { styles: ['classical', 'historical'], expression: boundary('trẫm|bổn cung|bệ hạ|hoàng hậu|hoàng đế|thái hậu|hoàng cung|thừa tướng|thánh chỉ|hậu cung|nô tỳ|nô tài|công công|cung nữ|quý phi|vương gia|hoàng tử|điện hạ') },
  { styles: ['western'], expression: boundary('ma pháp|pháp sư|tinh linh|người lùn|kỵ sĩ|công tước|bá tước|nam tước|tử tước|đũa phép|giáo hoàng|giáo đình|lâu đài') },
  { styles: ['korean'], expression: boundary('oppa|eonni|noona|chaebol|seoul|busan|hàn quốc') },
  { styles: ['japanese'], expression: boundary('senpai|kouhai|sensei|shogun|samurai|ninja|miko|tokyo|osaka|kyoto|nhật bản|đền thần đạo') },
  { styles: ['modern', 'scifi'], expression: boundary('vũ trụ|tàu không gian|phi thuyền|liên sao|giáp máy|cơ giáp|trí tuệ nhân tạo|hố giun|năm ánh sáng|lượng tử') },
  { styles: ['gaming'], expression: boundary('điểm kinh nghiệm|điểm máu|điểm mana|phó bản|hồi chiêu|người chơi|võng du|npc|mmorpg|game online') },
  { styles: ['horror'], expression: boundary('ác quỷ|hồn ma|oán linh|vong hồn|quỷ hồn|trừ tà|kinh dị|ma quái|tà linh|linh dị|âm hồn') },
  { styles: ['modern', 'romance'], expression: boundary('hẹn hò|tỏ tình|yêu đương|bạn trai|bạn gái|người yêu|yêu thầm') },
  { styles: ['modern'], expression: boundary('điện thoại|máy tính|internet|email|mạng xã hội|siêu thị|xe buýt|ô tô|tivi|truyền hình|cảnh sát|bệnh viện|công ty|giám đốc|thẻ tín dụng|tàu điện|căn cước') },
];
// These are everyday concepts, not enough evidence for a specific genre on their own.
const ambiguousSeeds = new Set(['能量', '基因', '技能', '等级', '任务', '属性', '装备', '出道', '偶像', '尸体', '分手', '未婚夫', '未婚妻', '社团']);
const seedStyles = new Map<string, TranslationStyle[]>();
for (const [style, entries] of Object.entries(STYLE_PHRASES)) for (const [chinese, meaning] of Object.entries(entries)) {
  if (ambiguousSeeds.has(chinese)) continue;
  const key = `${chinese}\0${normalize(meaning)}`;
  seedStyles.set(key, [...(seedStyles.get(key) || []), style as TranslationStyle]);
}

/** Classify meanings independently: do not infer a person's culture from a surname. */
export function autoMeaningStyles(kind: MeaningKind, chinese: string, raw: string, manual?: MeaningStyle[]): MeaningStyle[] {
  const parsed = parseVietphraseMeanings(raw);
  const meanings = [...new Set([parsed.primary, ...parsed.alternatives])];
  return meanings.map(meaning => {
    const saved = manual?.find(row => row.meaning === meaning);
    if (saved && !saved.automatic) return { meaning, styles: [...saved.styles] };
    const value = normalize(meaning);
    const tags = new Set<TranslationStyle>(seedStyles.get(`${chinese}\0${value}`) || []);
    if (/^(ta|ngươi|hắn|nàng|các ngươi|bọn họ|các nàng|phụ thân|mẫu thân|huynh|tỷ|đa tạ|thất lễ|tiên sinh|tiểu thư|phu nhân)$/.test(value)) archaic.forEach(style => tags.add(style));
    if (/^(tôi|chúng tôi|các bạn|anh ấy|cô ấy|bố|mẹ|cảm ơn|xin lỗi)$/.test(value)) tags.add('modern');
    for (const rule of rules) if (rule.expression.test(value)) rule.styles.forEach(style => tags.add(style));
    if (/[\uac00-\ud7af]/u.test(meaning)) tags.add('korean');
    if (/[\u3040-\u30ff]/u.test(meaning)) tags.add('japanese');
    if (kind !== 'vietphrase' && /宗$/.test(chinese) && boundary('tông|tông môn').test(value)) { tags.add('classical'); tags.add('cultivation'); tags.add('martial'); }
    return { meaning, styles: tags.size ? [...tags] : ['neutral'], automatic: true };
  });
}
