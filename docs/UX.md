# UX

`apps/web` phục vụ cả điện thoại lẫn màn hình desktop/TV trình chiếu trong lớp. Cùng một luồng học sinh, không có classroom mode riêng. `apps/admin` là CMS responsive ưu tiên desktop.

- Chrome tiếng Việt; lemma tiếng Anh.
- Path unit dọc trên điện thoại, lưới theo thứ tự unit trên desktop; sao trên node. Không khóa unit cũ. Không hearts.
- Hành trình là trang nhà sau đăng nhập: chào theo tên/khối, một unit nên học tiếp, xem nhanh tiến độ, rồi path unit thật. Unit đang học là một stop nổi bật trong path với lối vào 4 trò chơi; không lặp thêm một thẻ unit giống hệt ở trên. Không bịa unit cho khối chưa có nội dung. Thanh trên cùng có Hành trình, Sổ từ, Báo cáo và menu ảnh đại diện (Cài đặt, Đăng xuất); dùng chữ cái đầu tên khi chưa có ảnh hoặc ảnh lỗi. Ôn nhanh là hành động ngữ cảnh, không có sidebar cố định hay thanh này trong lúc chơi.
- Unit chơi được phản hồi ngắn khi hover/focus/press. Danh sách hiện vào nhẹ; sao và thanh tiến độ chuyển động khi tăng sau lượt chơi. Không tạo cảm giác unit khóa có thể bấm. Chuyển động khoảng 150–250 ms, không chạy liên tục, và bỏ chuyển động khi người dùng chọn reduced motion.
- Một việc một màn. Letter tile: màu + bounce nhẹ (Endless Alphabet lite).
- Màn học dùng bố cục learning board: các khối nội dung có ích, tối giản trang trí. Sổ từ cho lọc unit/nhóm, nghe từ và xem nghĩa; ảnh chỉ xuất hiện khi có file dùng được. Ôn nhanh mỗi màn một nghĩa và 3 lựa chọn lớn, feedback ngắn và rõ, không tạo áp lực điểm unit.
- Ôn nhanh chưa sẵn sàng giải thích cần ít nhất 3 từ có nghĩa tiếng Việt khác nhau trong các unit đang mở, nhắc không ảnh hưởng sao và đưa lối Về hành trình / Mở sổ từ thay cho Bắt đầu bị khóa. Nếu nội dung thay đổi lúc bắt đầu, dùng cùng trạng thái này và hiện thông báo API. Lỗi tải dữ liệu phải được phân biệt với thiếu nội dung; không tự tạo câu hỏi. Unit chỉ hiện lối Ôn nhanh khi API xác nhận có đủ từ.
- Trong lượt Ôn nhanh, nút thoát mở xác nhận **Rời Ôn nhanh?** và tạm dừng tính thời gian học. **Ở lại** hoặc Escape giữ nguyên câu và trả focus về nút thoát; chỉ **Về hành trình** mới kết thúc session. Câu đã trả lời vẫn lưu, câu chưa trả lời không tính vào lượt; khi đang lưu, không đóng dialog bằng Escape.

## Màn chơi

