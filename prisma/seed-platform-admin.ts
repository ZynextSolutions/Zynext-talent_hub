import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL ?? 'admin@platform.com').toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? 'Platform123!';
  const firstName = process.env.PLATFORM_ADMIN_FIRST_NAME ?? 'Platform';
  const lastName = process.env.PLATFORM_ADMIN_LAST_NAME ?? 'Admin';

  if (password.length < 12) {
    throw new Error('PLATFORM_ADMIN_PASSWORD must be at least 12 characters');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.platformAdmin.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
    },
    update: {
      ...(process.env.PLATFORM_ADMIN_PASSWORD ? { passwordHash } : {}),
      ...(process.env.PLATFORM_ADMIN_FIRST_NAME ? { firstName } : {}),
      ...(process.env.PLATFORM_ADMIN_LAST_NAME ? { lastName } : {}),
    },
  });

  console.log('Platform admin seed complete.');
  console.log(`Email: ${email}`);
  if (!process.env.PLATFORM_ADMIN_PASSWORD) {
    console.log('Password: Platform123! (default — set PLATFORM_ADMIN_PASSWORD for production)');
  }
  console.log('Sign in at /platform/login');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
