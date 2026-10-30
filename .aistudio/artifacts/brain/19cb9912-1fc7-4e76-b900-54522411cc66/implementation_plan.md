# Kế Hoạch Triển Khai Nâng Cấp Tab Dịch Nhanh (TranslateView)

Người dùng đã lựa chọn bổ sung toàn bộ 5 tính năng đề xuất và bố trí tích hợp trực tiếp trên thanh điều khiển phía trên của Tab Dịch Nhanh.

---

## 1. Mục Tiêu & Kiến Trúc Tổng Quan

Tất cả các tính năng mới sẽ được tích hợp gọn gàng, trang nhã vào thanh công cụ phía trên của `TranslateView.tsx` nhằm tối ưu trải nghiệm đọc - dịch tiểu thuyết:
1. **Cuộn đồng bộ hai chiều (Synchronized Scrolling)**: Tự động cuộn tương xứng giữa khung tiếng Trung và khung Vietphrase.
2. **Tìm & Thay thế nhanh trong chương (Find & Replace in Chapter)**: Thanh tìm kiếm & thay thế dạng trượt mượt mà kèm tùy chọn thêm trực tiếp vào từ điển.
3. **Điều hướng chương trước / sau (Chapter Navigation)**: Bộ nút `←` và `→` chuyển nhanh giữa các chương đã lưu trong tủ truyện của bộ truyện hiện tại.
4. **Tự động cuộn & Highlight theo giọng đọc TTS (Smart TTS Follow)**: Đánh dấu câu đang đọc và tự động cuộn trang giữ câu đọc luôn ở giữa tầm mắt.
5. **Hệ thống phím tắt nhanh (Hotkeys System)**: Hỗ trợ phím tắt chuẩn (`Alt+S` lưu, `Alt+C` copy, `Alt+R` làm mới, `Alt+F` tìm kiếm, `Alt+Left`/`Alt+Right` chuyển chương) kèm popup bảng hướng dẫn phím tắt.

---

## 2. Chi Tiết Triển Khai Kỹ Thuật

### A. Cuộn Đồng Bộ Hai Chiều (Synchronized Scrolling)
- **Thanh công cụ**: Thêm nút bật/tắt icon `Link2` / `Unlink2` (hiển thị trạng thái On/Off).
- **Cơ chế**:
  - Gắn sự kiện `onScroll` cho cả `textarea` tiếng Trung và `div` hiển thị bản dịch Vietphrase.
  - Sử dụng ref `scrollingSourceRef: 'chinese' | 'vietphrase' | null` để tránh lặp vô hạn (infinite feedback loop).
  - Tính toán tỷ lệ cuộn chuẩn xác: `scrollPercent = scrollTop / (scrollHeight - clientHeight)`.
  - Cập nhật mượt mà vị trí cuộn của bên còn lại theo đúng tỷ lệ phần trăm.

### B. Tìm & Thay Thế Nhanh Trong Chương (Find & Replace)
- **Thanh công cụ**: Thêm nút icon `Replace` / `SearchCode` trên thanh công cụ.
- **Thanh trượt mở rộng (Collapsible Sub-bar)**:
  - Ô nhập từ tìm kiếm + hiển thị số lượng kết quả trùng khớp (`Kết quả: X / Y`).
  - Nút chuyển đến kết quả trước / kết quả kế tiếp.
  - Ô nhập cụm từ thay thế.
  - Nút "Thay thế" (từng từ) và "Thay thế tất cả".
  - Tùy chọn checkbox `+ Lưu vào từ điển Vietphrase`: Khi thay thế một cụm từ, tự động lưu luôn quy tắc này vào từ điển cá nhân để các lần dịch sau không cần phải gõ lại.

### C. Nút Chuyển Chương Trước & Sau (Chapter Navigation)
- **Thanh công cụ**: Bố trí cụm điều hướng nhỏ gọn `[←] [Chương X / Y] [→]` ngay bên cạnh tên chương:
  - Nếu chương đang mở thuộc về một bộ truyện trong thư viện:
    - Bấm `←`: Tự động tải và dịch chương trước đó trong danh sách chương của truyện.
    - Bấm `→`: Tự động tải và dịch chương tiếp theo.
  - Nếu đang dịch tệp văn bản tự do ngoài thư viện:
    - Bấm `→`: Tự động nhận diện số chương hiện tại và tăng lên (ví dụ: `Chương 1` -> `Chương 2`), làm sạch khung nhập tiếng Trung để người dùng sẵn sàng dán chương mới.

### D. Tự Động Cuộn Theo Giọng Đọc TTS (Smart TTS Auto-Scroll)
- **Cơ chế nhận diện câu**:
  - Tách nội dung đoạn văn Vietphrase thành các câu dựa trên dấu chấm câu (`.`, `!`, `?`, `\n`).
  - Theo dõi `currentSentenceIndex` theo tiến trình phát thanh Web Speech API.
  - Highlight câu đang đọc với viền sáng dịu mắt (`bg-cyan-500/20 ring-1 ring-cyan-500/50`).
  - Sử dụng `scrollIntoView({ behavior: 'smooth', block: 'center' })` để cuộn khung đọc theo câu đang phát âm thanh mà không làm giật màn hình.

### E. Hệ Thống Phím Tắt Nhanh (Hotkeys)
- Lắng nghe sự kiện `keydown` toàn cục (chỉ kích hoạt khi không xung đột với gõ văn bản):
  - `Alt + S`: Mở modal lưu chương vào thư viện.
  - `Alt + C`: Sao chép bản dịch đầy đủ vào Clipboard.
  - `Alt + R`: Làm mới bản dịch (Recalculate).
  - `Alt + F`: Bật/tắt thanh Tìm & Thay thế nhanh.
  - `Alt + ←` / `Alt + →`: Chuyển nhanh sang chương trước / chương sau.
  - `Alt + K`: Bật/tắt cuộn đồng bộ 2 chiều.
- Bổ sung nút trợ giúp nhỏ `[?]` trên thanh điều khiển để người dùng có thể xem nhanh bảng phím tắt bất kỳ lúc nào.

---

## 3. Các Tệp Sẽ Chỉnh Sửa
1. `src/components/views/TranslateView.tsx`:
   - Bổ sung các state cho Sync Scroll, Find & Replace, Chapter Navigation, TTS Highlight & Auto-scroll.
   - Thêm các icon và nút điều khiển trực tiếp trên thanh top bar.
   - Render thanh Tìm & Thay thế mở rộng khi được kích hoạt.
   - Thêm trình lắng nghe sự kiện phím tắt toàn cục và modal danh sách phím tắt.
2. `src/components/views/LibraryView.tsx` & `src/context/AppContext.tsx`:
   - Đảm bảo liên kết mượt mà khi chuyển đổi giữa các chương thuộc cùng 1 bộ truyện.

---

## 4. Kế Hoạch Xác Minh (Verification)
1. Kiểm tra cú pháp và TypeScript bằng `lint_applet` (`tsc --noEmit`).
2. Biên dịch toàn bộ dự án bằng `compile_applet`.
3. Kiểm tra tính tương thích trên cả chế độ Responsive (PC) và Mobile Frame.
4. Đảm bảo toàn bộ phím tắt và thao tác cuộn hoạt động ổn định, không xung đột hay gây gián đoạn trải nghiệm đọc.
