import { PrismaClient } from "./generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Use the unpooled (direct) connection — the pooled URL uses channel_binding=require
// which is not supported by the pg adapter. Prisma manages its own connection pool.
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
