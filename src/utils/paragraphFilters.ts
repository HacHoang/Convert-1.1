// Match whole website notices; their individual words remain valid story text.
const normalizeNotice = (text: string) => text.normalize('NFC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const notices = new Set([
  '溫馨提示: 優化了VIP會員的閱讀體驗, 點按屏幕中間即可呼喚出菜單, 可以很方便的「設定」、「上一頁」、「下一頁」、「回到頂部」',
  '温馨提示: 优化了VIP会员的阅读体验, 点按屏幕中间即可呼唤出菜单, 可以很方便的「设定」、「上一页」、「下一页」、「回到顶部」',
  'Ấm áp nhắc nhở: ưu hóa VIP member duyệt đọc thể nghiệm, điểm theo như trong màn hình gian liền có thể hô hoán ra đồ ăn đơn, có thể rất thuận tiện 「 thiết lập 」, 「 trang trước 」, 「 trang sau 」, 「 trở lại đỉnh bộ 」',
].map(normalizeNotice));

/** Masking retains source offsets; display mode removes the complete notice line. */
export function filterWebsiteNotices(text: string, preserveOffsets = false): string {
  return text.replace(/[^\r\n]+/g, paragraph => notices.has(normalizeNotice(paragraph))
    ? preserveOffsets ? ' '.repeat(paragraph.length) : ''
    : paragraph);
}
