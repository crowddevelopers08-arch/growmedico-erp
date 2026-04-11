/**
 * Cleanup script — wipes all data except the admin user.
 * Run with: npx tsx prisma/cleanup.ts
 */
import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@growmedico.com"

  console.log("🔍 Finding admin user...")
  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!adminUser) {
    console.error(`❌ Admin user not found for email: ${adminEmail}`)
    process.exit(1)
  }
  console.log(`✅ Admin found: ${adminEmail}`)

  console.log("\n🗑️  Deleting all data...")

  // Messages and channels
  await prisma.message.deleteMany({})
  console.log("   ✓ Messages deleted")

  await prisma.channel.deleteMany({})
  console.log("   ✓ Channels deleted")

  // Task comments and tasks
  await prisma.taskComment.deleteMany({})
  console.log("   ✓ Task comments deleted")

  await prisma.task.deleteMany({})
  console.log("   ✓ Tasks deleted")

  // Project members and projects
  await prisma.projectMember.deleteMany({})
  console.log("   ✓ Project members deleted")

  await prisma.clientProject.deleteMany({})
  console.log("   ✓ Projects deleted")

  // HR data
  await prisma.salaryRecord.deleteMany({})
  console.log("   ✓ Salary records deleted")

  await prisma.leaveRequest.deleteMany({})
  console.log("   ✓ Leave requests deleted")

  await prisma.attendance.deleteMany({})
  console.log("   ✓ Attendance records deleted")

  await prisma.activity.deleteMany({})
  console.log("   ✓ Activities deleted")

  // Employees and non-admin users
  await prisma.user.deleteMany({
    where: { email: { not: adminEmail } },
  })
  console.log("   ✓ Non-admin users deleted")

  await prisma.employee.deleteMany({})
  console.log("   ✓ Employees deleted")

  console.log("\n✅ Database cleaned. Admin account preserved.")
  console.log(`   Email: ${adminEmail}`)
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
