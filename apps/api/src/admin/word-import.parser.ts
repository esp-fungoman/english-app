import { Workbook, type Cell, type Worksheet } from 'exceljs';
import { normalize } from '../curriculum/words';
import { GroupMode } from '@prisma/client';

export type ImportIssue = {
  sheet: string;
  row: number;
  field: string;
  code: string;
  message: string;
};

export type ImportUnit = {
  row: number;
  code: string;
  gradeLevel: number;
  number: number;
  title: string;
  groupMode: GroupMode | null;
};

export type ImportCategory = { row: number; code: string; titleVi: string };
export type ImportWord = {
  row: number;
  unitCode: string;
  lemma: string;
  meaningVi: string;
  partOfSpeech: string;
  categoryCodes: string[];
};

export type ParsedImport = {
  units: ImportUnit[];
  categories: ImportCategory[];
  words: ImportWord[];
  errors: ImportIssue[];
};

const POS = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'determiner',
  'conjunction',
  'interjection',
  'other',
]);
const HEADERS = {
  Units: [
    'grade_level',
    'unit_number',
    'unit_title',
    'group_mode',
    'unit_code',
  ],
  Categories: ['category_code', 'category_title_vi'],
  Words: [
    'unit_code',
    'grade_level',
    'unit_title',
    'lemma',
    'meaning_vi',
    'part_of_speech',
    'category_1',
    'category_2',
    'category_3',
    'category_4',
    'category_titles',
  ],
} as const;

function input(cell: Cell): string | null {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number')
    return String(value).trim();
  return null;
}

