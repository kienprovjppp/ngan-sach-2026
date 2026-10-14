# Hướng dẫn tự sửa trang Giữ Lửa Ví Tiền

Trang đang chạy tại: https://kienprovjppp.github.io/ngan-sach-2026/

Mỗi lần code trên GitHub thay đổi, trang tự cập nhật sau khoảng 1–2 phút. Vì app chạy được khi mất mạng, **lần mở đầu tiên sau khi cập nhật vẫn hiện bản cũ**. Đóng rồi mở lại (hoặc tải lại trang) lần nữa là thấy bản mới.

---

## 1. Ảnh dán bên phải hoạt động thế nào

- Ảnh chỉ hiện trên **màn hình máy tính rộng** (từ 1340px trở lên). Điện thoại và cửa sổ hẹp thì ẩn để không che nội dung.
- Trang **Tổng quan** và **Lịch lửa** không có ảnh vì phần bên phải đã kín chỗ.
- Mọi ảnh nằm trong thư mục `img/`.
- Mục nào có ảnh nào được khai báo trong file `data.js`, ở đoạn này:

```js
const CHEER = { src: "img/cheer.jpg", alt: "Cô gái anime cầm bông cổ vũ", caption: "Cố lên, giữ lửa nha!", sub: "Mỗi đồng giữ lại là một ngày lửa cháy" };
const STICKERS = {
  "home/rules": CHEER,
  log: CHEER,
  cook: CHEER,
  shop: CHEER,
  free: CHEER,
  settings: CHEER
};
```

Ý nghĩa từng phần:

| Chữ | Nghĩa |
|---|---|
| `src` | đường dẫn file ảnh, luôn bắt đầu bằng `img/` |
| `alt` | mô tả ngắn cho người dùng trình đọc màn hình |
| `caption` | dòng chữ đậm dưới ảnh (bỏ trống được) |
| `sub` | dòng chữ nhỏ bên dưới caption (bỏ trống được) |

Tên các mục (phần bên trái dấu `:`):

| Tên | Mục trên app |
|---|---|
| `log` | Chi tiêu (cả 3 mục con) |
| `cook` | Nấu gì |
| `shop` | Đi chợ |
| `free` | Săn free |
| `settings` | Cài đặt |
| `"home/rules"` | Lửa → Luật chơi |

Muốn ảnh riêng cho **một mục con** thì ghi `"mục/mục con"` (có dấu ngoặc kép). Mục con được ưu tiên hơn mục cha.

| Mục con | Tên |
|---|---|
| Chi tiêu → Nhật ký / Ngân sách / Kỳ ngân sách | `"log/history"`, `"log/budget"`, `"log/periods"` |
| Nấu gì → Thực đơn tuần / Mẹo nấu | `"cook/week"`, `"cook/tips"` |
| Đi chợ → Danh sách / Mẹo Costco | `"shop/list"`, `"shop/tips"` |
| Săn free → Đã săn / Chỗ có đồ free / Săn sale | `"free/log"`, `"free/where"`, `"free/sale"` |
| Cài đặt → Đồng bộ / Sao lưu / Giao diện | `"settings/sync"`, `"settings/data"`, `"settings/app"` |

---

## 2. Gỡ ảnh cổ vũ

### Cách A: nhờ Codex (nhanh nhất)

Dán câu này vào Codex khi đang mở thư mục dự án:

> Gỡ ảnh cổ vũ khỏi tất cả các mục: xóa hằng CHEER và để STICKERS thành object rỗng trong data.js, xóa file img/cheer.jpg. Không sửa file nào khác. Chạy `node tests/merge.test.cjs` để chắc không hỏng gì, rồi commit và push.

Chỉ gỡ ở vài mục thôi thì nói rõ, ví dụ:

> Trong data.js, bỏ ảnh ở mục cook và shop (xóa 2 dòng đó trong STICKERS), giữ nguyên các mục khác. Commit và push.

### Cách B: tự sửa trên web GitHub, không cần cài gì

1. Mở https://github.com/kienprovjppp/ngan-sach-2026, bấm vào file **data.js**.
2. Bấm biểu tượng **cây bút** (Edit) ở góc phải.
3. Tìm đoạn `const STICKERS = {`:
   - Gỡ hết: xóa các dòng bên trong, để lại `const STICKERS = {};`
   - Gỡ một mục: xóa đúng dòng của mục đó, ví dụ dòng `cook: CHEER,`
4. Bấm **Commit changes…** rồi bấm **Commit changes** lần nữa.
5. (Không bắt buộc) Xóa file ảnh: vào thư mục `img`, bấm `cheer.jpg`, bấm dấu **…** chọn **Delete file**, rồi commit.

