# Data

Cột Postgres **snake_case**. Prisma field camelCase + `@map`. Bảng plural snake (`words`, `practice_sessions`).

## Curriculum

- `grades`: khối 1–5. Migration/seed khởi tạo các khối, không nạp từ mẫu.
- `units`: `grade_id`, `sort_order` (1–10), `title`, `opens_at` (UTC, nullable), `manual_lock`, `group_mode`, `group_include_previous_units` (boolean, mặc định false; chỉ áp dụng game group, xem ACTIVITIES.md).
- `words`: hồ sơ dùng chung theo từ và nghĩa; `lemma`, `meaning_vi`, `meaning_key`, `part_of_speech`, `image_key`, `audio_key`, `search_text`, `initial`.
- `lemma` và `meaning_key` trim, gộp khoảng trắng, chuyển chữ thường; unique `(lemma, meaning_key)`. Cùng cách viết được có nhiều nghĩa. Tạo nghĩa mới cho từ đã có cần điền nghĩa.
- `search_text`: từ và nghĩa được chuẩn hóa không dấu, phục vụ tìm kiếm; `initial`: A–Z hoặc `#`.
- `unit_words`: liên kết từ–unit, unique `(unit_id, word_id)`, có `active`. Gỡ liên kết chỉ đặt false; gắn lại tái sử dụng ID, giữ lịch sử.
- `word_categories`: category mặc định của hồ sơ. `unit_word_categories`: category riêng của liên kết trong unit. Khi gắn lần đầu, sao chép mặc định; thay mặc định không tự đổi các liên kết cũ.
- `categories`: `slug`, `title_vi`. `unit_activities`: hoạt động bật trong từng unit.
- Hồ sơ cho phép từ/cụm từ tối đa 120 ký tự; game hiện vẫn yêu cầu từ đơn A–Z dài tối đa 12. Admin hiển thị trạng thái hoạt động và lý do chưa phù hợp.

Không có bảng Game / Question cho 4 trò chơi unit; round sinh từ nội dung lúc chơi. Ôn nhanh có session/question riêng.

## Import từ vựng

Mẫu `vocabulary-import-v1.xlsx` giữ các tab Huong dan, Units, Categories, Words. Dòng mẫu là dữ liệu nhập thật nếu giữ nguyên. Ô nhập liệu không nhận công thức. Mã unit: `K1-U01`; category_code là slug toàn hệ thống.

Mỗi dòng Words là một từ/nghĩa dùng trong một unit. Cùng từ/nghĩa dùng lại hồ sơ; khác nghĩa tạo hồ sơ khác. Thiếu nghĩa và có nhiều nghĩa cùng cách viết là lỗi preview. Category của dòng dùng riêng cho unit; liên kết đã có giữ category khi nhập lại, kể cả khi được kích hoạt lại. Không ghi đè nghĩa/loại từ/ảnh đã có. Loại từ không khớp hồ sơ có sẵn là lỗi preview.

Giới hạn 50 unit, 100 category, 2.000 dòng từ. Preview chỉ đọc; commit kiểm tra lại và lưu trong transaction serializable. Unit mới chưa đặt lịch luôn khóa.

## Play / accounts

- `students` — `username` (unique), `password_hash`, `display_name`, `grade_id` (nullable for existing accounts awaiting onboarding), `school` and `class_name` (optional), `avatar_key` (nullable; key under `uploads/avatars/{studentId}/`). New registration requires a grade. Existing accounts default to no photo.
- `practice_sessions` — `student_id`, `unit_id`, `activity_type`, `started_at`, `ended_at`, `active_ms`
- `attempts` — `session_id`, `word_id` (tham chiếu `unit_words.id`, không phải hồ sơ chung), `sort_order`, `correct`, `prompt_json`, `answer_json`, `duration_ms`
- `review_sessions` — `student_id`, `grade_id`, `started_at`, `ended_at`, `active_ms`; tách khỏi tiến độ 4 trò chơi
- `review_questions` — `session_id`, `word_id` (tham chiếu `unit_words.id`), `sort_order`, `choice_ids`, `prompt_json` (nghĩa và nhãn lựa chọn snapshot), `selected_word_id`, `correct`

## Lịch khóa (`Asia/Ho_Chi_Minh`)

Unit mở khi `manual_lock = false`, có `opens_at`, và giờ server đạt mốc đó. Không có ngày mở: khóa. Khóa tay ưu tiên; không còn lịch cứng theo tháng hoặc số unit. Nhập/hiển thị giờ Việt Nam, lưu UTC. Không cần cron.

API path/unit trả `open`, `opensAt`, `lockReason`. Kiểm tra lại khi bắt đầu/tiếp tục game, trả lời và heartbeat, cùng Sổ từ/Ôn nhanh. Unit bị khóa giữa phiên chặn phần chưa trả lời; vẫn cho kết thúc phiên, xem kết quả và báo cáo cũ.

## Metrics

- Báo cáo và xem nhanh trên trang hành trình chỉ dùng sessions thuộc khối đang chọn; đổi khối không xóa attempts cũ.
- Phút tuần và 7 ngày: `sum(active_ms)` của practice + review sessions thuộc khối đang chọn trong **tuần ISO** (`Asia/Ho_Chi_Minh`), không rolling 7×24h.
- Unit complete: cả 4 `activity_type` có tỷ lệ đúng lifetime ≥ 0.8.
- Từ đã học: `count distinct word_id` với `correct = true`.
- Streak: ngày liên tiếp (local VN) có ≥1 practice session hoặc review session có `active_ms > 0`; miss một ngày → 0.
- % hoạt động: `correct / attempts` lifetime theo `activity_type`.
- Câu Ôn nhanh không đi vào attempts, stars, % hoạt động hoặc số từ đã học; trạng thái Sổ từ có thể dùng câu trả lời practice/review mới nhất.

## Quan hệ lịch sử

Lượt trả lời và lựa chọn Ôn nhanh dùng ID liên kết từ–unit. Vì vậy cùng hồ sơ dùng ở nhiều unit vẫn có tiến độ riêng. Các thao tác gỡ trong CMS không xóa hồ sơ hoặc liên kết có lịch sử. Admin v1 chỉ tạo/sửa category và unit, không cung cấp xóa dữ liệu học tập.
