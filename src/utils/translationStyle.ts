export type TranslationStyle = 'neutral' | 'classical' | 'modern' | 'cultivation' | 'martial' | 'historical' | 'western' | 'korean' | 'japanese' | 'scifi' | 'gaming' | 'horror' | 'romance';
export type TranslationStyleChoice = TranslationStyle | 'auto';
export const STYLE_LABELS = { auto: 'Theo thể loại', neutral: 'Trung tính', classical: 'Cổ phong', modern: 'Hiện đại', cultivation: 'Tiên hiệp / Tu tiên', martial: 'Kiếm hiệp / Võ hiệp', historical: 'Lịch sử / Cung đình', western: 'Phương Tây / Fantasy', korean: 'Hàn Quốc', japanese: 'Nhật Bản / Light novel', scifi: 'Khoa học viễn tưởng', gaming: 'Võng du / Game', horror: 'Linh dị / Kinh dị', romance: 'Tình cảm hiện đại' };

// Ambiguous tags (romance, rebirth, system...) do not determine a historical setting.
export function resolveTranslationStyle(tags: string[] = [], choice: TranslationStyleChoice = 'auto'): TranslationStyle {
  if (choice !== 'auto' && choice in STYLE_LABELS) return choice;
  // Explicit cultural setting takes precedence over genre; fantasy is not always Chinese.
  const allTags = tags.join(' ').toLocaleLowerCase('vi');
  if (/hàn quốc|korean|hàn văn/.test(allTags)) return 'korean';
  if (/nhật bản|japan|light novel/.test(allTags)) return 'japanese';
  if (/phương tây|western|fantasy|âu mỹ/.test(allTags)) return 'western';
  for (const tag of tags.flatMap(value => value.toLocaleLowerCase('vi').split(/[,/·]/))) {
    const normalized = tag.trim();
    if (['tiên hiệp', 'tu tiên'].includes(normalized)) return 'cultivation';
    if (['kiếm hiệp', 'võ hiệp'].includes(normalized)) return 'martial';
    if (['lịch sử', 'cung đình', 'gia đấu'].includes(normalized)) return 'historical';
    if (['khoa huyễn', 'khoa học viễn tưởng'].includes(normalized)) return 'scifi';
    if (['võng du', 'game'].includes(normalized)) return 'gaming';
    if (['linh dị', 'kinh dị'].includes(normalized)) return 'horror';
    if (['đô thị', 'hiện đại', 'khoa huyễn', 'mạt thế'].includes(normalized)) return 'modern';
    if (['tiên hiệp', 'kiếm hiệp', 'huyền huyễn', 'cổ đại', 'lịch sử', 'gia đấu'].includes(normalized)) return 'classical';
  }
  return 'neutral';
}

