# Activities

Sinh round từ words của unit (shuffle, tối đa ~8). Snapshot `prompt_json` trên mỗi attempt.

Tap-to-place, target ≥ 44px. Không hearts.

## group

Mỗi từ = một attempt: đặt vào bucket category. Cần ≥2 category trên unit; không thì ẩn game.

## odd_letter

Giữ nguyên thứ tự chữ cái của lemma và chèn đúng 1 chữ thừa ngẫu nhiên, không có trong từ, vào vị trí ngẫu nhiên (kể cả đầu hoặc cuối). Ví dụ: dog → dong hoặc dogn. API lưu đáp án của câu để chấm và khôi phục sau tải lại; giao diện chỉ hiển thị các ô chữ. Học sinh chọn chữ bỏ.

## scramble

Nghe từ rồi chọn chữ từ bảng đầy đủ A–Z theo thứ tự để ghép đúng lemma. Mỗi chữ có thể chọn nhiều lần; số ô bằng độ dài từ. Có thể gỡ từng chữ hoặc xóa hết trước khi kiểm tra.

## listen_spell

Tap loa: `speechSynthesis` đọc lemma rồi từng chữ (`en-US`). Ảnh từ. Ô trống + bank = chữ trong từ + 4 distractor. Tap chữ vào ô.
