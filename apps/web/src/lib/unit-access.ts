export function unitLockMessage(unit: {
  opensAt?: string | null;
  lockReason?: string | null;
}) {
  if (unit.lockReason === 'Khóa tay') return 'Unit đang được giáo viên khóa.';
  if (!unit.opensAt) return 'Unit chưa được đặt lịch mở. Em quay lại sau nhé.';
  const when = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(unit.opensAt));
  return `Unit mở từ ${when} (giờ Việt Nam).`;
}