export const STYLE_PHRASES: Record<TranslationStyle, Record<string, string>> = {
  neutral: {},
  classical: { '我': 'ta', '你': 'ngươi', '您': 'ngài', '他': 'hắn', '她': 'nàng', '我们': 'chúng ta', '你们': 'các ngươi', '他们': 'bọn họ', '她们': 'các nàng', '先生': 'tiên sinh', '小姐': 'tiểu thư', '夫人': 'phu nhân', '父亲': 'phụ thân', '母亲': 'mẫu thân', '哥哥': 'huynh', '姐姐': 'tỷ', '谢谢': 'đa tạ', '对不起': 'thất lễ' },
  modern: { '我': 'tôi', '你': 'bạn', '您': 'ngài', '他': 'anh ấy', '她': 'cô ấy', '我们': 'chúng tôi', '你们': 'các bạn', '他们': 'họ', '她们': 'họ', '先生': 'ông', '小姐': 'cô', '夫人': 'bà', '父亲': 'bố', '母亲': 'mẹ', '哥哥': 'anh', '姐姐': 'chị', '谢谢': 'cảm ơn', '对不起': 'xin lỗi' },
  cultivation: { '修炼': 'tu luyện', '修士': 'tu sĩ', '境界': 'cảnh giới', '灵气': 'linh khí', '神识': 'thần thức', '法宝': 'pháp bảo', '洞府': 'động phủ', '道友': 'đạo hữu', '前辈': 'tiền bối', '师兄': 'sư huynh', '师姐': 'sư tỷ', '师弟': 'sư đệ', '师妹': 'sư muội', '师父': 'sư phụ', '渡劫': 'độ kiếp', '飞升': 'phi thăng' },
  martial: { '内力': 'nội lực', '轻功': 'khinh công', '掌门': 'chưởng môn', '帮主': 'bang chủ', '大侠': 'đại hiệp', '少侠': 'thiếu hiệp', '武功': 'võ công', '江湖': 'giang hồ', '师父': 'sư phụ', '师兄': 'sư huynh', '师妹': 'sư muội', '秘籍': 'bí kíp', '招式': 'chiêu thức' },
  historical: { '陛下': 'bệ hạ', '殿下': 'điện hạ', '臣': 'thần', '朕': 'trẫm', '本宫': 'bổn cung', '哀家': 'ai gia', '皇后': 'hoàng hậu', '太子': 'thái tử', '丞相': 'thừa tướng', '将军': 'tướng quân', '圣旨': 'thánh chỉ', '朝廷': 'triều đình', '皇宫': 'hoàng cung' },
  western: { '魔法': 'ma pháp', '魔法师': 'pháp sư', '骑士': 'kỵ sĩ', '公爵': 'công tước', '伯爵': 'bá tước', '男爵': 'nam tước', '领主': 'lãnh chúa', '王国': 'vương quốc', '教廷': 'giáo đình', '教皇': 'giáo hoàng', '精灵': 'tinh linh', '矮人': 'người lùn', '兽人': 'người thú', '魔杖': 'đũa phép', '咒语': 'thần chú', '城堡': 'lâu đài' },
  korean: { '欧巴': 'oppa', '欧尼': 'eonni', '怒那': 'noona', '前辈': 'tiền bối', '后辈': 'hậu bối', '财阀': 'chaebol', '会长': 'chủ tịch', '社长': 'giám đốc', '练习生': 'thực tập sinh', '出道': 'ra mắt', '偶像': 'thần tượng', '首尔': 'Seoul', '釜山': 'Busan', '韩元': 'won' },
  japanese: { '前辈': 'senpai', '后辈': 'kouhai', '学园': 'học viện', '学生会': 'hội học sinh', '学生会长': 'hội trưởng hội học sinh', '社团': 'câu lạc bộ', '神社': 'đền Thần đạo', '巫女': 'miko', '天皇': 'Thiên hoàng', '将军': 'shogun', '武士': 'samurai', '忍者': 'ninja', '东京': 'Tokyo', '大阪': 'Osaka', '日元': 'yên' },
  scifi: { '飞船': 'tàu vũ trụ', '宇宙飞船': 'tàu vũ trụ', '机甲': 'giáp máy', '人工智能': 'trí tuệ nhân tạo', '量子': 'lượng tử', '星际': 'liên sao', '虫洞': 'hố giun', '光年': 'năm ánh sáng', '舰长': 'thuyền trưởng', '舰队': 'hạm đội', '能量': 'năng lượng', '基因': 'gen' },
  gaming: { '技能': 'kỹ năng', '等级': 'cấp độ', '经验值': 'điểm kinh nghiệm', '生命值': 'điểm máu', '魔法值': 'điểm mana', '副本': 'phó bản', '公会': 'bang hội', '玩家': 'người chơi', '装备': 'trang bị', '冷却时间': 'thời gian hồi chiêu', '任务': 'nhiệm vụ', '属性': 'thuộc tính', '掉落': 'rơi vật phẩm' },
  horror: { '幽灵': 'hồn ma', '厉鬼': 'ác quỷ', '诅咒': 'lời nguyền', '灵异': 'siêu nhiên', '怨灵': 'oán linh', '驱魔': 'trừ tà', '通灵': 'giao tiếp với linh hồn', '尸体': 'thi thể', '恶灵': 'ác linh' },
  romance: { '男朋友': 'bạn trai', '女朋友': 'bạn gái', '约会': 'hẹn hò', '告白': 'tỏ tình', '恋爱': 'yêu đương', '分手': 'chia tay', '暗恋': 'yêu thầm', '未婚夫': 'hôn phu', '未婚妻': 'hôn thê' },
};

