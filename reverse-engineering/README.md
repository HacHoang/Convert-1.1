# TranslatorEngine reverse-engineering notes

Nguồn đối chiếu là `TranslatorEngine.dll` phiên bản 1.4 trong bộ Quick Translator do người dùng cung cấp. Tệp gốc chỉ được đọc và có SHA-256:

`0F7E550CD95A90F3E6AE2254B340CFAD57A123720CFDA083A1B5C475AFD7697F`

Mã C# trong thư mục này là kết quả giải biên dịch để kiểm tra hành vi. Hermes không tải, gọi hay phân phối DLL gốc và không cần .NET khi chạy.

Phần đã port sang TypeScript nằm ở `src/utils/quickTranslatorPort.ts`. Bộ kiểm tra `tests/quickTranslatorPort.test.cjs` dùng dữ liệu mặc định của Hermes và so đầu ra đã thu từ DLL gốc cho cả ba chế độ thuật toán.

Các hành vi đã port:

- ghép Names và VietPhrase với Names ưu tiên khi trùng khóa;
- lấy nghĩa đầu tiên theo dấu `/` hoặc `|`;
- dò cụm tối đa 20 ký tự;
- ba chế độ chọn cụm của Quick Translator;
- ưu tiên tên riêng và phát hiện tên nằm chồng trong cụm;
- Luật Nhân `{0}` với Pronouns + Names;
- quy tắc Hán Việt dự phòng, viết hoa, khoảng trắng, dấu câu và kiểu bọc ngoặc.

Thư mục Quick Translator bên ngoài workspace không được sửa trong quá trình này.