- Intro có tên unit, tên trò, một chỉ dẫn ngắn và Bắt đầu; trò phân nhóm ghi rõ chế độ Từng từ hoặc Bảng phân nhóm. Khi không có nội dung hoặc thiếu âm thanh cho trò cần nghe, đưa lối Về unit thay cho nút bắt đầu bị khóa.
- Lần đầu mở intro của mỗi trò, hiện dialog **Cách chơi** sau khi biết học sinh. Nút dấu hỏi trên intro và cạnh thoát trong header luôn mở lại hướng dẫn, không thêm vào hàng unit. Hướng dẫn có tối đa 3 ý ngắn, đúng chế độ phân nhóm; ảnh chỉ là gợi ý khi có ảnh, âm thanh vẫn là điều kiện của trò cần nghe. Đóng hoặc Escape trả focus về nút mở; checkbox **Không hiện lại** lưu ngay khi thay đổi, theo học sinh và trò bằng `localStorage` (`english-tip-dismissed:{studentId}:{activity}` = `1`), không theo unit. Không chọn thì lần ghé tiếp theo vẫn hiện; mở lại và bỏ chọn cho phép hiện tự động trở lại. Nếu trình duyệt chặn lưu, hướng dẫn vẫn dùng được. Không tính thời gian học khi dialog mở; dừng âm thanh đang đọc, giữ nguyên câu trả lời và các ô đã xếp.
- Trong lượt chơi chỉ có một nhiệm vụ chính. Header có thoát, tên trò, số câu hoặc số từ đã xếp và một thanh tiến độ. Thoát lượt đang chơi cần xác nhận; câu đã trả lời được lưu, câu chưa trả lời không tính điểm.
- Từ, nhóm, ô chữ, khay chữ và nút hành động đủ lớn cho lớp học và điện thoại. Trên desktop, phân nhóm từng từ đặt thẻ từ cạnh các nhóm; bảng phân nhóm đặt khay từ cạnh lưới nhóm 2x2; trò xếp chữ đặt vùng nghe cạnh vùng chữ. Trên điện thoại chúng xếp dọc, cuộn tự nhiên nếu cần.
- Chỉ báo đúng/sai xuất hiện sau khi API lưu câu trả lời. Vùng phản hồi giữ chỗ ổn định, ngắn gọn và không trách trẻ; nút tiếp tục nằm cạnh phản hồi trên desktop, bên dưới trên điện thoại. Bảng phân nhóm giữ nguyên vị trí từ sau kiểm tra và ghi nhóm đúng cạnh từ sai.
- Loa chỉ chuyển động trong lúc đọc; tile và phản hồi chuyển trạng thái khoảng 150–250 ms, màn kết quả chậm hơn một chút. Không có hiệu ứng lặp khi trẻ đang suy nghĩ. Reduced motion bỏ chuyển động nhưng giữ trạng thái, thông điệp và thứ tự focus.
- Màn kết quả ưu tiên điểm thật của lượt chơi. Chỉ chúc mừng sao mới khi tiến độ unit xác nhận hoạt động vừa đạt; nếu không tải được tiến độ, chỉ hiện điểm lượt chơi. Ảnh từ là tùy chọn, không tạo khung trống; ở trò nghe, alt của ảnh không tiết lộ chữ tiếng Anh.

## Admin: kho từ và lịch học

CMS nền sáng, bố cục rộng responsive, điều hướng Từ vựng / Unit & lịch học / Category / Nhập Excel. Đăng nhập có label, hiện/ẩn mật khẩu, trạng thái xử lý và lỗi kết nối riêng; không điền sẵn tài khoản. Giữ cơ chế xác thực hiện tại.

Kho từ nhóm A–Z, nhóm Khác cho ký tự ngoài A–Z; TOC có số lượng và đánh dấu nhóm đang xem. Desktop dùng TOC bên trái, điện thoại dùng thanh chữ cái cuộn ngang. Mỗi nhóm tải 50 hồ sơ/lần. Tìm từ/nghĩa không dấu debounce 300 ms, lọc nhiều khối/unit/category, OR trong từng bộ lọc và AND giữa bộ lọc. Category phải khớp trên cùng liên kết với unit/khối; trạng thái lọc lưu trên URL. Bộ lọc nhanh: thiếu ảnh, thiếu nghĩa, chưa gắn unit, chưa dùng được trong trò chơi.

Drawer sửa từ/nghĩa/loại từ/ảnh/category mặc định và các unit sử dụng; full-screen ở màn hẹp. Cảnh báo chưa lưu; Lưu và mở từ tiếp theo dùng thứ tự danh sách trước khi lưu. Ảnh upload lúc lưu, lỗi giữ bản nháp và key đã PUT để thử lại. Cùng cách viết có các nghĩa khác nhau; gợi ý hồ sơ đã tồn tại và cho mở để dùng lại. Nghĩa/ảnh/loại từ dùng chung, hiển thị unit chịu ảnh hưởng. Category riêng từng unit được sao chép từ mặc định khi gắn lần đầu.

