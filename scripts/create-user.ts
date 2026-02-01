#!/usr/bin/env tsx

import { config } from "dotenv";
config({ path: ".env.local", override: true });

const email = process.argv[2] || "admin@quizmaster.com";
const password = process.argv[3] || "admin123";
const name = process.argv[4] || "Admin User";

async function main() {
  try {
    // Load Prisma-dependent code after dotenv config runs.
    // (ESM imports are hoisted; this keeps DATABASE_URL available before Prisma initializes.)
    const { createUser } = require("../src/lib/user");
    const user = await createUser(email, password, name);
    console.log(`✅ User created successfully:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   ID: ${user.id}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      console.error(`❌ User with email ${email} already exists`);
    } else {
      console.error(`❌ Failed to create user:`, error);
    }
    process.exit(1);
  }
}

main();
