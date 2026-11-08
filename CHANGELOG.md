# Lịch sử chỉnh sửa

Tài liệu này ghi các thay đổi đã áp dụng cho Hermes để tiện tra cứu sau này.
Các mục mới được thêm vào đầu phần **Chưa phát hành**.

## Chưa phát hành

### Giao diện

- Tách trang truyện trong Thư viện thành hai màn hình độc lập: **Thông tin truyện** chiếm toàn bộ vùng nội dung và **Danh sách chương** có thanh tìm kiếm, chọn, sắp xếp, xóa và phân trang riêng. Bấm hàng **Danh sách chương ›** hoặc vuốt trái để mở danh sách; vuốt phải hoặc bấm **Thông tin truyện** để quay lại. Tối ưu lại thẻ thông tin, nhóm thao tác và thanh công cụ chương cho mobile lẫn desktop.
- Áp dụng quy tắc ổn định bố cục trên toàn ứng dụng: thông báo/trạng thái phát sinh không được chèn thêm hàng làm nội dung phía dưới nhảy vị trí. Xóa dòng “Đã tick…” phía trên bảng dịch hàng loạt; chuyển trạng thái cần thao tác thành overlay, lỗi nhập liệu sang vùng có chiều cao cố định và trạng thái từng dòng vào ô trạng thái sẵn có. Bổ sung kiểm thử chống tái xuất hiện mẫu giao diện này.
- Hạ cụm popup thông báo trên mobile xuống dưới toàn bộ thanh đầu và vùng an toàn của thiết bị; popup được neo theo khung ứng dụng thay vì theo mép trình duyệt nên không còn che menu, tiêu đề hoặc các nút trên cùng trong chế độ khung điện thoại.
- Chuẩn hóa thông báo toàn ứng dụng thành popup nổi không chiếm không gian bố cục và tự ẩn sau vài giây; lưu tối đa 100 thông báo gần nhất để xem lại hoặc xóa trong mục chuông của menu ba gạch, kể cả sau khi tải lại trang.
- Loại bỏ các thanh thông báo ngang ở dịch hàng loạt, trình đọc, sao lưu và nhập truyện từ web; trạng thái tác vụ dài vẫn hiển thị dạng nổi kèm điều khiển cần thiết nên không đẩy nội dung trang xuống dưới.
- Căn lại hai lựa chọn lưu truyện về cùng chiều rộng và chiều cao 36px; bỏ phép căn theo phần tử inline khiến ô chọn và nút bị lệch nhau.
- Loại bỏ lớp viền/nền bọc thừa quanh ô **Chọn từ Thư Viện**; hai lựa chọn lưu truyện nay là hai control độc lập có cùng chiều cao, một lớp viền và cùng màu nền.
- Rút gọn và căn giữa hai thẻ chọn truyện trong cửa sổ lưu: **Chọn từ Thư Viện** và **Thêm Truyện mới**; bỏ biểu tượng dấu cộng cùng phần giải thích thừa.
- Đồng bộ hai lựa chọn trong cửa sổ lưu chương: cùng hệ thẻ nền, viền và bo góc tối giản; nút tạo truyện mới có trạng thái nhấn accent nhẹ, dễ nhận biết mà vẫn hài hòa với giao diện.
- Thư viện hỗ trợ chọn nhiều chương bằng ô chọn tròn trên từng dòng hoặc **Chọn tất cả** cạnh bộ sắp xếp; nút xóa hàng loạt hiển thị số lượng, yêu cầu xác nhận và chỉ xóa các chương đã chọn. Thanh điều khiển đã gộp về một hàng, tiêu đề rút gọn thành **Danh sách chương**, đồng thời bỏ nhãn “100 chương/tập” khỏi phân trang.
- Xóa nhiều chương trong Thư viện nay gộp toàn bộ ID vào một lần lọc và một lần ghi IndexedDB chạy nền; hộp thoại đóng ngay sau khi xác nhận, chỉ báo khi hoàn tất hoặc gặp lỗi.
- Chuẩn hoá toàn bộ ô nhập, chọn và vùng văn bản với góc bo tròn nhất quán; checkbox và radio nay dùng dấu chọn tròn, dễ nhận biết ở mọi màn hình.
- Sửa chiều dấu tick trong checkbox tròn để khớp hướng quen thuộc.
- Loại bỏ thanh thao tác nổi khi chọn từ điển để danh sách gọn hơn và tránh lặp lại thông tin chọn.
- Đặt nút xóa theo lựa chọn tại cột thao tác của bảng từ điển, tách khỏi nhóm nhập, xuất và thêm mục.
- Nút xóa ở cột thao tác nay chỉ xóa các mục đã chọn; chọn tất cả trước khi xóa nếu cần xóa toàn bộ bảng.

