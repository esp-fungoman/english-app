import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  for (const level of [1, 2, 3, 4, 5]) {
    await prisma.grade.upsert({
      where: { level },
      create: { level, title: `Khối ${level}` },
      update: {},
    });
  }
  console.log('Ready: grades 1–5. Add vocabulary and unit schedules in Admin.');
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
