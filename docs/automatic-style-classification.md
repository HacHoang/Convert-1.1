# Phân loại văn phong bộ mặc định — 01/11/2026

Nguồn là bảy bảng dữ liệu đã nạp trên app, chụp lúc 2026-11-01T01:47:36.324Z. Không chứa thư viện truyện, tài khoản, API key hay cài đặt cá nhân. Các bảng được lưu nguyên vẹn; thẻ được lưu riêng trong bộ mặc định.

| Dữ liệu | Số từ/tên | Số nghĩa đã phân tích | Nghĩa có thẻ chuyên biệt |
| --- | ---: | ---: | ---: |
| Vietphrase | 966.813 | 1.149.116 | 12.944 |
| Name chính | 136.889 | 138.242 | 1.201 |
| Name phụ | 2.300 | 2.302 | 29 |
| Tổng | 1.106.002 | 1.289.660 | 14.174 |

Sáu nghĩa có phân loại thủ công được giữ nguyên. Phiên âm có 12.571 mục, Luật Nhân 222, Đại từ 27 và Cụm bỏ qua 187; các bảng này được đóng gói cùng bộ mặc định, không suy đoán văn phong cho ký tự phiên âm hay mẫu quy tắc.

## Cách phân loại

- Tách các nghĩa theo đúng quy tắc Vietphrase của bộ dịch, gồm cả nghĩa rỗng. Phân tích từng nghĩa độc lập.
- Đối chiếu mục từ–nghĩa với các mẫu văn phong sẵn có; dùng dấu hiệu rõ như tu tiên, bệ hạ, ma pháp, hẹn hò, phi thuyền, phó bản, senpai hoặc oppa.
- Kiểm tra ranh giới từ để tránh gắn thẻ chỉ do trùng một phần chuỗi. Các khái niệm phổ thông như gen, năng lượng, nhiệm vụ, trang bị không tự xác định thể loại.
- Không suy đoán tên người thuộc Hàn Quốc/Phương Tây chỉ từ họ. Nghĩa không đủ căn cứ dùng Trung tính.
- Một nghĩa có thể thuộc nhiều văn phong. Nhiều nghĩa cùng văn phong được ưu tiên theo thứ tự ban đầu, không đảo hoặc sửa nghĩa.

Đây là phân loại tự động theo quy tắc `meaning-rules-v1`, chưa phải duyệt thủ công từng nghĩa. Các từ đa nghĩa hoặc phụ thuộc ngữ cảnh vẫn có thể cần sửa thẻ trong app.

## Lưu và khôi phục

[Manifest](../public/assets/default-dictionaries/manifest.json) ghi phiên bản `2026-11-01-style-tags-v1`, số mục, kích thước và SHA-256. Các tệp từ điển gzip được lấy từ đúng dữ liệu đã chụp; [thống kê JSON](../public/assets/default-dictionaries/classification-report.json) ghi số lượng đầy đủ theo từng văn phong.

Bộ thẻ [meaning_styles.json.gz](../public/assets/default-dictionaries/meaning_styles.json.gz) có 13.528 từ/tên cần bản ghi riêng, nén còn 176.616 byte. Các nghĩa chỉ mang thẻ Trung tính được biểu diễn bằng một quy tắc chung, tránh tạo hơn một triệu bản ghi lặp và giảm bộ nhớ trên mobile. Mọi nghĩa vẫn hiển thị thẻ khi mở bảng hoặc hộp thuộc tính. Thẻ Trung tính tự động không thay nghĩa mặc định của từ; các lựa chọn Trung tính do người dùng chỉnh vẫn được ưu tiên.

App cài mới, Nạp mặc định và Đặt lại từ điển đều tải dữ liệu cùng thẻ trong một giao dịch. Sao lưu JSON giữ cả thẻ chuyên biệt và quy tắc Trung tính. Nhập TXT mới chỉ thay từ/nghĩa, không tự phân tích thêm thẻ chuyên biệt.
