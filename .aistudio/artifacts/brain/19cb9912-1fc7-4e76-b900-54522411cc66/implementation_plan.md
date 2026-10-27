# Kế hoạch khắc phục lỗi chọn từ Vietphrase, bổ sung ô chỉnh sửa tiếng Trung & Nạp trọn bộ từ điển

## 1. Phân tích nguyên nhân gốc rễ (Root Cause Analysis)

### A. Lỗi bôi đen cụm từ Vietphrase bị chọn lan sang các câu khác trong chương
- **Hiện tượng**: Khi bôi đen cụm `"ly thân thể"` (dịch từ `離體`), các từ rời rạc như `"ly"`, `"thân"`, `"thể"` ở các câu khác trong toàn bộ chương đều bị highlight và gom lại với nhau.
- **Nguyên nhân chính xác trong code (`TranslateView.tsx`)**:
  - Đoạn code hiện tại:
    ```ts
    const selLower = selectedText.toLowerCase();
    translation.tokens.forEach(tok => {
      const currentVal = tok.translated.toLowerCase();
      if (selLower.includes(currentVal) || currentVal.includes(selLower)) {
        matchedTokenIds.add(tok.id); // LỖI NẰM Ở ĐÂY: Quét TOÀN BỘ CHƯƠNG!
      }
    });
    ```
  - Khi bôi đen cụm 3 từ `"ly thân thể"`, điều kiện `selLower.includes(currentVal)` trả về `true` cho **mọi token** nào có nghĩa là `"ly"`, `"thân"`, hoặc `"thể"` ở bất kỳ vị trí nào trong toàn bộ chương!
  - Sau đó code gom chữ Hán của tất cả các token đó lại, tạo ra chuỗi chữ Hán bị xáo trộn và sai lệch hoàn toàn.

### B. Ô tiếng Trung không cho chỉnh sửa/thêm/xóa bình thường
- **Hiện tượng**: Khung tiếng Trung hiện đang render cố định các thẻ `<span>` tương tác token, khiến người dùng không thể gõ, xóa, chèn hay sửa văn bản như một trình soạn thảo bình thường.
- **Giải pháp**:
  - Cung cấp ô `<textarea>` chỉnh sửa trực tiếp, hỗ trợ gõ, xóa, chèn chữ Hán tự do, đồng bộ thời gian thực với bản dịch.
  - Cho phép người dùng chuyển đổi linh hoạt giữa:
    - **Chế độ soạn thảo / chỉnh sửa trực tiếp (Text Editor)**: Gõ, xóa, dán, thêm bớt từ bình thường.
    - **Chế độ tương tác từng từ (Token Inspector)**: Soát từng từ, xem màu sắc Name/Vietphrase.
  - Khi bôi đen chữ Hán trong ô soạn thảo, vẫn hiển thị thanh công cụ nổi hoặc nút chức năng để thêm nhanh `+ Name`, `+ Vietphrase`, `+ Bỏ qua` nếu muốn.

### C. Cụm từ 4 chữ chưa được dịch (do nạp thiếu tệp Vietphrase gốc)
- **Hiện tượng**: Các cụm từ dài 4 chữ và thành ngữ chưa được dịch.
- **Phát hiện**: Trong thư mục `/public/assets/aistudio/` có tệp `Vietphrase_fc812333.txt` dung lượng **23.5 MB** (chứa hơn 500.000 cụm từ và thành ngữ 4 chữ của QuickTranslator). Tuy nhiên, hàm nạp dữ liệu trong `AppContext.tsx` hiện chỉ đang nạp tệp `Vietphrase_cho_file_g_p_ef2c75e8.txt` dung lượng chỉ **3.7 KB** (~100 từ)!
- Cụm từ `离体=ly thể/rời thân thể`, `离体而存活=rời thân thể mà hoạt động`, `离体而去=rời khỏi thân thể` đều nằm đầy đủ trong tệp 23.5 MB này!

---

## 2. Kế hoạch triển khai kỹ thuật chi tiết