Trang unit có tạo/sửa, cấu hình hoạt động, chế độ phân nhóm, ngày giờ mở theo Việt Nam, khóa tay và đặt lịch hàng loạt. Có tùy chọn gom từ các unit đã mở từ Unit 1 đến unit hiện tại cho Ghép từ theo nhóm; lượt tích lũy chơi hết từ hợp lệ và phần giới thiệu hiển thị số từ thay vì “Tối đa 8 từ”. Có xem trước quyền học hiện tại theo khối. Bốn trạng thái: Chưa đặt lịch / Chờ mở / Đang mở / Khóa tay. Cảnh báo nếu thay đổi khóa unit đang mở. Phía học sinh hiển thị ngày mở hoặc lý do khóa; khi bị khóa giữa phiên dừng câu chưa trả lời và cho kết thúc phiên.

Nhập Excel có tải mẫu, chọn file, xem trước, xác nhận và báo lỗi theo tab/dòng/cột. Category của từng dòng áp dụng theo unit, hồ sơ theo từ/nghĩa được dùng chung. Unit mới chưa đặt lịch bị khóa. Không có hàng đợi ảnh tách rời; dùng bộ lọc Thiếu ảnh và drawer trong kho từ.

Giới hạn xác minh của bản nâng cấp: production build Admin/API/Web. Chưa xác minh runtime, trình duyệt, responsive, migration, import, upload hoặc lịch khóa.

## Design language (kids / Duolingo-inspired)

Vibe: game vui cho tiểu học. Màn auth dùng cùng font, màu và control bo góc với phần học. Không clone Duo (owl/wordmark/font riêng/hearts/gems/Super).

| Role           | Hex / token                  |
| -------------- | ---------------------------- |
| Canvas         | `#FFFFFF` (`--bg`)           |
| Ink            | `#3C3C3C` (`--ink`)          |
| Muted          | `#777777` (`--muted`)        |
| Primary / đúng | `#58CC02` (`--accent`)       |
| Ledge primary  | `#58A700` (`--accent-ledge`) |
| Sai            | `#FF4B4B` (`--bad`)          |
| Sao / thưởng   | `#FFC800` (`--star`)         |
| Link / info    | `#1CB0F6` (`--info`)         |

- Font: **Nunito** throughout the student UI, including titles and game text.
- Nút & ô nhập: radius ~16px, ledge `box-shadow: 0 3–4px 0`; press `translateY`.
- Mọi hình có ranh giới nhìn thấy trong giao diện học sinh đều bo góc: ô từ, nhóm, nút, khay, vùng phản hồi, khung ảnh và thanh tiến độ. Dùng nhất quán radius nhỏ (~11px), vừa (~14px), lớn (~16px); không để góc vuông ở các hình này. Quy tắc này không áp dụng cho admin.
- Copy tiếng Việt sentence case, thân thiện (“Vào học thôi”).
- Mobile: một cột dễ chạm. Tablet: nội dung rộng hơn. Desktop từ 1024px: bỏ thẻ điện thoại nổi, dùng bố cục rộng có giới hạn nội dung hợp lý, không để hai bên thành nền trang trí vô ích.
- Màn hình lớp học: chữ, từ, nhóm, ô chữ, nút và phản hồi đọc rõ từ xa. Reflow auth, path, unit, report và game; giữ một nhiệm vụ mỗi màn và không đổi luật game. Ở 1920×1080, câu hỏi thông thường cùng nút chính nên thấy đồng thời. Màn thấp được cuộn tự nhiên, không cắt nội dung.
- Kiểm tra ở 320px, mobile thường, tablet, 1366×768, 1920×1080 và 4K. Cỡ chữ tăng theo breakpoint rời rạc, không theo `vw`; giữ focus order, kéo/thả, chạm và reduced motion.

### Công thức màn auth (đã duyệt)

`auth-hero` → mascot → `speech` → `brand-pill` → tiêu đề → fields ledge → CTA xanh → link `auth-switch`. Đăng nhập chỉ có tên đăng nhập và mật khẩu. Đăng ký có tên, khối, trường/lớp tùy chọn, tên đăng nhập, mật khẩu và nhập lại. Ảnh đại diện tùy chọn được xem trước và lưu trong khung tròn; cùng picker ở Cài đặt, có đổi ảnh và bỏ lựa chọn chưa lưu. Chỉ nhận JPG/PNG/WebP/GIF. Khi thiếu bucket, báo lỗi 501 bằng tiếng Việt, không xóa dữ liệu form. Nếu tài khoản đã tạo nhưng ảnh chưa lưu, khóa các trường tài khoản đã lưu, cho thử ảnh lại hoặc Vào học, thêm ảnh sau; không đăng ký tài khoản lần nữa khi thử lại. Cài đặt giữ ảnh cũ và thay đổi form khi upload lỗi. Thanh điều hướng luôn có chữ cái đầu tên thay thế khi chưa tải được ảnh thật.

