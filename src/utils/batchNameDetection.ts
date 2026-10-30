import type { TranslatedToken } from './translatorEngine';
import { getHanVietChar } from '../data/hanvietData';

export interface NameSuggestion {
  chinese: string; vietnamese: string; count: number; chapterCount: number;
  sourceExample: string; translationExample: string;
  possibleContinuationOf?: string;
}
const surnames = new Set(Array.from('赵錢钱孙孫李周吴吳郑鄭王冯馮陈陳褚卫衛蒋蔣沈韩韓杨楊朱秦尤许許何吕呂施张張孔曹严嚴华華金魏陶姜戚谢謝邹鄒喻柏窦竇章云雲苏蘇潘葛奚范彭郎鲁魯韦韋马馬苗方俞任袁柳唐罗羅薛雷贺賀倪汤湯殷毕畢郝安常乐樂傅齐齊康伍余元顾顧孟平黄黃穆萧蕭尹姚邵汪毛狄米贝貝明臧计計伏成戴宋茅庞龐熊纪紀舒屈项項祝董梁杜阮蓝藍闵閔席季麻强強贾賈路江童颜顏郭梅盛林钟鍾徐邱骆駱高夏蔡田樊胡凌霍虞万萬柯卢盧莫房裘缪繆解应應宗丁宣邓鄧杭洪包左石崔吉龚龔程陆陸裴荣榮翁荀惠甄曲封芮储儲靳段富巫乌烏焦巴牧山谷车車侯全秋仲宫宮宁寧仇祖武符刘劉景詹龙龍叶葉白司黎薄印宿怀懷蒲邰从從索赖賴卓屠池乔喬阴陰苍蒼闻聞党黨翟谭譚申劳勞姬冉宰桑桂牛寿壽边邊燕温溫庄莊柴瞿阎閻连連茹习習艾鱼魚容向古易廖庾终終耿满滿匡文寇广廣禄祿阙闕东東欧歐楚闫閆凌冷墨洛夜南玄北风風雪姝沐'));
const compounds = ['欧阳','歐陽','司马','司馬','上官','诸葛','諸葛','东方','東方','皇甫','尉迟','尉遲','公孙','公孫','慕容','司徒','司空','夏侯','令狐','宇文','长孙','長孫','独孤','獨孤','南宫','南宮'];
const common = new Set(['王国','王國','王子','王朝','王者','白天','白色','高兴','高興','高山','高手','明天','明白','先生','小姐','老师','老師','学生','學生','大家','自己','他们','他們','我们','我們','然后','然後','但是','什么','什麼','东西','東西','声音','聲音','所有','没有','沒有','知道','现在','現在','心中','黑色','陈述','陳述','张开','張開','看见','看見']);
const speech = /^(?:说道|說道|说|說|问道|問道|问|問|答道|回答|喊道|叫道|笑道|点头|點頭|摇头|搖頭|皱眉|皺眉|走|看|望|听|聽|站|坐|转身|轉身|沉声|沉聲|低声|低聲|轻声|輕聲|怒道|冷笑)/;
const continuationCharacter = /^[一才能没沒]$/;
const grammaticalBoundary = /^(?:一(?:听|聽|看|愣|怔|惊|驚|笑|想|动|動|时|時|声|聲|把|步|眼|口|边|邊)|(?:才|能|没|沒)(?:有|够|夠|会|會|想|说|說|问|問|看|听|聽|走|站|坐|动|動|笑|点|點|摇|搖|意识|意識|知道|回答))/;
const introduction = /(?:名叫|名为|名為|名字叫|名字是|叫做|姓名是)[\s:："“「]*$/;
const standaloneBoundary = /^[\s，,。.!！?？：:、；;”」]/;
const title = (value: string) => value.split(/\s+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(' ');

/** Conservative offline suggestions, never automatic assertions that a phrase is a person. */
export class BatchNameDetector {
  private entries = new Map<string, NameSuggestion & { context: number; direct: number; standalone: number; introduced: number }>();
  private known: Set<string>;
  constructor(knownNames: string[]) { this.known = new Set(knownNames); }
  addChapter(source: string, tokens: TranslatedToken[]) {
    for (const token of tokens) if (token.isName) this.known.add(token.original);
    const local = new Map<string, { count: number; context: number; direct: number; standalone: number; introduced: number; offset: number }>();
    for (const run of source.matchAll(/[\p{Script=Han}]+/gu)) {
      const text = run[0];
      for (let i = 0; i < text.length; i++) {
        const compound = compounds.find(surname => text.startsWith(surname, i));
        if (!compound && !surnames.has(text[i])) continue;
        for (const length of compound ? [3, 4] : [2, 3]) {
          const word = text.slice(i, i + length);
          if (word.length !== length || common.has(word) || this.known.has(word) || /[的了着著是在说說问問道看他她我你们們]$/.test(word)) continue;
          const offset = (run.index || 0) + i;
          const after = source.slice(offset + length, offset + length + 16);
          const direct = speech.test(after) ? 1 : 0;
          const standalone = !after || standaloneBoundary.test(after) ? 1 : 0;
          const introduced = introduction.test(source.slice(Math.max(0, offset - 16), offset)) && (direct || standalone) ? 1 : 0;
          const context = direct || standalone || introduced || (grammaticalBoundary.test(after) ? 1 : 0);
          // Retain weak repetitions only when token boundaries also support the phrase.
          const current = local.get(word);
          if (current) { current.count++; current.context += context; current.direct += direct; current.standalone += standalone; current.introduced += introduced; }
          else if (local.size < 15000) local.set(word, { count: 1, context, direct, standalone, introduced, offset });
        }
      }
    }
    const boundaries = new Set(tokens.filter(token => !token.isName && !token.isPunctuation).map(token => token.original));
    for (const [chinese, item] of local) {
      if (!item.context && !boundaries.has(chinese)) continue;
      const existing = this.entries.get(chinese);
      if (existing) { existing.count += item.count; existing.context += item.context; existing.direct += item.direct; existing.standalone += item.standalone; existing.introduced += item.introduced; existing.chapterCount++; continue; }
      if (this.entries.size >= 2000) continue;
      const tokenIndex = tokens.findIndex(token => token.charStart !== undefined && token.charEnd !== undefined && token.charStart <= item.offset && token.charEnd > item.offset);
      const vietnamese = title(Array.from(chinese, char => getHanVietChar(char)).join(' '));
      this.entries.set(chinese, { chinese, vietnamese, count: item.count, context: item.context, direct: item.direct, standalone: item.standalone, introduced: item.introduced, chapterCount: 1,
        sourceExample: source.slice(Math.max(0, item.offset - 24), item.offset + 60),
        translationExample: tokenIndex >= 0 ? tokens.slice(Math.max(0, tokenIndex - 5), tokenIndex + 12).map(token => token.translated).join(' ') : '',
      });
    }
  }
  suggestions(options: { includeUncertain?: boolean } = {}): NameSuggestion[] {
    const candidates = [...this.entries.values()].filter(row => !this.known.has(row.chinese) && row.count >= 3 && (row.context >= 2 || (row.context >= 1 && row.chapterCount >= 2))).map(row => {
      const prefix = row.chinese.slice(0, -1);
      const shorter = this.entries.get(prefix);
      const crediblePrefix = prefix.length >= 2 && (this.known.has(prefix) || (shorter && shorter.count >= 3 && shorter.direct + shorter.standalone + shorter.introduced >= 2));
      // Never blacklist a syllable globally: names such as 林一 / 陈才能 are valid.
      // Independent address/introduction evidence protects genuinely longer names.
      const uncertain = continuationCharacter.test(row.chinese.slice(-1)) && crediblePrefix && !row.introduced && !row.standalone;
      return { ...row, possibleContinuationOf: uncertain ? prefix : undefined };
    });
    return candidates.filter(row => (options.includeUncertain || !row.possibleContinuationOf) && !candidates.some(other =>
      !other.possibleContinuationOf && other.chinese !== row.chinese && other.chinese.startsWith(row.chinese) && other.context >= row.context && other.count >= row.count))
      .sort((a, b) => Number(!!a.possibleContinuationOf) - Number(!!b.possibleContinuationOf) || b.context - a.context || b.count - a.count).slice(0, 40);
  }
}
