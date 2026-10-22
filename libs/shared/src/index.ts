export const ACTIVITY_TYPES = [
  'group',
  'odd_letter',
  'scramble',
  'listen_spell',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_LABELS_VI: Record<ActivityType, string> = {
  group: 'Ghép từ theo nhóm',
  odd_letter: 'Tìm chữ cái thừa',
  scramble: 'Sắp xếp chữ cái',
  listen_spell: 'Nghe và chọn chữ cái',
};
