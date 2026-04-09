/**
 * Removes the sample task records created for demo/testing.
 * Run with: npx tsx prisma/remove-sample-tasks.ts
 */
import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

const SAMPLE_TASK_TITLES = [
  "Requirement alignment",
  "Implementation planning",
  "Execution - Phase 1",
  "Execution - Phase 2",
  "Testing and UAT",
  "Go-live readiness",
  "Post-launch follow-up",
]

async function main() {
  const result = await prisma.task.deleteMany({
    where: {
      title: {
        in: SAMPLE_TASK_TITLES,
      },
    },
  })

  console.log(`Removed ${result.count} sample task(s).`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
