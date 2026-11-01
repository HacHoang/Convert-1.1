# Bộ từ điển mặc định của Hermes

Snapshot lấy trực tiếp từ bảy bảng dữ liệu đang dùng trên app ngày 01/11/2026. Bản sao giữ nguyên từ, nghĩa và các mục đã sửa/xóa tại thời điểm chụp.

| Bảng | Số mục |
| --- | ---: |
| Vietphrase | 966.813 |
| Name chính | 136.889 |
| Name phụ/cá nhân | 2.300 |
| Phiên âm Hán Việt | 12.571 |
| Luật Nhân | 222 |
| Đại từ | 27 |
| Cụm bỏ qua | 187 |

[manifest.json](./manifest.json) ghi phiên bản, số mục, kích thước và SHA-256 từng tệp gzip. Tổng dữ liệu nén khoảng 12,35 MiB. Tệp không chứa thư viện truyện, cài đặt hay tài khoản.

App tự nạp snapshot khi chưa có dữ liệu từ điển và chưa có dấu khởi tạo. Dữ liệu của bản đang dùng không bị ghi đè khi cập nhật. “Nạp mặc định” và “Đặt lại từ điển” khôi phục cùng snapshot này, sau khi người dùng xác nhận.

Thẻ văn phong nằm trong [meaning_styles.json.gz](./meaning_styles.json.gz), được kiểm tra SHA-256 và lưu cùng các bảng trong một giao dịch. Cả nghĩa chính và nghĩa thay thế của Vietphrase, Name chính và Name phụ đã được phân tích. Một nghĩa có thể có nhiều thẻ; nhiều nghĩa cùng thẻ vẫn giữ thứ tự ưu tiên của từ điển.

Các nghĩa không có dấu hiệu đủ rõ dùng quy tắc Trung tính chung, giúp giảm bộ thẻ xuống khoảng 173 KiB thay vì lưu hàng triệu bản ghi lặp. Sáu nghĩa đã có phân loại thủ công được giữ nguyên. Không suy đoán văn hóa của tên người chỉ từ họ. Thẻ Trung tính tự động không thay nghĩa gốc khi dịch.

Xem [báo cáo phân loại](../../../docs/automatic-style-classification.md) và [thống kê JSON](./classification-report.json). Thẻ tự động là suy luận theo quy tắc ngôn ngữ, có thể chỉnh lại trong app; không thay đổi chuỗi nghĩa gốc.

Các từ điển tham khảo chỉ đọc vẫn dùng các tệp trong [aistudio/](../aistudio/). Việc lưu snapshot không thay đổi tình trạng quyền phân phối của dữ liệu nguồn.
