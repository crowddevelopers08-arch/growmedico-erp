/**
 * Clears ALL data from the database except the admin user.
 * Run with: npx tsx prisma/clear.ts
 */
import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Clearing all data (keeping admin user)...")

  await prisma.activity.deleteMany()
  await prisma.salaryRecord.deleteMany()
  await prisma.leaveRequest.deleteMany()
  await prisma.attendance.deleteMany()

  // Delete employee users (role = EMPLOYEE) first, then employees
  await prisma.user.deleteMany({ where: { role: "EMPLOYEE" } })
  await prisma.employee.deleteMany()

  const remaining = await prisma.user.findMany()
  console.log(`✅ Done. Remaining users: ${remaining.map(u => u.email).join(", ")}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
