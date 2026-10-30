# Đăng nhập Google

Ứng dụng dùng nút Google Identity Services và xác minh ID token bằng `google-auth-library` trên máy chủ. Cookie phiên là HttpOnly; ID token không được lưu trong localStorage. Email giả từ phiên bản cũ không được dùng làm tài khoản đăng nhập.

## Cấu hình

1. Mở [Google Auth Platform](https://console.cloud.google.com/auth/clients), tạo OAuth Client loại **Web application**. Cấu hình tên ứng dụng, email hỗ trợ và người dùng thử trong Audience nếu ứng dụng còn ở Testing.
2. Thêm các Authorized JavaScript origins tương ứng địa chỉ dùng để mở ứng dụng:
   - `http://localhost`
   - `http://localhost:3000`
   - `http://127.0.0.1:3000` nếu sử dụng địa chỉ này và Google chấp nhận trong cấu hình client; nếu không, dùng localhost.
   - Origin HTTPS của bản triển khai, ví dụ `https://convert.example.com`.
3. Tạo `.env.local` ở thư mục gốc khi phát triển:

   ```dotenv
   GOOGLE_CLIENT_ID=1234567890-example.apps.googleusercontent.com
   ```

   Không cần Client Secret. Không dùng ID ví dụ ở trên.

4. Khởi động lại `npm run dev`, mở menu và dùng ô đăng nhập Google. Nút chính thức sẽ mở trình chọn tài khoản của Google. Khi thiếu cấu hình hoặc không tải được Google, ứng dụng hiển thị trạng thái lỗi thay vì đăng nhập giả.

## Triển khai

```sh
npm run build
npm start
```

Đặt biến môi trường máy chủ:

```dotenv
NODE_ENV=production
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
APP_URL=https://convert.example.com
PORT=3000
```

Dùng HTTPS và cùng origin cho giao diện lẫn `/api/auth/*`. Chỉ đưa thư mục `dist` lên hosting tĩnh sẽ không đủ để đăng nhập. Vite dev và preview đã có middleware API để thử tại máy.

Máy chủ kiểm tra chữ ký, audience, issuer, thời hạn, nonce và email xác minh; yêu cầu đăng nhập kiểm tra Origin và CSRF. Cookie production có Secure, HttpOnly, SameSite=Lax. Đăng xuất hủy phiên ứng dụng, không đăng xuất toàn bộ tài khoản Google trên trình duyệt.

Phiên có hạn 8 giờ và được lưu trong bộ nhớ của một tiến trình: khởi động lại máy chủ sẽ yêu cầu đăng nhập lại. Với nhiều máy chủ/replica, thay kho phiên bằng Redis hoặc cơ sở dữ liệu dùng chung trước khi triển khai ở quy mô đó.

Đăng nhập chỉ xác thực tài khoản. Truyện và từ điển vẫn ở bộ nhớ cục bộ của trình duyệt; chưa có đồng bộ dữ liệu giữa các thiết bị hoặc phân tách dữ liệu cục bộ theo tài khoản.

## Kiểm thử

`npm test` kiểm tra phiên, CSRF, token sai, nonce sai, Origin và đăng xuất bằng bộ xác minh giả lập. Việc chọn tài khoản Google thật cần OAuth Client ID đã cấu hình và được thực hiện bởi người dùng.

Tài liệu chính thức: [Thiết lập client](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [nút đăng nhập](https://developers.google.com/identity/gsi/web/guides/display-button), [xác minh ID token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
