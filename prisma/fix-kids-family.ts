import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Update א-ג entries to KidsAG
  const agResult = await prisma.historicalResult.updateMany({
    where: {
      family: 'Kids',
      categoryHe: { contains: 'א-ג' },
    },
    data: { family: 'KidsAG' },
  });
  console.log(`Updated ${agResult.count} א-ג records to KidsAG`);

  // Update ד-ו entries to KidsDV
  const dvResult = await prisma.historicalResult.updateMany({
    where: {
      family: 'Kids',
      categoryHe: { contains: 'ד-ו' },
    },
    data: { family: 'KidsDV' },
  });
  console.log(`Updated ${dvResult.count} ד-ו records to KidsDV`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
