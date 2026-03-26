import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  const deleted = await prisma.user.deleteMany({
    where: { email: { not: "admin@growmedico.com" }, role: "ADMIN" },
  })
  console.log(`Deleted ${deleted.count} old admin user(s)`)

  const remaining = await prisma.user.findMany()
  console.log("Remaining users:", remaining.map((u) => `${u.email} (${u.role})`).join(", "))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
