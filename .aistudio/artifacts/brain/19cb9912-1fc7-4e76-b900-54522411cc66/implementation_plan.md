# Tối Ưu Thanh Menu 3 Gạch Ngang & Ngăn Kéo Điều Hướng (Google AI Studio Pattern)

Kế hoạch thiết kế và tái cấu trúc toàn diện thanh menu 3 gạch (Side Drawer) theo đúng mẫu giao diện hiện đại trong ảnh chụp: tích hợp thẻ thống kê 3 block vuông (Sách trong giá, Sách đã đọc, Số giờ đọc) kèm nút bánh răng xóa dữ liệu, thanh tiện ích 4 nút với Cài Đặt nổi bật, và liên kết tài khoản Google ở dưới cùng hỗ trợ đăng nhập/đăng xuất.

## User Review & Critical Decisions

> [!IMPORTANT]
> Toàn bộ các lựa chọn đã được người dùng xác nhận thông qua câu hỏi khảo sát tương tác:

- **Vị trí nút Menu 3 gạch**: Giữ nguyên vị trí hiện tại trên thanh tiêu đề chính (App Bar), bấm vào sẽ trượt mở ngăn kéo điều hướng cao cấp chuẩn phong cách ứng dụng hiện đại.
- **Tài khoản Google dưới cùng**:
  - Khi **chưa đăng nhập**: Hiển thị nút "Đăng nhập với Google" bo tròn với biểu tượng Google G.
  - Khi **đã đăng nhập**: Hiển thị avatar tròn và email tài khoản (`readerheadless@gmail.com` hoặc email tùy chọn), kèm menu mở rộng để chuyển hoặc đăng xuất tài khoản.
- **Thẻ nổi bật phía trên mục cài đặt**:
  - Gồm 3 block vuông bo góc nhẹ:
    1. **Số sách trong giá**: Đếm tổng số bộ truyện hiện có trong thư viện.
    2. **Số sách đã đọc**: Đếm số sách đã mở đọc hoặc có tiến trình đọc.
    3. **Số giờ đã đọc**: Tổng thời gian đọc truyện được tích lũy theo thời gian thực (đơn vị giờ/phút).
  - Góc cạnh thanh thống kê có **1 bánh răng bé xíu**, bấm vào hiển thị popup với tùy chọn **"Xóa thống kê"** (đặt lại số sách đã đọc và số giờ đọc về 0).
- **Thanh tiện ích & Cài đặt (ngay trên phần tài khoản)**:
  - Thanh hàng ngang 4 biểu tượng tiện ích theo mẫu: `[Thông báo]` - `[Cài đặt]` - `[Tìm kiếm nhanh]` - `[Phím tắt/Key]`.
  - Nút **Cài đặt** điều hướng trực tiếp đến trang Cài Đặt hoặc mở bảng điều khiển cấu hình ứng dụng.

---

## 1. Overview & Core Concept

- **Mục tiêu**: Nâng cấp toàn diện menu ngăn kéo điều hướng (Side Drawer) từ giao diện cơ bản lên tiêu chuẩn thiết kế chuyên nghiệp, đậm chất công nghệ giống thanh bên của Google AI Studio trong ảnh đính kèm.
- **Đối tượng sử dụng**: Độc giả đọc và convert truyện chữ, tiểu thuyết tiếng Trung, dịch giả và người biên tập cần giao diện tinh giản, tiện dụng, xem nhanh chỉ số đọc và chuyển đổi tính năng mượt mà.
- **Giá trị mang lại**: Trải nghiệm điều hướng chuẩn mực, quản lý tiến độ đọc trực quan, hỗ trợ tài khoản Google linh hoạt và truy cập nhanh cài đặt hệ thống chỉ với một chạm.

---

## 2. User Experience & Visual Design

### 2.1 Cấu Trúc Ngăn Kéo (Side Drawer) Theo Mẫu Mới

Ngăn kéo trượt hiển thị từ cạnh màn hình với nền tối chuẩn studio (`#121316` / `bg-neutral-950`), viền hairline sắc nét:

