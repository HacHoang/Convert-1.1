# Kiểm tra dữ liệu và bộ máy convert — 31/10/2026

Nguồn đối chiếu: bộ TXT người dùng cung cấp trong thư mục Quick Translator -theWitcher. Chỉ đọc dữ liệu văn bản và cấu hình; không sửa tệp nguồn, chạy hoặc giải biên dịch EXE/DLL.

## Kết quả đọc tệp gốc

Các từ điển chính là UTF-8 hợp lệ. Đối chiếu bộ đọc nhập mới với toàn bộ khóa/giá trị của từng tệp, áp dụng quy tắc khóa trùng lấy dòng cuối:

| Tệp | Khóa duy nhất | Nghĩa rỗng | Khóa dài nhất | Khóa/giá trị đọc sai |
| --- | ---: | ---: | ---: | ---: |
| Names.txt | 136.889 | 8 | 38 | 0 |
| Names2.txt | 2.300 | 0 | 12 | 0 |
| Vietphrase.txt | 966.814 | 233 | 126 | 0 |
| ChinesePhienAmWords.txt | 12.571 | 0 | 1 | 0 |
| LuatNhan.txt | 222 | 0 | 12 | 0 |
| Pronouns.txt | 27 | 0 | 4 | 0 |

Số dòng không bằng số khóa duy nhất vì có chú thích, dòng trống và khóa trùng. Không tự bỏ các dòng `từ=`: nghĩa rỗng là dữ liệu có ý nghĩa.

Đã nạp toàn bộ Vietphrase.txt qua giao diện trên origin thử riêng, sau đó đọc lại IndexedDB: 966.814 khóa, 233 nghĩa rỗng, khóa dài nhất 126 ký tự. SHA-256 của toàn bộ cặp khóa/giá trị sau khi sắp xếp trùng tệp gốc: `81af8d4d1a95aafe476d1f84ec155010ffefabc0f94bf3294f61dd49b8de713f`. Tệp Name phụ và phiên âm cũng được thử nhập qua giao diện. Câu `罗彬缓缓睁眼。` hiển thị trực tiếp là `La Bân chậm rãi mở mắt.`

## Các lỗi đã sửa

- Bộ máy trước đây không nhận đầy đủ Name chính đang lưu, trong khi Name phụ có tham gia dịch. Tệp phiên âm nhập vào cũng chưa được nối đầy đủ với bộ máy và giao diện.
- Bộ đọc lớn bỏ nghĩa rỗng, khác với bộ đọc tệp nhỏ. Các luồng TXT nay dùng chung bộ đọc UTF-8/UTF-16, giữ cụm dài và phần nghĩa chứa dấu bằng; dữ liệu giải mã không hợp lệ được báo lỗi thay vì âm thầm chèn ký tự thay thế.
- Nhập lại Name phụ nay ghi đè theo khóa tiếng Trung, không tạo thêm các hàng trùng khi tải lại.
- Nhập TXT ghi theo lô và chỉ dựng lại danh sách từ điển khi kết thúc, tránh sao chép gần một triệu mục sau mỗi lô. Nếu một lô ghi thất bại, thông báo nêu số mục đã lưu và nạp lại phần đã ghi thành công; không báo thành công cho cả tệp.
- Cấu hình ưu tiên Name nay có hiệu lực. Name phụ ghi đè Name chính cho cùng khóa theo cấu hình bộ dữ liệu nguồn.
- Cụm có dấu câu không bị cắt trước khi dò từ điển. Các đoạn gốc được giữ nguyên thay vì mỗi câu thành một đoạn mới.
- Luật Nhân dùng bảng đã nhập, không tự ghép lại luật mặc định đã xóa. Cụm từ điển khớp trực tiếp thắng luật nhân có cùng độ dài; nghĩa đầu của mẫu được chọn trước khi thế `{0}`.
- Tùy chọn viết hoa được áp dụng. Cách chèn khoảng trắng/dấu câu cho màn hình, sao chép, lưu và đọc giọng nói dùng chung logic.
- Dịch nhanh, dịch nhiều chương, lấy truyện web và dịch trong trình đọc đều nhận Name chính và phiên âm hiện có. Từ điển Lạc Việt/Thiều Chửu/Babylon phục vụ tra cứu, không được tùy tiện trộn thành bảng Vietphrase.

## Đối chiếu bản giản thể và phồn thể

Cùng đoạn truyện nhưng khác dạng chữ có thể dò ra khóa khác:

- `罗彬缓缓睁眼。` → `La Bân chậm rãi mở mắt.` khi dùng trực tiếp dữ liệu được cung cấp. Câu này trùng câu tương ứng trong ảnh QuickTranslator.
- `羅彬緩緩睜眼。` dò vào dữ liệu khác. Tệp nguồn có `睁眼=mở mắt/trợn mắt`, nhưng `睜眼=tĩnh nhãn:trợn mắt/nhắm mắt/trợn mắt`; Name phụ có `罗彬=La Bân`, không có khóa `羅彬`.

Khác biệt này tồn tại trong chính dữ liệu nguồn, không phải lỗi phông chữ hay lỗi đọc UTF-8. Hermes chưa tự chuẩn hóa phồn thể sang giản thể. Muốn đánh giá tương đương phải dùng cùng nguyên văn, dạng chữ, bộ từ điển và cài đặt. Chọn văn phong trung tính khi đối chiếu bản convert thuần từ điển.

## Giới hạn và cách kiểm chứng

Chưa khẳng định tương đương hoàn toàn TranslatorEngine.dll: kết quả trên là kiểm tra dữ liệu, cấu hình và những câu có bằng chứng đối chiếu, không phải mô phỏng toàn bộ DLL. Đặc biệt chưa có bộ câu chuẩn cho mọi trường hợp đa nghĩa, Luật Nhân và chữ phồn thể.

Các tệp từng nhập lỗi cần được nhập lại. Nhập TXT hiện bổ sung/ghi đè theo khóa, không tự xóa khóa cũ không có trong tệp. Để so sánh đúng toàn bộ bộ dữ liệu: sao lưu trước, xóa từng bảng cần thay, rồi nhập đúng tệp tương ứng.

- Chạy kiểm tra nguồn: `node scripts/audit-quicktranslator.mjs "<thư mục QuickTranslator>"`.
- Kiểm thử logic: `npm test`; kiểm tra kiểu và build: `npm run lint`, `npm run build`.
- Kiểm thử lưu trữ trên origin thử riêng: [storage.browser.html](../tests/storage.browser.html), gồm nhập Name/phiên âm, lưu lại, xuất và xóa.
