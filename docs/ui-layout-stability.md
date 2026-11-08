# Quy tắc ổn định bố cục

Mọi màn hình, hộp thoại và chế độ của Hermes phải giữ nguyên vị trí các thành phần đang hiển thị khi trạng thái bất đồng bộ thay đổi.

## Quy tắc bắt buộc

- Không chèn có điều kiện một dòng thông báo, trạng thái, bộ đếm hoặc lỗi vào trước nội dung đang hiển thị.
- Thông báo ngắn dùng hệ thống popup toàn cục và tự ẩn; lịch sử vẫn xem được từ menu ứng dụng.
- Tác vụ cần nút thao tác dùng overlay `fixed` hoặc `absolute`, không tham gia luồng bố cục.
- Lỗi kiểm tra dữ liệu cần nằm cạnh trường nhập phải dùng một vùng có chiều cao cố định được dựng sẵn từ đầu; nội dung dài rút gọn và xem đầy đủ qua `title`.
- Trạng thái của một dòng dữ liệu phải tích hợp vào ô trạng thái hiện có, không tạo thêm dòng con làm thay đổi chiều cao hàng.
- Nội dung rỗng, phân trang và các khối do người dùng chủ động mở như `details` hoặc hộp thoại không được xem là thông báo phát sinh.

Kiểm thử `layoutStability.test.cjs` chặn lại mẫu lỗi cũ và các `status`/`alert` có điều kiện nằm trong luồng bố cục.