1. **Header Drawer**:
   - Tên thương hiệu: **Convert** (kèm badge phiên bản `v1.1` tinh gọn).
   - Nút thu nhỏ / đóng ngăn kéo (icon hamburger gập hoặc dấu đóng thanh lịch).
2. **Khu Vực Điều Hướng Phân Nhóm (Categorized Navigation)**:
   - Nhóm 1: `KHÁM PHÁ` (EXPLORE)
     - **Dịch Nhanh**: Biểu tượng Play / Chuyển ngữ. Trạng thái active có nền mờ pill `bg-neutral-800` chữ trắng nổi bật.
     - **Lịch Sử Dịch**: Biểu tượng đồng hồ / lịch sử convert các đoạn văn.
   - Nhóm 2: `TỦ TRUYỆN & DỮ LIỆU` (BUILD)
     - **Tủ Truyện**: Biểu tượng giá sách / thư mục truyện.
     - **Quản Lý Từ Điển**: Biểu tượng dấu sách / kho Vietphrase & Hán Việt.
     - **Tệp Name Riêng**: Biểu tượng danh sách từ riêng.
   - Nhóm 3: `QUẢN LÝ & HỆ THỐNG` (MANAGE)
     - **Bảng Điều Khiển**: Tổng quan hệ thống dữ liệu offline.
     - **Hướng Dẫn Sử Dụng**: Xem mẹo phím tắt & hướng dẫn nạp từ điển nhanh (kèm mũi tên `>`).
3. **Thẻ Thống Kê Đọc Truyện (Feature Stat Card)**:
   - Nằm ngay phía trên thanh công cụ cài đặt.
   - Thiết kế dạng khung nâng nổi (`bg-[#1c1d1f] border border-neutral-800 rounded-2xl p-3.5`).
   - Tiêu đề nhỏ: "Thống Kê Đọc Truyện" cùng **1 bánh răng bé xíu** ở góc phải.
   - Hàng 3 block vuông bo cong nhẹ:
     - Block 1: `[ 📚 Sách trong giá: X ]`
     - Block 2: `[ 📖 Sách đã đọc: Y ]`
     - Block 3: `[ ⏱️ Giờ đã đọc: Z.Zh ]`
   - Bấm vào bánh răng bé xíu: Hiện popup dropdown xác nhận **"Xóa thống kê"** (Reset chỉ số đọc).
4. **Thanh Công Cụ 4 Nút (Tiện Ích & Cài Đặt)**:
   - Nằm ngay trên phần tài khoản Google.
   - 4 nút vuông tròn bo góc thanh lịch:
     - 🔔 **Thông báo**: Xem thông báo bản cập nhật offline.
     - ⚙️ **Cài đặt**: Chuyển ngay đến tab Cài Đặt (hoặc mở cấu hình giao diện).
     - 🔍 **Tìm kiếm nhanh**: Mở thanh tra từ nhanh hoặc tìm truyện.
     - 🔑 **Phím tắt**: Bảng tra cứu phím tắt dịch nhanh.
5. **Mục Dưới Cùng: Liên Kết Tài Khoản Google**:
   - Viên thuốc (pill container) sang trọng ở đáy ngăn kéo (`bg-[#1a1b1e] border border-neutral-800/80 rounded-2xl p-2.5`).
   - **Chưa đăng nhập**: Nút "Đăng nhập với Google" với biểu tượng chữ G nhiều màu hoặc đơn sắc, bấm vào mở modal/luồng đăng nhập nhanh một chạm.
   - **Đã đăng nhập**: Avatar ảnh đại diện tròn + tên email `readerheadless@gmail.com` (hoặc email đăng nhập), bấm vào có menu xem chi tiết tài khoản hoặc "Đăng xuất".

---

## 3. Key Product Decisions & Trade-Offs

- **Lưu trữ dữ liệu thống kê đọc truyện (Reading Analytics)**:
  - Tự động tích lũy thời gian đọc khi người dùng ở trong chế độ xem truyện / đọc dịch (sử dụng timer an toàn `visibilitychange` & `activeTab`).
  - Lưu trữ trực tiếp trong `localStorage` qua `AppContext` để không bị mất khi reload trang.
