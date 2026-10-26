# Kế hoạch Tối ưu Giao diện chuẩn Google AI Studio & Tinh giản Trải nghiệm

Tái cấu trúc và nâng cấp toàn bộ giao diện ứng dụng sang phong cách công nghệ cao, tối giản và tập trung cao độ vào nội dung theo ngôn ngữ thiết kế của Google AI Studio (`#131314`, viền hairline mảnh `border-zinc-800`, font sans & mono sắc nét, không gian thao tác thông thoáng).

---

## 1. Mục tiêu và Thay đổi cốt lõi

### 1.1 Tinh gọn Bảng điều khiển Giao diện (Theme Popover)
- **Đổi tên nhãn**: Rút ngắn toàn bộ các cụm `"màu sắc giao diện & nền đọc"` thành `"Giao diện"`.
- **Rút gọn các tùy chọn màu nền**: Thay vì nhiều thẻ màu rải rác, gom gọn chuẩn xác thành 4 chế độ:
  1. **Sáng (Light)**: Nền trắng sạch, chữ tối tương phản cao.
  2. **Tối (Dark)**: Nền tối chuẩn AI Studio (`#131314`), chữ xám sáng dịu mắt.
  3. **Sepia (Retro)**: Nền giấy vàng ấm cổ điển, chống mỏi mắt khi đọc lâu.
  4. **Hệ thống (Auto)**: Tự động đồng bộ theo chế độ sáng/tối của hệ điều hành.
- **Loại bỏ văn bản thừa**: Xóa bỏ các dòng giải thích dư thừa như `"Bấm lại icon Theme để đóng bảng màu"`, các câu hướng dẫn vụn vặt ở chân popover.

### 1.2 Thiết kế Popover chuẩn Google AI Studio
- Sử dụng bo góc tinh tế (`rounded-xl`), viền mảnh sắc sảo (`border border-zinc-800/90`), bóng mờ nhẹ (`shadow-2xl shadow-black/40`), hiệu ứng backdrop blur kính mờ nhẹ.
- Các nút chọn theme hiển thị dạng danh sách / lưới 2x2 hoặc list item kèm indicator dot / checkmark tinh tế.
- Giữ lại tooltip ngắn gọn, hiển thị mượt mà khi người dùng hover qua các nút công cụ trên thanh header.

### 1.3 Rà soát & Loại bỏ các ghi chú rườm rà trên toàn ứng dụng
- Quét qua toàn bộ Header, Control Bar, Modal Tra từ điển, Danh sách Name/Vietphrase, Trình đọc truyện:
  - Loại bỏ các text hướng dẫn thừa thãi, placeholder dài dòng.
  - Tối ưu các tiêu đề modal thành tên tính năng ngắn gọn, trực diện (VD: "Từ điển cá nhân", "Cài đặt hiển thị").
  - Đảm bảo giao diện thông thoáng, tối đa hóa không gian đọc và dịch thuật.

---

## 2. Các tệp tin cần thực hiện thay đổi

1. **`src/components/Header.tsx`**:
   - Cập nhật nút bấm: nhãn tooltip `"Giao diện"`.
   - Cập nhật popup Theme: hiển thị 4 tùy chọn chuẩn `"Sáng (Light)"`, `"Tối (Dark)"`, `"Sepia (Retro)"`, `"Hệ thống (Auto)"`.
   - Xóa bỏ câu hướng dẫn `"Bấm lại icon Theme để đóng bảng màu"` và các text thừa.
   - Thêm tooltip ngắn gọn cho tất cả các nút công cụ (Giao diện, Cỡ chữ Aa, Từ điển, Xuất file, v.v.).

2. **`src/types/index.ts` & `src/App.tsx`**:
   - Tối ưu trạng thái Theme (`light` | `dark` | `sepia` | `system`) để tương thích hoàn hảo với 4 tùy chọn mới.
   - Đồng bộ class nền và màu chữ trên toàn bộ `App.tsx` theo chuẩn Google AI Studio dark mode.

3. **`src/components/FontSizeSettings.tsx` & Các Dialog/Popover khác**:
   - Tinh gọn popup Cỡ chữ `Aa`: chỉ giữ thanh trượt kích cỡ, khoảng cách dòng, độ rộng văn bản trực quan; loại bỏ chú thích thừa.
   - Thống nhất phong cách popover công nghệ cao viền mảnh.

---

## 4. Trạng thái Hoàn thành (Completed)
- [x] Đã đổi tên nhãn và tooltip từ `"màu sắc giao diện & nền đọc"` thành `"Giao diện"`.
- [x] Đã tinh chỉnh và tối ưu popup Giao diện: rút gọn thành đúng 4 tùy chọn sạch sẽ:
  - `"Sáng (Light)"`
  - `"Tối (Dark)"`
  - `"Sepia (Retro)"`
  - `"Hệ thống (Auto)"`
- [x] Đã loại bỏ hoàn toàn câu giải thích thừa `"Bấm lại icon Theme để đóng bảng màu"` và các text chú thích dư thừa.
- [x] Đã thiết kế lại popover Giao diện và Kiểu chữ & Cỡ chữ (Aa) theo chuẩn phong cách Google AI Studio: viền hairline mảnh `border-zinc-800`, nền tối `bg-[#18181b]/98` backdrop-blur-md, các nút gọn gàng với checkmark tinh tế.
- [x] Giữ lại các tooltip ngắn gọn, sắc nét khi rê chuột qua các nút công cụ.
- [x] Kiểm tra và xác thực thành công cả `tsc --noEmit` và `npm run build` không lỗi.
