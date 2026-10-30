# Truyện từ web

Mở **Truyện từ web** trên thanh điều hướng hoặc trong menu app.

1. Nhập URL trang truyện/mục lục, chọn **Phân tích**. Với mục lục nhiều trang, bật **Thêm chương vào danh sách hiện có** trước khi phân tích trang tiếp theo.
2. Kiểm tra tên và URL; chọn khoảng chương, đảo thứ tự hoặc bỏ chọn các liên kết không thuộc truyện. URL trùng được loại tự động.
3. Chọn **Tải thử** một chương và **Xem trước** để kiểm tra. Nếu lẫn quảng cáo/menu, mở **Tùy chỉnh lấy nội dung**: nhập selector vùng nội dung và các vùng bỏ qua, sau đó **Tải lại** chương thử.
4. Tải các chương đã chọn. Có thể dừng, tiếp tục hoặc thử lại riêng các chương lỗi. Bản nháp và nội dung đã tải được lưu trong IndexedDB của trình duyệt này.
5. Sửa tên truyện, tác giả, ngôn ngữ và bìa; chọn bản gốc, Vietphrase hoặc Hán Việt. Kiểu chữ và giãn dòng có bản xem trước, được nhúng vào EPUB (thiết bị đọc có thể dùng thiết lập riêng).
6. **Xuất EPUB** giữ đúng thứ tự danh sách, tạo mục lục và nhúng bìa. Chỉ xuất khi tất cả chương đang chọn đã có nội dung. **Lưu vào thư viện** cho phép đọc và tiếp tục xử lý trong app; thư viện dùng IndexedDB và chỉ báo lưu thành công sau khi giao dịch hoàn tất. Dung lượng vẫn phụ thuộc trình duyệt; khi ghi thất bại, bản nháp được giữ để thử lại hoặc xuất EPUB.

## Trang chặn tải hoặc cần JavaScript

App lấy HTML công khai qua máy chủ, không đọc cookie/phiên đăng nhập của trình duyệt và không có bộ parser riêng cho mọi website. HTTP 403, trang xác minh, nội dung chỉ sinh bằng JavaScript hoặc trang đăng nhập có thể không tải được.

- Với mục lục, điền URL gốc và dùng **Trang chặn tải? Nhập HTML từ máy** để nhập trang đã lưu từ trình duyệt.
- Có thể dán danh sách URL, mỗi dòng `URL | Tên chương`.
- Ở từng chương, chọn **Nhập nội dung / sửa URL** để dán văn bản hoặc nhập HTML đã lưu, sửa nội dung trước khi xuất.
- Nội dung nhận về luôn được xử lý như văn bản; không chạy script hoặc hiển thị HTML gốc trong app.

## Giới hạn hiện tại

- Nhận diện mặc định các tiêu đề dạng `第123章`, `Chương 123`, `Chapter 123`; các mẫu khác cần selector mục lục.
- Chỉ tự lấy liên kết cùng nguồn với mục lục; liên kết khác nguồn có thể thêm thủ công.
- Tối đa 5.000 chương mỗi bản nháp; mỗi tài nguyên tối đa 8 MB, timeout 25 giây. Tải tuần tự với khoảng nghỉ có thể chỉnh.
- Bìa hỗ trợ JPEG, PNG, WebP. EPUB bản đầu này tập trung truyện chữ; không thu thập tranh/ảnh minh họa trong từng chương.
- Dữ liệu bản nháp nằm trên máy/trình duyệt hiện tại, chưa đồng bộ tài khoản. Không xóa dữ liệu website trước khi xuất sách cần giữ.
- Cần chạy máy chủ app (Vite khi phát triển hoặc Express khi triển khai); chỉ phục vụ tệp tĩnh sẽ không có API tải web.

## Kiểm tra

`npm run lint`, `npm test`, `npm run build`. Kiểm thử máy chủ và EPUB nằm ở [webImport.test.cjs](../tests/webImport.test.cjs).
