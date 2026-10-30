# Bộ từ điển mặc định của Convert

Snapshot lấy từ bộ từ điển đang dùng ngày 30/10/2026. Dữ liệu tích hợp đang có hiệu lực được gộp vào snapshot; bỏ shortcut thương hiệu cũ theo yêu cầu đổi tên app trước đó.

| Bảng | Số mục |
| --- | ---: |
| Vietphrase | 966.608 |
| Name chính | 136.889 |
| Name phụ/cá nhân | 2.344 |
| Phiên âm Hán Việt | 12.571 |
| Luật Nhân | 222 |
| Đại từ | 27 |
| Cụm bỏ qua | 187 |

[manifest.json](./manifest.json) ghi phiên bản, số mục, kích thước và SHA-256 từng tệp gzip. Tổng dữ liệu nén khoảng 11,7 MB. Tệp không chứa thư viện truyện, cài đặt hay tài khoản.

App tự nạp snapshot khi chưa có dữ liệu từ điển và chưa có dấu khởi tạo. Dữ liệu của bản đang dùng không bị ghi đè khi cập nhật. “Nạp mặc định” và “Đặt lại từ điển” khôi phục cùng snapshot này, sau khi người dùng xác nhận.

Các từ điển tham khảo chỉ đọc vẫn dùng các tệp trong [aistudio/](../aistudio/). Việc lưu snapshot không thay đổi tình trạng quyền phân phối của dữ liệu nguồn.
