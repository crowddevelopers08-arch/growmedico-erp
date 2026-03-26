import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!
console.log("Connecting to:", connectionString?.slice(0, 50) + "...")

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  const beforeCount = await prisma.employee.count()
  console.log("Employees before:", beforeCount)

  // Delete in dependency order
  const a = await prisma.activity.deleteMany()
  console.log("Deleted activities:", a.count)

  const s = await prisma.salaryRecord.deleteMany()
  console.log("Deleted salary records:", s.count)

  const l = await prisma.leaveRequest.deleteMany()
  console.log("Deleted leave requests:", l.count)

  const at = await prisma.attendance.deleteMany()
  console.log("Deleted attendance:", at.count)

  const u = await prisma.user.deleteMany({ where: { role: "EMPLOYEE" } })
  console.log("Deleted employee users:", u.count)

  const e = await prisma.employee.deleteMany()
  console.log("Deleted employees:", e.count)

  const afterCount = await prisma.employee.count()
  console.log("Employees after:", afterCount)

  const users = await prisma.user.findMany()
  console.log("Remaining users:", users.map((u) => `${u.email} (${u.role})`).join(", "))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
