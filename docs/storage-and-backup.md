# Lưu trữ và sao lưu

IndexedDB `ConvertAppDB` phiên bản 3 lưu thư viện, cài đặt và thống kê trong `app_store`. Khi nâng cấp, app chuyển dữ liệu từ các khóa localStorage cũ nếu chưa có bản IndexedDB; các bản cũ vẫn được giữ làm nguồn phục hồi. Mảng rỗng là dữ liệu hợp lệ, không được thay bằng truyện mẫu.

## Bộ từ điển mặc định toàn app

Snapshot ngày 30/10/2026 trong [default-dictionaries/](../public/assets/default-dictionaries/) là bộ mặc định khi cài mới/cài lại sau khi dữ liệu trình duyệt đã được xóa: 966.608 Vietphrase, 136.889 Name chính, 2.344 Name phụ, 12.571 phiên âm, 222 Luật Nhân, 27 đại từ và 187 cụm bỏ qua. Tổng dữ liệu nén khoảng 11,7 MB. Các bảng tham khảo chỉ đọc vẫn dùng asset nguồn đang có.

Lần mở đầu trên một bản cài trống sẽ tải, giải nén và kiểm tra snapshot, rồi ghi tất cả bảng cùng dấu khởi tạo trong một giao dịch. Có tiến trình tải/lưu; lỗi mạng hoặc lỗi ghi không để lại dấu hoàn tất hay dữ liệu mặc định dở dang. Nếu đã có bất kỳ dữ liệu từ điển nào, bước khởi tạo giữ nguyên dữ liệu đó; việc xóa trắng có chủ ý sau khi khởi tạo cũng được giữ nguyên. Cả “Nạp mặc định” và “Đặt lại từ điển” khôi phục snapshot này, không thay đổi truyện/cài đặt.

Các snapshot được lưu theo bảng trong `app_store`, tránh phát sinh hơn một triệu yêu cầu ghi lúc khởi tạo. Thêm/sửa tiếp tục dùng các object store từ điển cũ; danh sách khóa đã xóa bảo đảm mục thuộc bộ mặc định không xuất hiện lại sau khi tải trang. Hàm đọc hợp nhất snapshot với các chỉnh sửa, đồng thời vẫn đọc được bản cài cũ đang lưu từng mục. Backup xuất dữ liệu hợp nhất; khôi phục thay thế cả snapshot và chỉnh sửa trong cùng giao dịch.

Thao tác lưu thư viện chờ giao dịch hoàn tất trước khi cập nhật giao diện hoặc báo thành công. Nhập hàng loạt và nhập web lưu bộ truyện cùng các chương trong một giao dịch, loại chương trùng theo nội dung nguồn trong cùng truyện. Khi lỗi quota hoặc quyền lưu trữ, giao dịch không thay đổi dữ liệu cũ.

Backup JSON phiên bản 3 chứa bảy bảng từ điển trong IndexedDB, danh sách truyện, chương, cài đặt và thống kê. Dữ liệu tích hợp sẵn trong mã nguồn vẫn đi kèm ứng dụng, không cần chép lại vào backup. Khôi phục kiểm tra định dạng trước khi thay thế toàn bộ các phần được cung cấp trong một giao dịch. Hỗ trợ bản cũ `2.6-offline` và JSON từ điển phiên bản 1–2: phần thiếu được giữ nguyên, phần có giá trị rỗng sẽ xóa nội dung hiện tại. Phiên đăng nhập không nằm trong backup.

Backup mới có nhãn `app: "Convert"` và tên `convert_backup_….json`. Nhãn app và tiền tố localStorage cũ chỉ được nhận diện trong lớp tương thích; các tùy chọn mới dùng tiền tố `convert_`, dữ liệu IndexedDB hiện có được giữ nguyên.

Nhập từ điển lớn ghi theo lô tối đa 5.000 mục. Nếu một lô thất bại, các lô đã hoàn tất vẫn được giữ; giao diện thông báo số mục đã lưu. Đây là nhập bổ sung theo lô, không phải khôi phục backup nguyên tử.

## Kiểm thử

- `npm test`: kiểm tra định dạng backup, tương thích bản cũ, dữ liệu sai, parser UTF-8 qua ranh giới khối, dòng dài và lỗi ghi theo lô.
- `npm run lint` và `npm run build`.
- Kiểm thử IndexedDB thật: chạy `npm run dev -- --port 3011`, mở `http://127.0.0.1:3011/tests/storage.browser.html` và kiểm tra `ALL PASSED`. Dùng origin riêng cho kiểm thử; fixture thay đổi dữ liệu tại origin đó và khôi phục snapshot ban đầu khi kết thúc.
- Fixture trình duyệt kiểm tra chuyển localStorage, mở lại provider, chương lớn hơn giới hạn localStorage, loại trùng, lỗi quota, rollback, xóa cụm bỏ qua và vòng xuất–khôi phục sau reset.
- Kiểm thử mặc định toàn app dùng origin trống riêng: chạy `npm run dev -- --port 3013`, mở `http://127.0.0.1:3013/tests/defaultDictionaries.browser.html`. Fixture kiểm tra lỗi tải lần đầu, cài mới, giữ chỉnh sửa đang có và reset đủ các bảng; không chạy trên origin đang chứa dữ liệu người dùng.

## Giới hạn còn cần đo

Thư viện hiện được lưu thành snapshot; mỗi lần sửa vẫn phải clone snapshot trong IndexedDB. Nhập hàng loạt gom thành một lần ghi để giảm chi phí, nhưng cần đo trên thư viện lớn và điện thoại trước production. IndexedDB vẫn có quota và có thể bị trình duyệt thu hồi dữ liệu; người dùng cần giữ bản backup bên ngoài trình duyệt. Chưa xác nhận production server hay quyền phân phối các bộ từ điển nguồn ngoài.