### 1. Sửa triệt để lỗi nhận diện token khi bôi đen (`TranslateView.tsx`)
- **Loại bỏ hoàn toàn vòng lặp quét chuỗi con toàn chương** `selLower.includes(currentVal)`.
- **Cơ chế nhận diện chuẩn xác 100%**:
  1. Chỉ lấy các phần tử `span[data-token-id]` nằm **bên trong phạm vi lựa chọn DOM (Selection Range)** của người dùng tại vị trí con trỏ chuột.
  2. Nếu người dùng bôi đen một đoạn text, chỉ tìm chuỗi token **liền kề liên tiếp (contiguous sequence)** đầu tiên tại khối đoạn văn đó khớp với cụm từ đã chọn.
  3. Tuyệt đối không chọn bất kỳ token nào ở các câu khác hay đoạn khác.
- Kết quả: Khi bôi đen `"ly thân thể"`, hệ thống chỉ nhận diện đúng token của cụm `離體` (hoặc các token liền kề tạo nên cụm đó), không bao giờ chạm đến từ "ly", "thân" ở các câu khác!

### 2. Bổ sung ô soạn thảo tiếng Trung cho phép thêm/xóa/sửa tự do
- Thêm thanh chuyển đổi chế độ ở đầu khung tiếng Trung:
  - **Soạn thảo trực tiếp (Mặc định)**: Ô `<textarea>` font chữ to rõ, cho phép người dùng gõ, xóa, chép, dán, sửa chữ Hán tự nhiên. Khi sửa đổi, bản dịch tự động cập nhật ngay.
  - **Soát từ & Highlight**: Hiển thị các khối từ phân màu (Names, Vietphrase) để tra cứu từng từ.
- Khi người dùng bôi đen chữ Hán trong ô soạn thảo:
  - Hiển thị menu nổi hỗ trợ các nút `+ Name`, `+ Vietphrase`, `+ Bỏ qua`, `Xóa từ` thuận tiện.

### 3. Nạp tệp từ điển Vietphrase gốc (23.5 MB)
- Cập nhật hàm nạp dữ liệu trong `AppContext.tsx`:
  - Trỏ đến tệp `/assets/aistudio/Vietphrase_fc812333.txt` (23.5 MB) thay vì tệp nhỏ 3.7 KB.
  - Hỗ trợ chuyển đổi Giản thể - Phồn thể cơ bản (hoặc nạp cả hai) để chữ Phồn thể như `離體` tự động nhận diện `离体`.
- Sửa hàm tiền xử lý `cleanSource` trong `translatorEngine.ts`: Không xóa các cụm từ trong `IgnoredChinesePhrases` mà giữ nguyên chữ Hán khi dịch.

---

## 3. Kế hoạch kiểm thử & Xác minh (Verification Plan)
1. **Kiểm thử bôi đen cụm từ `離體` / `ly thân thể`**:
   - Dán đoạn văn có chứa `離體` ở câu này và các từ `"ly"`, `"thân"` ở câu khác.
   - Bôi đen cụm `"ly thân thể"` -> Xác nhận chỉ có cụm này được chọn, các từ ở câu khác hoàn toàn không bị ảnh hưởng.
   - Bấm `+ Vietphrase` hoặc `+ Name` -> Xác nhận chữ Hán gốc nhận đúng `離體`.
2. **Kiểm thử ô tiếng Trung chỉnh sửa bình thường**:
   - Gõ thêm từ vào ô tiếng Trung -> Bản dịch cập nhật tức thì.
   - Xóa bớt từ trong ô tiếng Trung -> Bản dịch phản hồi chuẩn xác.
3. **Kiểm thử cụm từ 4 chữ**:
   - Kiểm tra các cụm thành ngữ 4 chữ được dịch chuẩn xác, không bị tách rời thành từng chữ đơn.
4. **Kiểm tra biên dịch & Lint**:
   - Chạy `lint_applet` và `compile_applet` đạt 100% không lỗi.