### Dịch hàng loạt

- Sửa **Lưu vào máy**: bản Windows dùng hộp chọn thư mục native và ghi trực tiếp từng file hoàn chỉnh theo đúng định dạng đã chọn, không phụ thuộc file tạm của Chromium. Khi trình duyệt tích hợp VS Code chặn bộ chọn thư mục, app tự tải một gói ZIP duy nhất chứa đúng các file TXT, DOCX, EPUB hoặc PDF thay vì báo nhầm là người dùng đã hủy.
- Viết hoa chữ cái Unicode đầu tiên của từng dòng bản dịch; nếu dòng bắt đầu bằng dấu câu, dấu nháy, số hoặc ký hiệu thì các ký tự đó được giữ nguyên và chữ cái đầu tiên phía sau được viết hoa. Quy tắc áp dụng đồng nhất khi xem, lưu Thư viện và xuất TXT, DOCX, EPUB hoặc PDF.
- Ngăn trạng thái dịch bị kẹt ở 0% sau hot reload hoặc khi Worker mất phản hồi: mỗi tác vụ có mã nhận diện, tín hiệu hủy và thời hạn được gia hạn theo heartbeat/tiến độ; tác vụ dịch im lặng quá 120 giây tự dừng, giải phóng khóa và cho phép chạy lại. Trạng thái kiểu cũ còn sót sau cập nhật cũng được tự nhận diện và xóa ngay.
- **Lưu vào máy** nay có TXT, DOCX, EPUB và PDF. Ứng dụng chỉ hỏi chọn thư mục một lần, sau đó ghi tuần tự mọi chương đã chọn vào thư mục đó theo đúng tên file hiển thị trong bảng; không còn bật hàng nghìn hộp thoại lưu hoặc giữ hàng nghìn file trong bộ nhớ.
- Cửa sổ **Lưu vào Thư viện** tách thành hai lựa chọn rõ ràng: **Thêm vào Thư viện** để chọn truyện có sẵn và **Tạo truyện mới** để mở popup tạo truyện đầy đủ trước khi lưu chương.
- Ô nhập tên truyện khi lưu lô vào Thư viện nay để trống mặc định và chỉ hướng dẫn bằng placeholder **Nhập tên truyện…**; giá trị mẫu cũ không thể bị lưu thành tên truyện.
- Giữ mã nhận diện ổn định cho từng chương trong hàng đợi dịch. Khi nguồn lặp số chương, thư viện vẫn lưu đủ các chương riêng biệt và lần lưu lại chỉ bổ sung phần còn thiếu, không tạo bản sao.