export async function parseWordImport(buffer: Buffer): Promise<ParsedImport> {
  const result: ParsedImport = {
    units: [],
    categories: [],
    words: [],
    errors: [],
  };
  const error = (
    sheet: string,
    row: number,
    field: string,
    code: string,
    message: string,
  ) => result.errors.push({ sheet, row, field, code, message });
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    error('File', 0, 'file', 'INVALID_XLSX', 'Không thể đọc file Excel.');
    return result;
  }
  const guide = workbook.getWorksheet('Huong dan');
  if (!guide || input(guide.getCell('B2')) !== 'vocabulary-import-v1') {
    error(
      'Huong dan',
      2,
      'version',
      'INVALID_VERSION',
      'Hãy dùng mẫu vocabulary-import-v1.',
    );
  }
  for (const [name, headers] of Object.entries(HEADERS)) {
    const sheet = workbook.getWorksheet(name);
    if (!sheet) {
      error(name, 0, 'sheet', 'MISSING_SHEET', `Thiếu tab ${name}.`);
      continue;
    }
    headers.forEach((header, index) => {
      if (input(sheet.getRow(1).getCell(index + 1)) !== header)
        error(
          name,
          1,
          header,
          'INVALID_HEADER',
          `Cột ${index + 1} phải là ${header}.`,
        );
    });
  }
  if (result.errors.length) return result;

  const readRows = (
    sheet: Worksheet,
    lastRow: number,
    columns: number[],
    visit: (row: number, get: (col: number) => string) => void,
  ) => {
    sheet.eachRow((excelRow, row) => {
      if (row < 2) return;
      const cells = columns.map((col) => input(excelRow.getCell(col)));
      if (cells.every((value) => value === '')) return;
      if (row > lastRow) {
        error(
          sheet.name,
          row,
          'row',
          'ROW_LIMIT',
          `Vượt quá ${lastRow - 1} dòng dữ liệu.`,
        );
        return;
      }
      if (cells.some((value) => value === null)) {
        error(
          sheet.name,
          row,
          'row',
          'INPUT_FORMULA',
          'Ô nhập liệu không được chứa công thức hoặc dữ liệu đặc biệt.',
        );
        return;
      }
      visit(row, (col) => input(excelRow.getCell(col)) ?? '');
    });
  };

  readRows(workbook.getWorksheet('Units')!, 51, [1, 2, 3, 4], (row, get) => {
    const gradeLevel = Number(get(1));
    const number = Number(get(2));
    const title = get(3);
    const mode = get(4).toLowerCase();
    if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 5)
      error(
        'Units',
        row,
        'grade_level',
        'INVALID_GRADE',
        'Khối phải từ 1 đến 5.',
      );
    if (!Number.isInteger(number) || number < 1 || number > 10)
      error(
        'Units',
        row,
        'unit_number',
        'INVALID_UNIT_NUMBER',
        'Số unit phải từ 1 đến 10.',
      );
    if (!title || title.length > 120)
      error(
        'Units',
        row,
        'unit_title',
        'INVALID_TITLE',
        'Tên unit cần từ 1 đến 120 ký tự.',
      );
    if (mode && mode !== GroupMode.single && mode !== GroupMode.board)
      error(
        'Units',
        row,
        'group_mode',
        'INVALID_MODE',
        'Chế độ phải là single hoặc board.',
      );
    if (Number.isInteger(gradeLevel) && Number.isInteger(number))
      result.units.push({
        row,
        code: `K${gradeLevel}-U${String(number).padStart(2, '0')}`,
        gradeLevel,
        number,
        title,
        groupMode: mode ? (mode as GroupMode) : null,
      });
  });

  readRows(workbook.getWorksheet('Categories')!, 101, [1, 2], (row, get) => {
    const code = get(1).toLowerCase();
    const titleVi = get(2);
    if (!/^[a-z][a-z0-9-]{0,49}$/.test(code))
      error(
        'Categories',
        row,
        'category_code',
        'INVALID_CODE',
        'Mã nhóm dùng chữ thường, số và dấu gạch ngang; tối đa 50 ký tự.',
      );
    if (!titleVi || titleVi.length > 80)
      error(
        'Categories',
        row,
        'category_title_vi',
        'INVALID_TITLE',
        'Tên nhóm cần từ 1 đến 80 ký tự.',
      );
    result.categories.push({ row, code, titleVi });
  });

  readRows(
    workbook.getWorksheet('Words')!,
    2001,
    [1, 4, 5, 6, 7, 8, 9, 10],
    (row, get) => {
      const unitCode = get(1).toUpperCase();
      const lemma = normalize(get(4));
      const meaningVi = get(5);
      const partOfSpeech = get(6).toLowerCase();
      const categoryCodes = [7, 8, 9, 10]
        .map((col) => get(col).toLowerCase())
        .filter(Boolean);
      if (!/^K[1-5]-U(0[1-9]|10)$/.test(unitCode))
        error(
          'Words',
          row,
          'unit_code',
          'INVALID_UNIT_CODE',
          'Mã unit không hợp lệ.',
        );
      if (!lemma || lemma.length > 120)
        error(
          'Words',
          row,
          'lemma',
          'INVALID_LEMMA',
          'Từ/cụm từ cần từ 1 đến 120 ký tự.',
        );
      if (meaningVi.length > 120)
        error(
          'Words',
          row,
          'meaning_vi',
          'INVALID_MEANING',
          'Nghĩa tối đa 120 ký tự; cần điền khi từ có nhiều nghĩa.',
        );
      if (partOfSpeech && !POS.has(partOfSpeech))
        error(
          'Words',
          row,
          'part_of_speech',
          'INVALID_POS',
          'Loại từ không hợp lệ.',
        );
      if (
        !categoryCodes.length ||
        new Set(categoryCodes).size !== categoryCodes.length
      )
        error(
          'Words',
          row,
          'category_1',
          'INVALID_CATEGORIES',
          'Cần 1-4 nhóm không trùng nhau.',
        );
      result.words.push({
        row,
        unitCode,
        lemma,
        meaningVi,
        partOfSpeech,
        categoryCodes,
      });
    },
  );

  const seen = new Map<string, number>();
  const unique = (sheet: string, row: number, field: string, key: string) => {
    const first = seen.get(`${sheet}:${key}`);
    if (first)
      error(sheet, row, field, 'DUPLICATE_IN_FILE', `Trùng với dòng ${first}.`);
    else seen.set(`${sheet}:${key}`, row);
  };
  for (const unit of result.units)
    unique('Units', unit.row, 'unit_number', unit.code);
  for (const category of result.categories)
    unique('Categories', category.row, 'category_code', category.code);
  for (const word of result.words)
    unique(
      'Words',
      word.row,
      'lemma',
      `${word.unitCode}:${word.lemma}:${normalize(word.meaningVi)}`,
    );
  const units = new Set(result.units.map((unit) => unit.code));
  const categories = new Set(
    result.categories.map((category) => category.code),
  );
  for (const word of result.words) {
    if (!units.has(word.unitCode))
      error(
        'Words',
        word.row,
        'unit_code',
        'UNKNOWN_UNIT',
        'Mã unit chưa có trong tab Units.',
      );
    for (const category of word.categoryCodes)
      if (!categories.has(category))
        error(
          'Words',
          word.row,
          'category_1',
          'UNKNOWN_CATEGORY',
          `Nhóm ${category} chưa có trong tab Categories.`,
        );
  }
  if (!result.words.length)
    error(
      'Words',
      0,
      'lemma',
      'NO_WORDS',
      'Hãy nhập ít nhất một từ ở tab Words.',
    );
  return result;
}