Áp dụng công thức này khi làm màn entry mới; **đừng** tự ý đổi path/play khi task chỉ về auth.

## Ảnh từ (bạn generate)

Vuông, nền trơn, một object, sáng, **không chữ trong ảnh**, phù hợp tiểu học.

## Ảnh UI (agent đưa prompt)

Khi cần icon/empty/path skin: agent **chỉ** đưa prompt ChatGPT Plus, chờ file. Không generate trong Cursor, không API ảnh.

### Auth screens (pending assets)

Placeholders under `apps/web/public/ui/`:

- `mascot-welcome.png` — owl with vocab card
- `mascot-wave.png` — owl waving
- `icon-user.png` / `icon-lock.png` — input icons

ChatGPT Plus prompt:

> Children’s app UI illustration, 1024x1024, flat vector, thick friendly outlines, bright candy colors, one character centered, plain cream background, no text, no letters, no watermark, elementary school appropriate. Subject: [owl holding a vocab picture card / owl waving / simple kid silhouette / simple adult silhouette / pastel padlock].

## Lottie trong giao diện học sinh

- Friendly Owl dùng chung ở đăng nhập, đăng ký, chọn khối và lời chào Hành trình. Chỉ lời chào đầu tiên trong phiên trình duyệt phát animation, dùng `sessionStorage` key `english-owl-intro-played`; đặt key khi bắt đầu phát. Reduced motion không tiêu thụ lượt giới thiệu. Nếu storage không dùng được, dùng cờ trong bộ nhớ cho vòng đời trang. Màn mở ứng dụng/chuyển hướng luôn dùng PNG tĩnh và không chờ animation để chuyển trang.
- Màn kết quả trò chơi và Ôn nhanh dùng tỷ lệ đúng chưa làm tròn: ≥80% là `great` với “Giỏi quá! 🎉”, ≥50% là `good` với “Làm tốt lắm!”, còn lại (kể cả tổng 0) là `tryAgain` với “Không sao, mình thử lại nhé!”. Owl nhỏ bên cạnh hoặc phía trên điểm, câu phản hồi là chữ thật cho screen reader. Owl kết quả phát mỗi lần mount màn kết quả, theo session ID, không dùng giới hạn lời chào; mỗi lượt tối đa 3 giây đang hiển thị rồi giữ khung tĩnh.
- Confetti Burst của Nick Hart chỉ phát một lần khi lượt chơi hoặc Ôn nhanh vừa kết thúc, lưu thành công và đạt ít nhất 50%. Không phát lại khi khôi phục kết quả đã lưu. Star Celebration vẫn chỉ xuất hiện khi API xác nhận vừa đạt sao mới, rồi giữ icon sao; Ôn nhanh không thưởng sao.
- Loading dùng 3 chấm CSS màu `--accent`, chỉ hiện sau 300 ms; giữ nguyên thông báo tiếng Việt và `role="status"`. Reduced motion dùng chấm tĩnh. Loading không tạo player hoặc tải WASM; nút đang xử lý vẫn dùng nhãn chữ. File Bouncing Dots cũ được giữ cùng credits nhưng không còn dùng.
- Asset và WASM lưu nội bộ, ghi nguồn tại `apps/web/public/animations/CREDITS.md`. Player lazy-load; giữ kích thước, không nhận tương tác, không âm thanh, tạm dừng khi tab ẩn. Reduced motion và lỗi tải giữ nội dung/fallback tĩnh; timeout player 5 giây. Không thêm animation trong lúc trả lời câu hỏi.

### Kịch bản nghiệm thu (chưa kiểm tra runtime)

