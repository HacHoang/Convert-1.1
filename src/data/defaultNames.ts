/**
 * Tệp Name mặc định tích hợp sẵn (Names dictionary)
 * Giúp nhận diện tên nhân vật, địa danh, tông môn, công pháp chính xác thay vì bị dịch nghĩa đen.
 */

export interface NameItem {
  id: string;
  chinese: string;
  vietnamese: string;
  category: 'Nhân vật' | 'Địa danh' | 'Tông môn' | 'Binh khí' | 'Công pháp' | 'Khác';
  note?: string;
  createdAt: number;
}

export const INITIAL_NAMES: NameItem[] = [
  // Đấu Phá Thương Khung
  { id: 'name-1', chinese: '萧炎', vietnamese: 'Tiêu Viêm', category: 'Nhân vật', note: 'Nhân vật chính Đấu Phá Thương Khung', createdAt: Date.now() - 50000 },
  { id: 'name-2', chinese: '萧战', vietnamese: 'Tiêu Chiến', category: 'Nhân vật', note: 'Cha Tiêu Viêm', createdAt: Date.now() - 49000 },
  { id: 'name-3', chinese: '药老', vietnamese: 'Dược Lão', category: 'Nhân vật', note: 'Dược Trần, sư phụ Tiêu Viêm', createdAt: Date.now() - 48000 },
  { id: 'name-4', chinese: '熏儿', vietnamese: 'Huân Nhi', category: 'Nhân vật', note: 'Cổ Huân Nhi', createdAt: Date.now() - 47000 },
  { id: 'name-5', chinese: '萧薰儿', vietnamese: 'Tiêu Huân Nhi', category: 'Nhân vật', note: 'Cổ Huân Nhi', createdAt: Date.now() - 46000 },
  { id: 'name-6', chinese: '纳兰嫣然', vietnamese: 'Nạp Lan Yên Nhiên', category: 'Nhân vật', note: 'Hôn thê từ hôn', createdAt: Date.now() - 45000 },
  { id: 'name-7', chinese: '小医仙', vietnamese: 'Tiểu Y Tiên', category: 'Nhân vật', note: 'Ách Nan Độc Thể', createdAt: Date.now() - 44000 },
  { id: 'name-8', chinese: '美杜莎', vietnamese: 'Mỹ Đỗ Toa', category: 'Nhân vật', note: 'Thải Lân Nữ Vương', createdAt: Date.now() - 43000 },
  { id: 'name-9', chinese: '美杜莎女王', vietnamese: 'Mỹ Đỗ Toa Nữ Vương', category: 'Nhân vật', note: 'Xà Nhân tộc nữ vương', createdAt: Date.now() - 42000 },
  { id: 'name-10', chinese: '云韵', vietnamese: 'Vân Vận', category: 'Nhân vật', note: 'Tông chủ Vân Lam Tông', createdAt: Date.now() - 41000 },
  { id: 'name-11', chinese: '云山', vietnamese: 'Vân Sơn', category: 'Nhân vật', note: 'Lão tông chủ Vân Lam Tông', createdAt: Date.now() - 40000 },
  { id: 'name-12', chinese: '海波东', vietnamese: 'Hải Ba Đông', category: 'Nhân vật', note: 'Băng Hoàng', createdAt: Date.now() - 39000 },
  { id: 'name-13', chinese: '乌坦城', vietnamese: 'Ô Thản Thành', category: 'Địa danh', note: 'Gia Mã đế quốc', createdAt: Date.now() - 38000 },
  { id: 'name-14', chinese: '加玛帝国', vietnamese: 'Gia Mã Đế Quốc', category: 'Địa danh', note: 'Đế quốc biên thùy', createdAt: Date.now() - 37000 },
  { id: 'name-15', chinese: '云岚宗', vietnamese: 'Vân Lam Tông', category: 'Tông môn', note: 'Đại tông môn Gia Mã', createdAt: Date.now() - 36000 },
  { id: 'name-16', chinese: '迦南学院', vietnamese: 'Già Nam Học Viện', category: 'Tông môn', note: 'Đại lục trung tâm', createdAt: Date.now() - 35000 },
  { id: 'name-17', chinese: '魂殿', vietnamese: 'Hồn Điện', category: 'Tông môn', note: 'Thế lực phản diện', createdAt: Date.now() - 34000 },
  { id: 'name-18', chinese: '玄重尺', vietnamese: 'Huyền Trọng Thước', category: 'Binh khí', note: 'Vũ khí Tiêu Viêm', createdAt: Date.now() - 33000 },
  { id: 'name-19', chinese: '青莲地心火', vietnamese: 'Thanh Liên Địa Tâm Hỏa', category: 'Khác', note: 'Dị Hỏa xếp thứ 19', createdAt: Date.now() - 32000 },
  { id: 'name-20', chinese: '骨灵冷火', vietnamese: 'Cốt Linh Lãnh Hỏa', category: 'Khác', note: 'Dị Hỏa của Dược Lão', createdAt: Date.now() - 31000 },
  { id: 'name-21', chinese: '焚诀', vietnamese: 'Phần Quyết', category: 'Công pháp', note: 'Công pháp tiến hóa', createdAt: Date.now() - 30000 },
  { id: 'name-22', chinese: '八极崩', vietnamese: 'Bát Cực Băng', category: 'Công pháp', note: 'Huyền giai cao cấp đấu kỹ', createdAt: Date.now() - 29000 },
  { id: 'name-23', chinese: '焰分噬浪尺', vietnamese: 'Diễm Phân Phệ Lãng Thước', category: 'Công pháp', note: 'Địa giai đê cấp đấu kỹ', createdAt: Date.now() - 28000 },

  // Phàm Nhân Tu Tiên
  { id: 'name-24', chinese: '韩立', vietnamese: 'Hàn Lập', category: 'Nhân vật', note: 'Hàn Chạy Nhanh, Hàn Lão Ma', createdAt: Date.now() - 27000 },
  { id: 'name-25', chinese: '墨大夫', vietnamese: 'Mặc đại phu', category: 'Nhân vật', note: 'Mặc Cư Nhân', createdAt: Date.now() - 26000 },
  { id: 'name-26', chinese: '张铁', vietnamese: 'Trương Thiết', category: 'Nhân vật', note: 'Khúc Hồn', createdAt: Date.now() - 25000 },
  { id: 'name-27', chinese: '南宫婉', vietnamese: 'Nam Cung Uyển', category: 'Nhân vật', note: 'Đạo lữ Hàn Lập', createdAt: Date.now() - 24000 },
  { id: 'name-28', chinese: '七玄门', vietnamese: 'Thất Huyền Môn', category: 'Tông môn', note: 'Môn phái giang hồ', createdAt: Date.now() - 23000 },
  { id: 'name-29', chinese: '黄枫谷', vietnamese: 'Hoàng Phong Cốc', category: 'Tông môn', note: 'Việt Quốc thất đại môn phái', createdAt: Date.now() - 22000 },
  { id: 'name-30', chinese: '掌天瓶', vietnamese: 'Chưởng Thiên Bình', category: 'Binh khí', note: 'Tiểu lục bình thần bí', createdAt: Date.now() - 21000 },

  // Già Thiên
  { id: 'name-31', chinese: '叶凡', vietnamese: 'Diệp Phàm', category: 'Nhân vật', note: 'Diệp Thiên Đế', createdAt: Date.now() - 20000 },
  { id: 'name-32', chinese: '庞博', vietnamese: 'Bàng Bác', category: 'Nhân vật', note: 'Hảo hữu Diệp Phàm', createdAt: Date.now() - 19000 },
  { id: 'name-33', chinese: '姬紫月', vietnamese: 'Cơ Tử Nguyệt', category: 'Nhân vật', note: 'Nữ chính Già Thiên', createdAt: Date.now() - 18000 },
  { id: 'name-34', chinese: '黑皇', vietnamese: 'Hắc Hoàng', category: 'Nhân vật', note: 'Đại Hắc Cẩu', createdAt: Date.now() - 17000 },
  { id: 'name-35', chinese: '荒古圣体', vietnamese: 'Hoang Cổ Thánh Thể', category: 'Khác', note: 'Thể chất cái thế', createdAt: Date.now() - 16000 },
  { id: 'name-36', chinese: '泰山', vietnamese: 'Thái Sơn', category: 'Địa danh', note: 'Nơi Cửu Long kéo hòm giáng lâm', createdAt: Date.now() - 15000 },
  { id: 'name-37', chinese: '北斗星域', vietnamese: 'Bắc Đẩu Tinh Vực', category: 'Địa danh', note: 'Táng Đế Tinh', createdAt: Date.now() - 14000 },

  // Thôn Phệ Tinh Không & Hoàn Mỹ Thế Giới
  { id: 'name-38', chinese: '罗峰', vietnamese: 'La Phong', category: 'Nhân vật', note: 'La Thành Chủ', createdAt: Date.now() - 13000 },
  { id: 'name-39', chinese: '石昊', vietnamese: 'Thạch Hạo', category: 'Nhân vật', note: 'Hoang Thiên Đế', createdAt: Date.now() - 12000 },
  { id: 'name-40', chinese: '柳神', vietnamese: 'Liễu Thần', category: 'Nhân vật', note: 'Tổ Tế Linh', createdAt: Date.now() - 11000 },
  { id: 'name-41', chinese: '牧尘', vietnamese: 'Mục Trần', category: 'Nhân vật', note: 'Đại Chúa Tể', createdAt: Date.now() - 10000 },
  { id: 'name-42', chinese: '林动', vietnamese: 'Lâm Động', category: 'Nhân vật', note: 'Vũ Động Càn Khôn', createdAt: Date.now() - 9000 },
];
