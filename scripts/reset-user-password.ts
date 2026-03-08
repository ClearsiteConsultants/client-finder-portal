#!/usr/bin/env tsx

import { config } from 'dotenv';
import { hash } from 'bcryptjs';

config({ path: '.env.local', override: true });

const email = process.argv[2] || 'admin@quizmaster.com';
const newPassword = process.argv[3] || 'admin123';

async function main() {
  try {
    // Load Prisma after dotenv so DATABASE_URL is available.
    const { prisma } = require('../src/lib/prisma');

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!existingUser) {
      console.error(`❌ User not found: ${email}`);
      console.error('   Create the user first with scripts/create-user.ts');
      process.exit(1);
    }

    const passwordHash = await hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    console.log('✅ Password reset successfully:');
    console.log(`   Email: ${existingUser.email}`);
    console.log(`   Name: ${existingUser.name || '(no name)'}`);
  } catch (error) {
    console.error('❌ Failed to reset password:', error);
    process.exit(1);
  }
}

main();