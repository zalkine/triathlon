import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CATEGORY_DEFINITIONS } from '../src/lib/constants';
import { HISTORICAL_RESULTS } from '../src/data/historical';
import { DEFAULT_INFO_SECTIONS } from '../src/data/info';

const prisma = new PrismaClient();

async function main() {
  for (const cat of CATEGORY_DEFINITIONS) {
    await prisma.category.upsert({
      where: { key: cat.key },
      update: {
        nameEn: cat.nameEn,
        nameHe: cat.nameHe,
        type: cat.type,
        sortOrder: cat.sortOrder,
        estDurationMinutes: cat.estDurationMinutes,
      },
      create: cat,
    });
  }

  await prisma.eventSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });

  // Seed the Hall of Fame from the static sheets exactly once. After that the
  // table is the source of truth and fully editable by the admin, so we never
  // overwrite it on subsequent seeds.
  const hofCount = await prisma.historicalResult.count();
  if (hofCount === 0) {
    await prisma.historicalResult.createMany({
      data: HISTORICAL_RESULTS.map((r) => ({
        year: r.year,
        categoryHe: r.categoryHe,
        family: r.family,
        isTeam: r.isTeam,
        rank: r.rank,
        name: r.name,
        seconds: r.seconds,
        members: r.members ?? [],
      })),
    });
    console.log(`Seeded ${HISTORICAL_RESULTS.length} historical results.`);
  } else {
    // One-time migration: split the Kids family into KidsAG (א-ג) and KidsDV (ד-ו).
    const agCount = await prisma.historicalResult.updateMany({
      where: { family: 'Kids', categoryHe: { contains: 'א-ג' } },
      data: { family: 'KidsAG' },
    });
    const dvCount = await prisma.historicalResult.updateMany({
      where: { family: 'Kids', categoryHe: { contains: 'ד-ו' } },
      data: { family: 'KidsDV' },
    });
    if (agCount.count > 0 || dvCount.count > 0)
      console.log(`Migrated Kids→KidsAG: ${agCount.count}, Kids→KidsDV: ${dvCount.count}`);
  }

  // Seed starter Rules & Trails content once so the admin has editable blocks
  // to work from. Never overwritten afterwards.
  const infoCount = await prisma.infoSection.count();
  if (infoCount === 0) {
    await prisma.infoSection.createMany({ data: DEFAULT_INFO_SECTIONS });
    console.log(`Seeded ${DEFAULT_INFO_SECTIONS.length} info sections.`);
  }

  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'changeme';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash, role: 'ADMIN' },
  });

  console.log(`Seeded ${CATEGORY_DEFINITIONS.length} categories.`);
  console.log('Seeded event settings singleton.');
  console.log(`Seeded admin user "${username}" (password left unchanged if it already existed).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
