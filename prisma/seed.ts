import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CATEGORY_DEFINITIONS } from '../src/lib/constants';

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
