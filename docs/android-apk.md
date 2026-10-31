# APK Android

APK dùng Capacitor để chạy giao diện React trong Android WebView. Dữ liệu thư viện và cài đặt được lưu cục bộ trên thiết bị; đây là bản cài sideload, chưa phải bản phát hành Google Play.

## Yêu cầu build

- Node.js 22 trở lên và Bun.
- Android Studio với Android SDK Platform 36; chấp nhận Android SDK licenses trong Android Studio trước khi build.
- JDK 17 trở lên (có thể dùng JBR đi kèm Android Studio).
- Đặt `ANDROID_HOME` hoặc `ANDROID_SDK_ROOT` trỏ tới Android SDK nếu môi trường chưa tự nhận diện SDK.

## Tạo APK debug

```powershell
bun install
npm run android:assets
npm run android:apk
```

APK cài được nằm tại `android/app/build/outputs/apk/debug/app-debug.apk`. Có thể chuyển APK sang điện thoại để cài, hoặc dùng `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

Khi chỉ cần cập nhật giao diện Android, chạy `npm run build:android` để build web và đồng bộ thư mục `dist` vào dự án Android.

Application ID hiện là `vn.convert11.app` và chỉ là giá trị tạm cho bản sideload; hãy đổi sang ID thuộc quyền kiểm soát của bạn trước khi phát hành.

## Giới hạn chức năng

- Chuyển đổi văn bản, quản lý từ điển/thư viện, nhập tệp trên thiết bị và xuất EPUB dùng dữ liệu cục bộ.
- Đăng nhập Google, tải trang truyện qua URL và tải ảnh bìa từ URL cần API Node/Express. Các API này chưa được đóng gói hoặc triển khai cho APK; giao diện sẽ báo rõ khi tính năng cần máy chủ. Có thể dùng HTML đã lưu/dán nội dung để tiếp tục xử lý ngoại tuyến.
- Dữ liệu trong APK không đồng bộ với phiên bản web hay thiết bị khác. Gỡ cài đặt app có thể xóa dữ liệu cục bộ.

APK debug được ký bằng debug key và chỉ phù hợp cài thử/sideload. Trước khi phát hành công khai cần chọn applicationId chính thức, tạo và bảo vệ khóa ký phát hành, kiểm tra chính sách/quyền riêng tư, và hoàn tất kiểm thử trên thiết bị thật. Không đưa khóa ký hoặc bí mật vào kho mã nguồn.