- **Trạng thái tài khoản Google**:
  - Hỗ trợ lưu trữ tài khoản người dùng trực tiếp trong ứng dụng (`googleUser: { email, name, avatar, isLoggedIn }`). Mặc định đồng bộ với tài khoản môi trường hiện tại (`readerheadless@gmail.com`) khi kích hoạt đăng nhập.
  - Khi chưa đăng nhập: Cung cấp nút đăng nhập trực quan không gây phiền phức.
- **Khả năng tương thích Responsive & Khung điện thoại**:
  - Ngăn kéo mở mượt mà trên cả giao diện di động lẫn giao diện máy tính mở rộng, tuân thủ quy tắc kích thước vùng bấm tối thiểu $\ge 44\text{px}$.

---

## 4. Technical Architecture & Data Strategy

### 4.1 System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Top App Bar                           │
│  [3-line Menu Button]   Convert 1.1        [Aa] [Theme] [🖥] │
└──────────────────────────────┬──────────────────────────────┘
                               │ Click mở Drawer
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Navigation Side Drawer (Mẫu Mới)             │
│                                                             │
│  [Logo / Convert 1.1]                           [Close X]   │
│  ─────────────────────────────────────────────────────────  │
│  EXPLORE / KHÁM PHÁ                                         │
│    • Dịch Nhanh (Playground active style)                   │
│    • Lịch Sử Dịch                                           │
│                                                             │
│  BUILD / DỮ LIỆU                                            │
│    • Tủ Truyện Thư Viện                                     │
│    • Quản Lý Từ Điển Vietphrase                             │
│    • Tệp Name Cá Nhân                                       │
│                                                             │
│  MANAGE / HỆ THỐNG                                          │
│    • Bảng Điều Khiển                                        │
│    • Hướng Dẫn Sử Dụng                                   >  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  [Thẻ Thống Kê 3 Block Vuông]             [⚙️ Bánh răng nhỏ]│
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Sách trong   │  │ Sách đã đọc  │  │ Giờ đã đọc   │       │
│  │    giá: 4    │  │      2       │  │    1.8h      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ─────────────────────────────────────────────────────────  │
│  [Thanh Tiện Ích: 🔔 Thông báo | ⚙️ Cài Đặt | 🔍 Tìm | 🔑 Key]│
│  ─────────────────────────────────────────────────────────  │
│  [Tài Khoản Google: Avatar + readerheadless@gmail.com]      │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 State Additions in `AppContext`

- `readingStats`: `{ totalReadBooks: number, totalReadMinutes: number }`
- `resetReadingStats()`: Đặt lại `totalReadBooks = 0` và `totalReadMinutes = 0`.
- `googleAccount`: `{ isLoggedIn: boolean, email: string, name: string, avatarUrl: string }`
- `loginWithGoogle(email?: string)` / `logoutGoogle()`

---

## 5. Verification Plan

1. **Kiểm tra giao diện ngăn kéo**:
   - Mở menu 3 gạch, xác nhận hiển thị chính xác các phân nhóm danh mục, thẻ 3 khối vuông thống kê với bánh răng nhỏ.
   - Thử bấm bánh răng nhỏ -> popup hiện lên -> bấm "Xóa thống kê" -> các chỉ số trở về 0.
2. **Kiểm tra thanh Cài đặt**:
   - Bấm icon bánh răng Cài đặt trong thanh 4 nút tiện ích -> chuyển ngay đến màn hình Cài Đặt thành công.
3. **Kiểm tra liên kết tài khoản Google**:
   - Bấm đăng nhập -> chuyển sang hiển thị email `readerheadless@gmail.com` kèm avatar.
   - Bấm vào tài khoản đã đăng nhập -> tùy chọn Đăng xuất -> chuyển về trạng thái Chưa đăng nhập.
4. **Kiểm tra build**: Chạy `compile_applet` và `lint_applet` đảm bảo 0 lỗi biên dịch.