> ⚠️ Nếu xóa file ảnh thì phải xóa luôn các dòng dùng ảnh đó trong `data.js`, nếu không chỗ đó sẽ hiện ô ảnh lỗi.

---

## 3. Thêm ảnh khác cho từng mục

### Chọn ảnh thế nào cho đẹp

- Ảnh dọc hoặc vuông, rộng khoảng 300–800px, dung lượng dưới 300KB (ảnh nặng làm trang mở chậm).
- Ảnh **nền trắng** hoặc **PNG nền trong suốt** hợp nhất với khung polaroid.
- Tên file viết thường, không dấu, không khoảng trắng: `nau-an.png`, `di-cho.jpg`.
- Nếu sau này công khai trang cho người khác dùng: nên dùng ảnh tự vẽ hoặc tự chụp, hoặc ghi nguồn tác giả, vì ảnh trên Pinterest thường là tranh của người khác.

### Cách A: nhờ Codex

1. Chép file ảnh vào thư mục `img/` của dự án (ví dụ `img/nau-an.png`).
2. Dán vào Codex, sửa lại tên file, mục và câu chữ theo ý bạn:

> Thêm ảnh img/nau-an.png cho mục cook trong STICKERS ở data.js, caption "Nấu ở nhà là giàu", sub "Mỗi bữa tự nấu tiết kiệm ~$10", alt "Nồi cơm nghi ngút khói". Thêm ảnh img/di-cho.jpg cho mục con "shop/list", caption "Đi chợ theo list nha". Các mục khác giữ ảnh cổ vũ. Commit và push.

### Cách B: tự sửa trên web GitHub

1. Vào thư mục **img** trên GitHub, bấm **Add file → Upload files**, kéo ảnh vào, bấm **Commit changes**.
2. Mở **data.js**, bấm cây bút, thêm hoặc sửa dòng trong `STICKERS`. Ví dụ đổi mục Nấu gì sang ảnh mới:

```js
const STICKERS = {
  "home/rules": CHEER,
  log: CHEER,
  cook: { src: "img/nau-an.png", alt: "Nồi cơm nghi ngút khói", caption: "Nấu ở nhà là giàu", sub: "Mỗi bữa tự nấu tiết kiệm ~$10" },
  "shop/list": { src: "img/di-cho.jpg", alt: "Giỏ rau củ", caption: "Đi chợ theo list nha" },
  shop: CHEER,
  free: CHEER,
  settings: CHEER
};
```

3. Lưu ý khi gõ:
   - Mỗi dòng kết thúc bằng dấu phẩy `,`.
   - Chữ nằm trong dấu ngoặc kép `"..."`.
   - Tên có dấu `/` phải đặt trong ngoặc kép.
4. Bấm **Commit changes**. Đợi 1–2 phút rồi mở trang hai lần để thấy ảnh mới.

> Gõ sai một dấu phẩy hay ngoặc kép có thể làm cả trang trắng xóa. Nếu bị vậy, nhờ Codex: *"Trang bị trắng sau khi tôi sửa data.js, tìm và sửa lỗi cú pháp, chạy `node --check data.js` để kiểm tra."*

---

## 4. Làm việc với Codex cho đỡ tốn token

- Mở **đúng thư mục dự án** (`ngan-sach-2026`) trong Codex. Codex tự đọc file `AGENTS.md`, trong đó đã ghi sẵn file nào làm gì, nên không cần giải thích lại từ đầu.
- Mỗi lần nhờ, nói rõ 3 thứ: **sửa gì**, **ở mục nào**, **xong thì commit và push hay chưa**.
- Muốn xem thử trước khi đẩy lên, bảo Codex: *"Chạy thử trang ở máy (python -m http.server 8765) để tôi xem trước, chưa push."* rồi mở http://localhost:8765 trên trình duyệt.
- Trước khi đẩy lên GitHub, nên tải file sao lưu trong app: **Cài đặt → Sao lưu → Tải file sao lưu**.

---

## 5. Bảo mật Firebase (làm một lần, nếu chưa làm)

1. Vào https://console.firebase.google.com và chọn dự án **giu-lua**.
2. Vào **Build → Firestore Database**, chọn tab **Rules**.
3. Xóa hết nội dung cũ, dán nội dung file `firestore.rules` trong dự án vào, rồi bấm **Publish**.

Sau bước này, mỗi tài khoản chỉ đọc và ghi được dữ liệu của chính mình.
