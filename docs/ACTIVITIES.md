# Activities

Sinh round từ words của unit (shuffle, tối đa ~8). Snapshot `prompt_json` trên mỗi attempt.

Tap-to-place, target ≥ 44px. Không hearts.

## Từ và cụm từ trong game

Game nhận từ đơn hoặc cụm từ: chữ A–Z, các phần nối bằng một dấu cách, gạch nối hoặc dấu nháy (`fish and chips`, `yo-yo`, `o'clock`), tối đa 4 phần, mỗi phần tối đa 12 chữ và tổng tối đa 20 chữ cái (không tính dấu nối). Game so khớp không phân biệt hoa thường; dấu nháy cong được coi như dấu nháy thẳng. Dấu nối luôn được cho sẵn: học sinh không phải chọn, ô chữ chia nhóm theo từng phần (gạch nối/dấu nháy hiện giữa hai nhóm), chấm điểm chỉ so chữ cái. Ô chữ tự thu nhỏ (tối thiểu 30px) để mỗi phần nằm trên một hàng khi đủ chỗ. Từ/cụm khác vẫn lưu được và Admin hiện lý do.

## group

Mỗi từ = một attempt: đặt vào bucket category. Cần ≥2 category trên unit; không thì ẩn game.

Unit có tùy chọn `groupIncludePreviousUnits` (mặc định false). Khi bật, gom các liên kết từ còn active từ Unit 1 đến unit hiện tại theo `sortOrder`, cùng khối và đã mở (không khóa tay, có lịch mở đã tới). Mỗi hồ sơ Word xuất hiện một lần; ưu tiên liên kết/category của unit đã mở gần nhất. Giữ điều kiện từ/cụm từ hợp lệ cho game (xem trên) và có nhóm đúng cùng lựa chọn sai.

Cả chế độ Từng từ và Bảng phân nhóm đều dùng hết từ hợp lệ trong kho đã gom, không giới hạn 8 từ. Bảng tích lũy dùng các nhóm cần thiết, không giới hạn 4 nhóm như bảng thường; nhóm rỗng và từ không có lựa chọn sai bị loại. Tắt tùy chọn giữ hành vi cũ. Session và tiến độ thuộc unit đang chơi; attempt vẫn tham chiếu UnitWord nguồn. Nếu unit nguồn của câu chưa trả lời bị khóa, phiên không cho tiếp tục/trả lời mới; lịch sử đã chấm vẫn giữ nguyên.

## odd_letter

Giữ nguyên thứ tự chữ cái của lemma và chèn đúng 1 chữ thừa ngẫu nhiên, không có trong từ, vào vị trí ngẫu nhiên (kể cả đầu hoặc cuối). Ví dụ: dog → dong hoặc dogn. Cụm từ giữ khoảng trống giữa các từ; khoảng trống không chọn được. API lưu đáp án của câu để chấm và khôi phục sau tải lại; giao diện chỉ hiển thị các ô chữ. Học sinh chọn chữ bỏ.

## scramble

Nghe từ rồi chọn chữ từ bảng đầy đủ A–Z theo thứ tự để ghép đúng lemma. Mỗi chữ có thể chọn nhiều lần; số ô bằng số chữ cái, chia nhóm theo từng từ nếu là cụm. Có thể gỡ từng chữ hoặc xóa hết trước khi kiểm tra.

## listen_spell

Tap loa: `speechSynthesis` đọc lemma rồi từng chữ, bỏ qua dấu nối (`en-US`). Ảnh từ. Ô trống (chia nhóm theo từ) + bank = chữ trong từ + 4 distractor. Tap chữ vào ô.
