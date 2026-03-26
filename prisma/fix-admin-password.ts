/**
 * Fixes the admin password — hashes it with bcrypt if it's stored as plain text.
 * Run with: npx tsx prisma/fix-admin-password.ts
 */
import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@growmedico.com"
  const newPassword = process.argv[2] ?? process.env.ADMIN_PASSWORD ?? "Admin@1234"

  const hashed = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { email: adminEmail },
    data: { password: hashed },
  })

  console.log(`✅ Password updated for ${adminEmail}`)
  console.log(`   You can now log in with password: ${newPassword}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