- Cả trò chơi và Ôn nhanh: dưới 50% không confetti và hiện câu thử lại; đúng 50% có confetti/câu `good`; đúng 80% có confetti/câu `great`; tổng 0 là `tryAgain`. Khôi phục kết quả không phát confetti; quy tắc sao mới giữ nguyên.
- Lời chào đầu tiên phát một lần; ghé lại đăng nhập/Hành trình trong cùng phiên dùng PNG. Reduced motion dùng PNG và chấm tĩnh, không tiêu thụ lượt giới thiệu. Owl kết quả không chịu giới hạn lời chào.
- Loading dưới 300 ms không hiện chấm; sau đó dùng CSS, không request `dotlottie-player.wasm` trên màn chỉ tải dữ liệu hoặc màn mở ứng dụng tĩnh. Màn có lời chào đầu tiên hoặc kết quả vẫn có thể tải WASM.
- Bố cục điện thoại và 1920 px giữ điểm, câu phản hồi và các nút rõ ràng; owl không che nội dung. Chữ phản hồi đọc được bằng screen reader, animation là trang trí.
- Giới hạn xác minh cho thay đổi này: chỉ production build web; các kịch bản runtime, session, network, accessibility và responsive ở trên chưa được chạy.

## Phản hồi, chuỗi ngày và hoàn thành khối

- Right Answer chỉ phát sau API xác nhận đúng, ngoài live region, tối đa 1 giây đang hiển thị. Mỗi câu mới thay pop cũ; rời câu/màn chơi bỏ pop ngay. Bảng phân nhóm gộp các câu đúng trong lần kiểm tra đã lưu thành một pop cạnh bảng. Không phát lại từ câu đã khôi phục, không chặn nút hoặc đổi focus. Khi bắt đầu chơi, preload module/player WASM/asset trong nền nếu không reduced motion; không chờ preload để chơi.
- Streak Fire ở Báo cáo và tiến độ tuần Hành trình chỉ khi streakDays ≥1; phát một lần tối đa 3 giây rồi giữ icon lửa. Không đổi con số hoặc quy tắc chuỗi ngày.
- Trophy ở Hành trình khi có ít nhất một unit và mọi unit trong khối đều complete, kể cả unit bị khóa hoặc thiếu nội dung. Lần đầu hiện “Hoàn thành cả khối! 🏆”, lưu `english-grade-trophy-seen:{studentId}:{gradeId}` trong localStorage khi hiện (kể cả fallback reduced motion), rồi không lặp ở lần ghé sau. Nếu storage bị chặn, dùng bộ nhớ theo vòng đời trang. Trophy tối đa 3 giây rồi giữ icon, không đổi sao màn kết quả.
- Empty states Sổ từ không có từ, Báo cáo chưa có lượt chơi và Ôn nhanh xác nhận chưa đủ nội dung dùng icon Inbox tĩnh: file No Data được chọn là 94,507 bytes, vượt ngân sách 20,000 bytes nên không bundle. Không dùng trạng thái này cho lỗi tải, loading hoặc tìm kiếm không khớp.
- Pop/lửa/trophy-empty có kích thước cố định lần lượt 40/28/112 px trên mobile, 56/36/144 px từ 1024 px và 72/48/176 px từ 1920 px. Tất cả là trang trí, không nhận tương tác. Reduced motion bỏ pop/preload và dùng icon tĩnh cho lửa/trophy/empty.

### Nghiệm thu mở rộng (chưa chạy)

- Bốn trò chơi, gồm phân nhóm từng từ và bảng, cùng Ôn nhanh: câu đúng liên tiếp không chồng pop/không chờ tiếp tục; lỗi lưu và câu khôi phục không phát pop. Câu/màn mới bỏ pop cũ.
- Chuỗi ngày 0 không lửa; ≥1 có lửa, số ngày giữ nguyên. Trophy chỉ khi mọi unit hoàn thành, không bỏ qua unit khóa; khối trống không có trophy; per-student/per-grade và lần ghé sau không phát lại, kể cả reduced motion và storage bị chặn.
- Empty-state icon xuất hiện đúng ba tình huống thiếu dữ liệu đã xác nhận. Reduced motion, điện thoại và 1920 px giữ chữ, focus và các nút dùng được.
- Chỉ xác minh production build web; chưa kiểm tra runtime, accessibility, network/preload, persistence hoặc responsive. Không sửa dữ liệu học sinh/Admin để kiểm tra.
