/**
 * Seed script — creates the initial admin user.
 * Run with: npm run seed
 *
 * Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env before running,
 * or update the values below.
 */
import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

// Use unpooled URL for direct connection (required for Neon / PgBouncer)
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@yourcompany.com"
  const adminPassword = process.env.ADMIN_PASSWORD ?? "changeme123"

  const hashed = await bcrypt.hash(adminPassword, 10)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashed,
      role: "ADMIN",
    },
  })

  console.log(`✅ Admin user ready: ${admin.email}`)
  console.log("   Log in and change your password from Settings.")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
