import type { Activity } from './game';

export const GAME_TIPS: Record<Activity, readonly string[]> = {
  group: [
    'Nhìn từ và chọn nhóm phù hợp.',
    'Chạm nhóm để trả lời, hoặc kéo từ vào nhóm.',
    'Xem kết quả rồi bấm Tiếp tục để chơi từ kế tiếp.',
  ],
  odd_letter: [
    'Nhìn từ mẫu ở trên. Dãy chữ bên dưới có một chữ thừa.',
    'Chạm chữ không thuộc từ để bỏ.',
    'Xem kết quả rồi bấm Tiếp tục. Không có tim, cứ bình tĩnh nhé!',
  ],
  scramble: [
    'Bấm Nghe từ rồi nghe thật kỹ.',
    'Chọn chữ trong bảng A–Z để ghép từ. Có thể chọn một chữ nhiều lần.',
    'Muốn sửa, bấm Gỡ hoặc Xóa hết. Xếp đủ rồi bấm Kiểm tra.',
  ],
  listen_spell: [
    'Bấm loa để nghe từ rồi từng chữ. Có thể bấm Nghe lại.',
    'Chạm các chữ đúng vào ô theo thứ tự. Trong khay có cả chữ nhiễu.',
    'Muốn sửa, bấm Gỡ hoặc Xóa hết. Xếp đủ rồi bấm Kiểm tra.',
  ],
};

export const GROUP_BOARD_TIPS = [
  'Chạm một từ rồi chạm nhóm, hoặc kéo từ vào nhóm.',
  'Xếp hết các từ. Bạn có thể đổi nhóm hoặc đưa từ về khay.',
  'Bấm Kiểm tra khi đã xếp xong để xem kết quả.',
] as const;
