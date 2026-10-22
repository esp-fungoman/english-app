# Product

Ứng dụng luyện từ vựng tiếng Anh cho học sinh tiểu học (khối 1–5), bám nội dung trên lớp. Không thương mại. Giao diện **tiếng Việt**; từ trên thẻ là **tiếng Anh**. Học trên điện thoại hoặc hiển thị trên desktop/TV cho cả lớp xem; giao diện desktop phải đủ lớn và dễ đọc từ xa.

Giáo viên/admin soạn nội dung. **Học sinh** đăng nhập bằng tên đăng nhập + mật khẩu. Đăng ký cần tên, khối, tên đăng nhập, mật khẩu và nhập lại mật khẩu; trường, lớp và ảnh đại diện không bắt buộc. Ảnh được xem trước trong khung tròn rồi lưu khi đăng ký hoặc trong Cài đặt. Nếu chưa tải được ảnh, tài khoản vẫn được tạo và có thể vào học, thêm ảnh sau.

Admin quản lý kho từ vựng theo nhóm A–Z, có TOC, tìm từ/nghĩa không dấu và lọc khối/unit/category. Mỗi hồ sơ gồm một từ với một nghĩa, loại từ, ảnh và category mặc định; dùng được ở nhiều unit/khối. Cùng cách viết có thể có nhiều nghĩa. Category dùng trong trò phân nhóm được cấu hình riêng theo unit.

Có thể soạn bằng drawer hoặc nhập Excel qua Xem trước → Xác nhận. Các dòng mẫu trong file sẽ được nhập nếu giữ nguyên. Hồ sơ cũ và category của liên kết có sẵn không tự bị ghi đè. Từ/cụm từ chưa phù hợp với trò chơi vẫn lưu được và có trạng thái giải thích trong Admin. Không tự tạo ảnh.

## Hành trình

Đăng ký (chọn khối ngay trên form) hoặc đăng nhập → **trang hành trình** (unit tiếp theo, lối vào 4 trò chơi, node + sao, xem nhanh tiến độ tuần) → chọn mini-game → chơi → về path. Tài khoản cũ chưa có khối được chọn khối sau đăng nhập. Unit đã mở theo lịch/admin **vẫn chơi lại được**. Không tim/mạng. Unit đang học xuất hiện một lần trong path với trò chơi bên trong; không tạo unit giả để lấp chỗ trống.

Thanh điều hướng học sinh dẫn đến Hành trình, Sổ từ, Báo cáo và menu tài khoản (Cài đặt, Đăng xuất). Ôn nhanh là hành động trong luồng học, không phải tab điều hướng. Cài đặt cho sửa tên, trường/lớp, ảnh đại diện và đổi khối có xác nhận; tên đăng nhập chỉ đọc. Tiến độ của khối cũ được giữ khi đổi khối rồi quay lại. Menu dùng ảnh đã lưu; khi chưa có ảnh hoặc ảnh không tải được, dùng chữ cái đầu tên.

## Sổ từ và Ôn nhanh

Sổ từ hiển thị từ của **unit đang mở** trong khối đang chọn: từ tiếng Anh, nghĩa tiếng Việt nếu có, nhóm, phát âm và ảnh khi tài nguyên tồn tại. Lọc theo unit/nhóm và tìm từ. Trạng thái “chưa luyện”, “đã luyện”, “cần ôn” dựa vào câu trả lời đã lưu, không khẳng định trẻ đã thuộc từ. Từ chưa có nghĩa vẫn xem được nhưng không dùng làm câu Ôn nhanh.

Ôn nhanh là tối đa 5 câu: xem nghĩa tiếng Việt, chọn từ tiếng Anh trong 3 lựa chọn. Ưu tiên từ vừa trả lời sai, rồi từ có tỷ lệ đúng thấp, sau đó từ chưa luyện. Cần ít nhất 3 từ có nghĩa, lựa chọn không mơ hồ; thiếu nội dung thì báo rõ. Câu trả lời và thời gian được lưu để tiếp tục sau tải lại, nhưng **không đổi sao, tỷ lệ đúng của 4 trò chơi hoặc số từ đã học**.

## Bốn hoạt động

1. **Ghép từ theo nhóm** — thẻ từ vào bucket chủ đề (ảnh + từ).
2. **Tìm chữ cái thừa** — một chữ thừa; bỏ chữ đó.
3. **Sắp xếp chữ cái** — nghe từ, chọn chữ từ bảng A–Z để ghép lại; cho phép chọn lặp chữ cái.
4. **Nghe và chọn chữ cái** — nghe từ, nghe từng chữ, xem ảnh, điền từ bảng chữ (tap, không drag nhỏ).

## Báo cáo tuần

Trong khối đang chọn: phút luyện (thời gian tab đang dùng), hoạt động từng ngày trong tuần, unit hoàn thành / tổng khối, số từ đã đúng ≥1 lần trong 4 trò chơi, chuỗi ngày, % từng hoạt động, một câu gợi ý hoạt động yếu nhất. Thời gian Ôn nhanh tính vào phút luyện và chuỗi ngày, không tính vào thành tích unit.

Unit xong khi cả 4 hoạt động ≥ **80%** đúng (cộng dồn lifetime). Chuỗi reset nếu bỏ 1 ngày (`Asia/Ho_Chi_Minh`).

## Khóa unit

Admin đặt ngày giờ mở từng unit theo giờ Việt Nam, có thể đặt hàng loạt. Chưa đặt lịch thì khóa; đến mốc tự mở và không tự đóng. Khóa tay ưu tiên. Kiểm tra phía server chặn link trực tiếp và phiên đã lưu; lịch sử đã trả lời vẫn giữ nguyên khi unit bị khóa.
