# Trình duyệt lấy truyện

## Kết quả kiểm tra PC — 01/11/2026

Đã quan sát trên giao diện Hermes desktop tại `127.0.0.1:43821`: mục lục novel543 có 1.870 chương; bộ đếm hiển thị 18 chương đã tải, 0 lỗi; trình duyệt tích hợp đang mở nội dung thật của chương 19 (`8095_19.html`). Đây là bằng chứng luồng lấy truyện hoạt động trong phiên PC hiện tại, không phải cam kết mọi nguồn hoặc mọi phiên Cloudflare đều được chấp nhận. Chưa kiểm tra đủ nội dung từng chương hay tải xong toàn bộ truyện.

Bản web cổng 3000 vẫn tải qua máy chủ và có thể bị Cloudflare chặn. Muốn dùng phiên trình duyệt tích hợp phải mở bản Hermes desktop bằng `npm run desktop`.

Đã sửa khởi động desktop để hiện và đưa cửa sổ chính lên trước sau khi tải giao diện, tránh trạng thái khởi động ẩn/thu nhỏ.

> **Trạng thái Android — 01/11/2026: CHƯA HOÀN TẤT.** Mới có mã tích hợp và đã đồng bộ tài nguyên vào dự án Android. Chưa biên dịch thành công, chưa có APK và chưa kiểm thử trên thiết bị thật. Máy hiện chưa có môi trường JDK/Android SDK phù hợp. Không coi việc đồng bộ mã là đã làm xong bản Android.
>
> Việc còn lại: chuẩn bị JDK/Android SDK, biên dịch và sửa lỗi phát sinh, xuất APK, kiểm thử mở/đóng trình duyệt, xác minh Cloudflare thủ công, giữ phiên và lấy nội dung trên thiết bị thật.

Hermes PC và Android có trình duyệt chỉ gồm Quay lại, Tải lại, Lấy nội dung và Đóng. Trang truyện chạy tách khỏi giao diện và dữ liệu Hermes. Không sao chép cookie vào máy chủ; phiên website được giữ trên thiết bị. Không tự giải CAPTCHA hay giả lập dấu vân tay trình duyệt.

Trong **Truyện từ web**, chọn **Trình duyệt trong app**, nhập URL rồi bấm **Phân tích**. Hoàn tất xác minh bằng tay nếu website yêu cầu, chờ thấy mục lục/nội dung thật rồi bấm **Lấy nội dung**. Chọn chương và tải; từng chương mở trong cùng phiên để bạn kiểm tra rồi bấm lấy. Đóng trình duyệt sẽ dừng lượt tải, giữ những chương đã tải thành công. Không lấy màn hình xác minh làm nội dung truyện.

## PC

Chạy `npm run desktop` để dựng giao diện và mở ứng dụng Electron. Bản này dùng Chromium của Electron, chỉ tải engine một lần khi cài dependency. Không nhúng engine vào từng trang hay từng chương. Cửa sổ đọc trang không có Node.js, preload hay quyền truy cập cầu nối Hermes. Cookie được lưu riêng với giao diện chính.

Bản PC dùng địa chỉ nội bộ cố định `127.0.0.1:43821` để giữ từ điển và bản nháp qua các lần khởi động. Dữ liệu của bản web đang chạy ở cổng 3000 không tự chuyển sang bản PC; dùng sao lưu/khôi phục để chuyển dữ liệu. Hiện đây là lệnh chạy desktop từ mã nguồn, chưa có bộ cài Windows.

## Android

Chạy `npm run android:apk` trong môi trường có JDK và Android SDK. Plugin SourceBrowser dùng Android System WebView hiện có trên máy, không tải thêm Chromium. Cập nhật Android System WebView để nhận các bản vá mới. Trang ngoài không được gắn Capacitor bridge, không truy cập tệp máy, không được mở giao thức ngoài HTTP/HTTPS. SSL lỗi không được bỏ qua.

## Giới hạn

Cloudflare có thể không chấp nhận Electron/WebView trên một số website. Việc có trình duyệt tích hợp không bảo đảm vượt qua xác minh. Khi bị lặp xác minh, dùng trình duyệt hệ thống và nhập HTML/MHTML có nội dung thật. Bản web chạy trong Chrome/Edge không thể có quyền đọc tùy ý website khác; chức năng trình duyệt tích hợp chỉ bật trong bản desktop và Android.

Ảnh bìa URL trong Android vẫn cần máy chủ API; dùng ảnh từ máy nếu không có API. Trình duyệt không tải ngầm hàng nghìn trang; thao tác lấy nội dung do người dùng xác nhận.
