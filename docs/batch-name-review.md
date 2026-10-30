# Duyệt tên và cập nhật bản dịch trong thư viện

## Dịch nhiều chương

1. Nạp chương và chọn **Dịch tất cả**. Kết quả ban đầu là bản nháp; chưa thể xuất file hay lưu thư viện.
2. App gợi ý các cụm có dạng tên người, xuất hiện ít nhất ba lần và có ngữ cảnh xưng tên/nói/hỏi/hành động. Tên có trong danh sách Name hoặc được bộ dịch nhận diện sẵn được loại khỏi gợi ý.
3. Hộp duyệt hiển thị chữ Trung, cách viết Hán Việt gợi ý, số lần, số chương và đoạn ngữ cảnh gốc/bản dịch. Gợi ý là suy đoán offline, có thể thiếu hoặc nhầm; không tự thêm tên vào từ điển.
4. Người dùng chọn và sửa tên cần chuẩn hóa. **Xác nhận bản dịch** áp dụng lại các tên đã chọn vào các chương dịch thành công, rồi mở thao tác xuất/lưu. Tùy chọn lưu vào Name cho lần sau mặc định tắt; nếu không chọn, các tên chỉ áp dụng cho lượt dịch hiện tại.
5. **Xem lại bản nháp** đóng hộp duyệt để kiểm tra các chương; xuất/lưu vẫn khóa đến khi xác nhận. Dịch lại, thay bộ nguồn hoặc đổi văn phong yêu cầu duyệt lại. Khi có chương lỗi, chỉ các chương dịch thành công được xuất/lưu.

Khi một tên gốc đã có bằng chứng độc lập, các cụm nối thêm chữ dễ thuộc câu phía sau như `才`, `能`, `没` hoặc `一` được chuyển vào nhóm **Hiện … cụm có thể dính từ sau tên**, mặc định ẩn. Người dùng vẫn có thể mở nhóm này và chọn thủ công. Tên dài có ngữ cảnh giới thiệu rõ (ví dụ `名叫…`) hoặc được gọi riêng được giữ trong danh sách chính. Không loại một tên chỉ vì nó kết thúc bằng âm “Tài”, “Năng” hay “Nhất”.

Bộ phát hiện hiện ưu tiên tên Trung có họ đơn/kép và ngữ cảnh rõ, không phải mô hình nhận diện thực thể tổng quát.

## Lưu bản dịch mới

Đối chiếu trong cùng bộ truyện theo nội dung nguồn, URL nguồn hoặc số chương/tiêu đề. Các phần `(1/2)`, `(2/2)` được tách riêng; các số chương khác nhau không bị gộp chỉ vì trùng nội dung. Trường hợp nhiều chương cũ cùng khớp số chương mà không xác định được duy nhất sẽ không ghi đè tùy ý.

- Lưu hàng loạt: **Ghi đè bản cũ**, **Giữ bản cũ** (chỉ thêm chương mới), hoặc **Hủy lưu**.
- Lưu từ màn hình dịch nhanh: hỏi xác nhận nếu chương đã có, hủy thì không lưu bản mới.
- Ghi đè giữ ID chương, thay nội dung/bản dịch và cập nhật thời gian lưu; toàn bộ lần lưu vẫn nằm trong một giao dịch thư viện. Nếu có xung đột mới ngoài danh sách vừa được duyệt, app yêu cầu xác nhận lại.

Kiểm thử gồm `tests/batchNamesAndLibrary.test.cjs` và luồng ghi đè trong `tests/storage.browser.html` trên origin kiểm thử riêng.
