# Dịch offline dựa trên dữ liệu QuickTranslator

## Nguồn đã khảo sát

Nguồn khảo sát: bộ QuickTranslator do người dùng cung cấp.
Đã đọc cấu hình từ điển, mẫu Luật Nhân, đại từ, Hán Việt và danh sách loại bỏ; dự án đã có bản sao nhiều tệp dữ liệu trong `public/assets/aistudio`.
Không chạy hoặc giải biên dịch EXE/DLL. Những thay đổi này không khẳng định tương thích hoàn toàn với TranslatorEngine.dll.

## Vai trò dữ liệu

| Tệp | Vai trò |
| --- | --- |
| Names.txt | Tên riêng chính |
| Names2.txt | Tên riêng phụ, cấu hình gốc quy định ghi đè Names chính |
| Vietphrase.txt | Cụm tiếng Trung và các nghĩa phân cách bằng `/` |
| ChinesePhienAmWords.txt | Âm Hán Việt |
| ChinesePhienAmEnglishWords.txt | Dữ liệu phiên âm từ tiếng Anh |
| LuatNhan.txt | Mẫu `{0}` ở đầu vào và đầu ra |
| Pronouns.txt | Đại từ cho Luật Nhân; cấu hình gốc nói không dùng trực tiếp như VietPhrase |
| IgnoredChinesePhrases.txt | Các đoạn quảng cáo, rác cần loại khỏi bản dịch |
| LacViet, ThieuChuu, Babylon, CEDict | Dữ liệu tra cứu, cần bộ phân tích riêng theo định dạng |
| History, log, backup, template | Lịch sử và trình bày; không trộn thành từ điển dịch |

Cấu hình nguồn dùng `ThuatToanNhan=2`: Pronouns + Names. Chưa suy luận thứ tự ưu tiên đầy đủ của DLL chỉ từ cấu hình này.

## Cải tiến đã áp dụng

- Cache bảng Names/VietPhrase bằng WeakMap theo tham chiếu dữ liệu, tránh dựng lại trên từng chương. Khi sửa dữ liệu, phải thay đối tượng/mảng thay vì sửa tại chỗ.
- Chỉ mục độ dài theo ký tự đầu, tái sử dụng cùng bảng tra. So khớp dài nhất không còn giới hạn cứng 12 ký tự; Luật Nhân cũng không còn giới hạn tên 6 ký tự.
- Các cụm loại bỏ tạo token dịch rỗng, giữ nguyên nguồn và offset để tra từ/bôi đen không lệch.
- Giữ liền chuỗi Latin, chữ Việt và số, tránh tách `Chương` thành từng chữ.
- Kiểm thử cập nhật từ điển, ưu tiên tên trên cụm cùng độ dài, mẫu Luật Nhân, nghĩa đầu rỗng, cụm dài và offset nguồn.

## Công việc tiếp theo cần kiểm chứng

- Tách xử lý dịch sang Web Worker; cache bảng tra chưa loại bỏ toàn bộ tác vụ nặng khỏi luồng giao diện.
- Đưa dữ liệu lớn qua bộ nhập theo khối và phiên bản IndexedDB, tránh tự động nhập lại hoặc ghi đè chỉnh sửa cá nhân.
- Hoàn thiện bộ nạp riêng cho Names2/Hán Việt và từ điển tra cứu, đối chiếu toàn bộ bộ dữ liệu gốc với bản đang lưu trong app.
- Lập tập câu chuẩn do người dùng duyệt để đo chất lượng thứ tự từ, ưu tiên tên và luật nhân; đây vẫn là convert dựa từ điển, không phải dịch ngữ nghĩa bằng mô hình AI.

## Điều kiện phân phối dữ liệu

Chưa có bằng chứng giấy phép hoặc sự cho phép tái phân phối cho các bộ từ điển nguồn ngoài trong kho này. Việc người dùng cung cấp tệp không đồng nghĩa với quyền phát hành công khai.

Trước khi public, chủ dự án cần ghi nhận tác giả/chủ sở hữu, nguồn gốc, giấy phép, phạm vi quyền phân phối và yêu cầu ghi công cho từng bộ trong `public/assets/aistudio/` và dữ liệu được nhúng trong `src/data/`. Nếu chưa xác nhận được quyền, phải loại bộ dữ liệu tương ứng khỏi bản phát hành. Không tự gán giấy phép của mã ứng dụng cho dữ liệu từ điển.

Theo yêu cầu lưu bộ hiện tại làm mặc định toàn app, lần mở đầu khi chưa có từ điển tự nạp snapshot gzip khoảng 11,7 MB trong [default-dictionaries/](../public/assets/default-dictionaries/). Bản đang có dữ liệu không bị ghi đè. “Nạp mặc định” khôi phục snapshot này thay vì nạp các tệp gốc rời rạc. Cần đo lần nạp trên thiết bị di động và mạng yếu trước khi quyết định production.