- Chuẩn hoá dấu câu tiếng Việt trong phần xem trước, xuất tệp và nội dung dịch hàng loạt; thay các dạng dấu câu theo kiểu Trung Quốc bằng cách trình bày tiếng Việt phù hợp.
- Tối ưu hộp hiển thị văn phong hiện tại để giữ vị trí và kích thước nhất quán ở dịch nhanh, dịch hàng loạt, PC và mobile.
- Trên mobile, đổi vị trí giữa lựa chọn **Lưu vào…** và phạm vi **Lưu từ / đến**; trên PC đưa **Lưu vào…** về cuối hàng công cụ.
- Đổi nhãn **Tên truyện:** thành **Hoặc**.
- Chuyển lựa chọn truyện thư viện và ô nhập truyện mới vào bảng con của **Lưu vào thư viện**.
- Bổ sung nút **Hủy** và **Lưu** cho phần lưu vào thư viện; thêm biểu tượng bút cho ô truyện mới và tự ẩn biểu tượng khi người dùng đang nhập.
- Chỉnh các bảng con của **Lưu vào…**: không tràn màn hình mobile, không nhảy vị trí trên PC, không chồng chữ; thống nhất chiều rộng bảng chính và bảng con của mục lưu thư viện.
- Cho phép bấm lại **Lưu vào thư viện** để đóng bảng con; mũi tên chuyển giữa dạng mở rộng và dạng hướng lên tùy theo trạng thái.
- Căn bảng chọn định dạng `.txt` / `.docx` sát về phía mũi tên của **Lưu vào máy**.
- Rút ngắn chiều rộng bảng lưu vào thư viện để loại bỏ khoảng trống thừa.
- Thêm nháp khôi phục cho danh sách dịch hàng loạt trong IndexedDB. Hàng đợi, nội dung đã dịch, phạm vi lưu, trạng thái duyệt và thông tin truyện được khôi phục sau reload/hot reload; chương đang xử lý được đưa về trạng thái chờ an toàn.
- Đồng bộ nháp khi thêm, xóa, đổi văn phong hoặc dịch lại chương để tránh mất dữ liệu đang làm.
- Loại bỏ lượt chuyển đổi văn bản trùng lặp khi dịch hàng loạt: mỗi tiêu đề/nội dung chỉ đi qua luồng dịch nhanh một lần, giảm đáng kể thời gian xử lý danh sách dài.
- Chuyển tác vụ dịch hàng loạt sang Web Worker. Giao diện, các tab khác và thao tác trong ứng dụng không còn bị chặn bởi việc dịch từng chương.
- Xử lý kết quả theo lô 6 chương thay vì cập nhật trạng thái từng chương; giảm số lần render, sao chép mảng chương và ghi IndexedDB.
- Tái sử dụng các lookup từ điển, tên và luật dịch xuyên suốt một đợt dịch thay vì dựng lại cho mỗi tiêu đề/nội dung.
- Tắt việc tạo mảng `segments` theo từng ký tự ở chế độ chỉ cần văn bản dịch hàng loạt, giảm mạnh object tạm, áp lực thu gom rác và RAM.
- Thêm nút X ở cuối ô **Tìm chương…**. Nút chỉ hiện khi ô có nội dung và đưa kết quả tìm về trạng thái trống khi bấm.

### Lưu dữ liệu

- Thư viện dùng liên kết bắt buộc theo ID truyện. Khi mở, nhập sao lưu hoặc ghi dữ liệu, ứng dụng tự loại chương legacy không có ID truyện, chương mồ côi và ID chương trùng; tạo truyện trùng tên không thể nhận lại dữ liệu cũ.
- Làm rõ hành vi lưu: **Lưu vào máy** tải tệp qua trình duyệt; **Lưu vào thư viện** lưu dữ liệu thư viện trong IndexedDB của trình duyệt.
- Nâng phiên bản IndexedDB và thêm kho dữ liệu riêng cho nháp dịch hàng loạt, tách từng chương để không phải ghi lại toàn bộ truyện sau mỗi chương hoàn tất.

### Kiểm tra gần nhất

- `npm run lint`: đạt.
- `npm test -- --run`: 144/144 kiểm thử đạt.
- `npm run build`: đạt.

## Quy ước cập nhật

- Mỗi chỉnh sửa có tác động thấy được bởi người dùng phải được ghi vào mục **Chưa phát hành**.
- Khi phát hành phiên bản, chuyển các mục tương ứng sang một tiêu đề phiên bản có ngày phát hành.