const CLASSICAL_STYLES: TranslationStyle[] = ['cultivation', 'martial', 'historical'];
export function stylePhraseDictionary(style: TranslationStyle): Record<string, string> {
  const base = CLASSICAL_STYLES.includes(style) ? STYLE_PHRASES.classical
    : !['neutral', 'classical', 'modern'].includes(style) ? STYLE_PHRASES.modern : {};
  return { ...base, ...STYLE_PHRASES[style], ...readStyleOverrides()[style] };
}

const STORAGE_KEY = 'convert_style_phrase_overrides_v1';
let revision = 0;
export function styleRevision() { return revision; }
function readStyleOverrides(): Partial<Record<TranslationStyle, Record<string, string>>> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result: Partial<Record<TranslationStyle, Record<string, string>>> = {};
    for (const style of Object.keys(STYLE_PHRASES) as TranslationStyle[]) {
      const entries = value[style];
      if (entries && typeof entries === 'object' && !Array.isArray(entries)) result[style] = Object.fromEntries(Object.entries(entries).filter(([key, meaning]) => key && typeof meaning === 'string')) as Record<string, string>;
    }
    return result;
  } catch { return {}; }
}
export function saveStylePhrase(style: TranslationStyle, chinese: string, vietnamese: string) {
  const data = readStyleOverrides();
  data[style] = { ...data[style], [chinese]: vietnamese };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  revision++;
  window.dispatchEvent(new Event('translation-style-changed'));
}

/** Multi-label curated classification; unknown means unclassified, never invented. */
export function phraseStyles(chinese: string): TranslationStyle[] {
  return (Object.keys(STYLE_PHRASES) as TranslationStyle[]).filter(style => Object.hasOwn(STYLE_PHRASES[style], chinese));
}

/** Verified common transliterations; never guess an unknown person's original name. */
export const STYLE_NAMES: Partial<Record<TranslationStyle, Record<string, string>>> = {
  western: {
    '约翰': 'John', '約翰': 'John', '威廉': 'William', '詹姆斯': 'James',
    '乔治': 'George', '喬治': 'George', '查尔斯': 'Charles', '查爾斯': 'Charles',
    '亨利': 'Henry', '爱德华': 'Edward', '愛德華': 'Edward', '理查德': 'Richard',
    '罗伯特': 'Robert', '羅伯特': 'Robert', '迈克尔': 'Michael', '邁克爾': 'Michael',
    '托马斯': 'Thomas', '托馬斯': 'Thomas', '大卫': 'David', '大衛': 'David',
    '彼得': 'Peter', '保罗': 'Paul', '保羅': 'Paul', '杰克': 'Jack', '傑克': 'Jack',
    '玛丽': 'Mary', '瑪麗': 'Mary', '伊丽莎白': 'Elizabeth', '伊麗莎白': 'Elizabeth',
    '维多利亚': 'Victoria', '維多利亞': 'Victoria', '安娜': 'Anna', '艾米丽': 'Emily',
    '艾米麗': 'Emily', '露西': 'Lucy', '亚瑟': 'Arthur', '亞瑟': 'Arthur',
  },
};
export function styleNameDictionary(style: TranslationStyle): Record<string, string> {
  return STYLE_NAMES[style] || {};
}