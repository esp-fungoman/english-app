import { ActivityType, PrismaClient } from '@prisma/client';
import { normalize, searchable } from '../src/curriculum/words';

// Explicit local demo only. The normal seed remains grades-only for deployment.
const prisma = new PrismaClient();
type Entry = readonly [
  lemma: string,
  meaning: string,
  pos: 'noun' | 'verb' | 'adjective',
  category: string,
  unitCategory?: string,
];
type DemoUnit = { title: string; mode: 'single' | 'board'; entries: Entry[] };
const categories: Record<string, string> = {
  'school-supplies': 'Đồ dùng học tập',
  'classroom-furniture': 'Đồ đạc trong lớp',
  'classroom-actions': 'Hoạt động trong lớp',
  colors: 'Màu sắc',
  shapes: 'Hình dạng',
  pets: 'Thú nuôi',
  'wild-animals': 'Động vật hoang dã',
  fruits: 'Trái cây',
  drinks: 'Đồ uống',
  family: 'Gia đình',
  people: 'Mọi người',
  clothes: 'Quần áo',
  accessories: 'Phụ kiện',
  'clothing-colors': 'Màu của trang phục',
  movement: 'Vận động',
  'learning-actions': 'Hoạt động học tập',
  'fun-actions': 'Hoạt động vui chơi',
  instruments: 'Nhạc cụ',
  'body-parts': 'Bộ phận cơ thể',
  feelings: 'Cảm xúc và trạng thái',
  'picnic-foods': 'Đồ ăn dã ngoại',
  outdoors: 'Ngoài trời',
};
const units: DemoUnit[] = [
  {
    title: 'Unit 1 · Hello, classroom!',
    mode: 'single',
    entries: [
      ['book', 'quyển sách', 'noun', 'school-supplies'],
      ['pen', 'bút mực', 'noun', 'school-supplies'],
      ['pencil', 'bút chì', 'noun', 'school-supplies'],
      ['ruler', 'thước kẻ', 'noun', 'school-supplies'],
      ['eraser', 'cục tẩy', 'noun', 'school-supplies'],
      ['bag', 'cặp sách', 'noun', 'school-supplies'],
      ['desk', 'bàn học', 'noun', 'classroom-furniture'],
      ['chair', 'ghế', 'noun', 'classroom-furniture'],
      ['board', 'bảng', 'noun', 'classroom-furniture'],
      ['door', 'cửa ra vào', 'noun', 'classroom-furniture'],
      ['read', 'đọc', 'verb', 'classroom-actions'],
      ['write', 'viết', 'verb', 'classroom-actions'],
    ],
  },
  {
    title: 'Unit 2 · Colors and shapes',
    mode: 'board',
    entries: [
      ['red', 'màu đỏ', 'adjective', 'colors'],
      ['blue', 'màu xanh dương', 'adjective', 'colors'],
      ['green', 'màu xanh lá', 'adjective', 'colors'],
      ['yellow', 'màu vàng', 'adjective', 'colors'],
      ['orange', 'màu cam', 'adjective', 'colors'],
      ['purple', 'màu tím', 'adjective', 'colors'],
      ['black', 'màu đen', 'adjective', 'colors'],
      ['white', 'màu trắng', 'adjective', 'colors'],
      ['circle', 'hình tròn', 'noun', 'shapes'],
      ['square', 'hình vuông', 'noun', 'shapes'],
      ['triangle', 'hình tam giác', 'noun', 'shapes'],
      ['star', 'hình ngôi sao', 'noun', 'shapes'],
    ],
  },
  {
    title: 'Unit 3 · Animal friends',
    mode: 'single',
    entries: [
      ['cat', 'con mèo', 'noun', 'pets'],
      ['dog', 'con chó', 'noun', 'pets'],
      ['rabbit', 'con thỏ', 'noun', 'pets'],
      ['hamster', 'chuột hamster', 'noun', 'pets'],
      ['parrot', 'con vẹt', 'noun', 'pets'],
      ['turtle', 'con rùa', 'noun', 'pets'],
      ['lion', 'sư tử', 'noun', 'wild-animals'],
      ['tiger', 'con hổ', 'noun', 'wild-animals'],
      ['elephant', 'con voi', 'noun', 'wild-animals'],
      ['monkey', 'con khỉ', 'noun', 'wild-animals'],
      ['zebra', 'ngựa vằn', 'noun', 'wild-animals'],
      ['giraffe', 'hươu cao cổ', 'noun', 'wild-animals'],
    ],
  },
  {
    title: 'Unit 4 · Fruit and drinks',
    mode: 'board',
    entries: [
      ['apple', 'quả táo', 'noun', 'fruits'],
      ['banana', 'quả chuối', 'noun', 'fruits'],
      ['orange', 'quả cam', 'noun', 'fruits'],
      ['grape', 'quả nho', 'noun', 'fruits'],
      ['mango', 'quả xoài', 'noun', 'fruits'],
      ['pear', 'quả lê', 'noun', 'fruits'],
      ['peach', 'quả đào', 'noun', 'fruits'],
      ['lemon', 'quả chanh vàng', 'noun', 'fruits'],
      ['milk', 'sữa', 'noun', 'drinks'],
      ['water', 'nước', 'noun', 'drinks'],
      ['juice', 'nước ép', 'noun', 'drinks'],
      ['tea', 'trà', 'noun', 'drinks'],
    ],
  },
  {
    title: 'Unit 5 · My family and friends',
    mode: 'single',
    entries: [
      ['mother', 'mẹ', 'noun', 'family'],
      ['father', 'bố', 'noun', 'family'],
      ['sister', 'chị hoặc em gái', 'noun', 'family'],
      ['brother', 'anh hoặc em trai', 'noun', 'family'],
      ['grandma', 'bà', 'noun', 'family'],
      ['grandpa', 'ông', 'noun', 'family'],
      ['aunt', 'cô hoặc dì', 'noun', 'family'],
      ['uncle', 'chú hoặc cậu', 'noun', 'family'],
      ['teacher', 'giáo viên', 'noun', 'people'],
      ['student', 'học sinh', 'noun', 'people'],
      ['friend', 'bạn bè', 'noun', 'people'],
      ['baby', 'em bé', 'noun', 'people'],
    ],
  },
  {
    title: 'Unit 6 · What are you wearing?',
    mode: 'board',
    entries: [
      ['shirt', 'áo sơ mi', 'noun', 'clothes'],
      ['pants', 'quần dài', 'noun', 'clothes'],
      ['dress', 'váy liền', 'noun', 'clothes'],
      ['shoes', 'giày', 'noun', 'clothes'],
      ['hat', 'mũ', 'noun', 'clothes'],
      ['coat', 'áo khoác', 'noun', 'clothes'],
      ['watch', 'đồng hồ đeo tay', 'noun', 'accessories'],
      ['bag', 'cặp sách', 'noun', 'school-supplies', 'accessories'],
      ['red', 'màu đỏ', 'adjective', 'colors', 'clothing-colors'],
      ['blue', 'màu xanh dương', 'adjective', 'colors', 'clothing-colors'],
      ['black', 'màu đen', 'adjective', 'colors', 'clothing-colors'],
      ['white', 'màu trắng', 'adjective', 'colors', 'clothing-colors'],
    ],
  },
  {
    title: 'Unit 7 · Things I can do',
    mode: 'single',
    entries: [
      ['run', 'chạy', 'verb', 'movement'],
      ['walk', 'đi bộ', 'verb', 'movement'],
      ['jump', 'nhảy', 'verb', 'movement'],
      ['swim', 'bơi', 'verb', 'movement'],
      ['sit', 'ngồi', 'verb', 'movement'],
      ['stand', 'đứng', 'verb', 'movement'],
      ['read', 'đọc', 'verb', 'classroom-actions', 'learning-actions'],
      ['write', 'viết', 'verb', 'classroom-actions', 'learning-actions'],
      ['sing', 'hát', 'verb', 'fun-actions'],
      ['dance', 'nhảy múa', 'verb', 'fun-actions'],
      ['play', 'chơi', 'verb', 'fun-actions'],
      ['watch', 'xem', 'verb', 'fun-actions'],
    ],
  },
  {
    title: 'Unit 8 · Back to school',
    mode: 'board',
    entries: [
      ['book', 'quyển sách', 'noun', 'school-supplies'],
      ['pen', 'bút mực', 'noun', 'school-supplies'],
      ['pencil', 'bút chì', 'noun', 'school-supplies'],
      ['ruler', 'thước kẻ', 'noun', 'school-supplies'],
      ['eraser', 'cục tẩy', 'noun', 'school-supplies'],
      ['bag', 'cặp sách', 'noun', 'school-supplies'],
      ['umbrella', 'cái ô', 'noun', 'accessories'],
      ['violin', 'đàn vĩ cầm', 'noun', 'instruments'],
      ['piano', 'đàn dương cầm', 'noun', 'instruments'],
      ['drum', 'trống', 'noun', 'instruments'],
      ['guitar', 'đàn ghi-ta', 'noun', 'instruments'],
      ['xylophone', 'đàn phiến gỗ', 'noun', 'instruments'],
    ],
  },
  {
    title: 'Unit 9 · My body and feelings',
    mode: 'single',
    entries: [
      ['head', 'đầu', 'noun', 'body-parts'],
      ['hand', 'bàn tay', 'noun', 'body-parts'],
      ['arm', 'cánh tay', 'noun', 'body-parts'],
      ['leg', 'chân', 'noun', 'body-parts'],
      ['foot', 'bàn chân', 'noun', 'body-parts'],
      ['eye', 'mắt', 'noun', 'body-parts'],
      ['happy', 'vui vẻ', 'adjective', 'feelings'],
      ['sad', 'buồn', 'adjective', 'feelings'],
      ['angry', 'tức giận', 'adjective', 'feelings'],
      ['tired', 'mệt', 'adjective', 'feelings'],
      ['hungry', 'đói', 'adjective', 'feelings'],
      ['thirsty', 'khát', 'adjective', 'feelings'],
    ],
  },
  {
    title: 'Unit 10 · A happy picnic',
    mode: 'board',
    entries: [
      ['apple', 'quả táo', 'noun', 'fruits', 'picnic-foods'],
      ['banana', 'quả chuối', 'noun', 'fruits', 'picnic-foods'],
      ['orange', 'quả cam', 'noun', 'fruits', 'picnic-foods'],
      ['bread', 'bánh mì', 'noun', 'picnic-foods'],
      ['cake', 'bánh ngọt', 'noun', 'picnic-foods'],
      ['egg', 'quả trứng', 'noun', 'picnic-foods'],
      ['milk', 'sữa', 'noun', 'drinks'],
      ['water', 'nước', 'noun', 'drinks'],
      ['juice', 'nước ép', 'noun', 'drinks'],
      ['sun', 'mặt trời', 'noun', 'outdoors'],
      ['tree', 'cây', 'noun', 'outdoors'],
      ['flower', 'bông hoa', 'noun', 'outdoors'],
    ],
  },
];

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    decodeURIComponent(target.pathname.slice(1)) !== 'english'
  ) {
    throw new Error('Demo seed is restricted to the local english database.');
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  const today = new Date(
    `${parts.year}-${parts.month}-${parts.day}T00:00:00+07:00`,
  );
  const day = (offset: number) =>
    new Date(today.getTime() + offset * 86_400_000);
  const summary = await prisma.$transaction(
    async (tx) => {
      const grade = await tx.grade.upsert({
        where: { level: 1 },
        create: { level: 1, title: 'Khối 1' },
        update: {},
      });
      const categoryIds = new Map<string, string>();
      let categoriesCreated = 0,
        unitsCreated = 0,
        wordsCreated = 0,
        linksCreated = 0;
      for (const [slug, titleVi] of Object.entries(categories)) {
        const existing = await tx.category.findUnique({ where: { slug } });
        const category =
          existing ?? (await tx.category.create({ data: { slug, titleVi } }));
        if (!existing) categoriesCreated++;
        categoryIds.set(slug, category.id);
      }
      for (const [index, config] of units.entries()) {
        const sortOrder = index + 1;
        const existing = await tx.unit.findUnique({
          where: { gradeId_sortOrder: { gradeId: grade.id, sortOrder } },
        });
        const unit =
          existing ??
          (await tx.unit.create({
            data: {
              gradeId: grade.id,
              sortOrder,
              title: config.title,
              groupMode: config.mode,
              opensAt:
                sortOrder <= 6
                  ? day(-14)
                  : sortOrder === 7
                    ? day(7)
                    : sortOrder === 8
                      ? day(14)
                      : sortOrder === 9
                        ? null
                        : day(-14),
              manualLock: sortOrder === 10,
            },
          }));
        if (!existing) unitsCreated++;
        for (const activityType of Object.values(ActivityType)) {
          await tx.unitActivity.upsert({
            where: { unitId_activityType: { unitId: unit.id, activityType } },
            create: { unitId: unit.id, activityType },
            update: {},
          });
        }
        for (const [
          rawLemma,
          meaningVi,
          partOfSpeech,
          category,
          unitCategory,
        ] of config.entries) {
          const lemma = normalize(rawLemma),
            meaningKey = normalize(meaningVi);
          const defaultId = categoryIds.get(category)!;
          const categoryId = categoryIds.get(unitCategory ?? category)!;
          const existingWord = await tx.word.findUnique({
            where: { lemma_meaningKey: { lemma, meaningKey } },
          });
          const word =
            existingWord ??
            (await tx.word.create({
              data: {
                lemma,
                meaningVi,
                meaningKey,
                partOfSpeech,
                initial: lemma[0].toUpperCase(),
                searchText: searchable(`${lemma} ${meaningVi}`),
                categories: { create: { categoryId: defaultId } },
              },
            }));
          if (!existingWord) wordsCreated++;
          const existingLink = await tx.unitWord.findUnique({
            where: { unitId_wordId: { unitId: unit.id, wordId: word.id } },
          });
          if (!existingLink) {
            await tx.unitWord.create({
              data: {
                unitId: unit.id,
                wordId: word.id,
                categories: { create: { categoryId } },
              },
            });
            linksCreated++;
          }
        }
      }
      return {
        grade: grade.title,
        categoriesCreated,
        unitsCreated,
        wordsCreated,
        linksCreated,
      };
    },
    { timeout: 60_000 },
  );
  console.log(
    JSON.stringify(
      {
        ...summary,
        sampleUnits: units.length,
        sampleLinks: units.reduce(
          (total, unit) => total + unit.entries.length,
          0,
        ),
        imagesAdded: 0,
        schedule: {
          open: 'Unit 1–6',
          future: 'Unit 7 (+7 days), Unit 8 (+14 days)',
          unscheduled: 'Unit 9',
          manualLock: 'Unit 10',
        },
      },
      null,
      2,
    ),
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Demo seed failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
