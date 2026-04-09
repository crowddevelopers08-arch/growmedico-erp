import { PrismaClient } from "./generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Use the unpooled (direct) connection because the pooled URL uses
// channel_binding=require, which is not supported by the pg adapter.
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!

type PrismaClientWithRuntimeModel = PrismaClient & {
  _runtimeDataModel?: {
    models?: Record<string, { fields?: Array<{ name?: string }> }>
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function hasModelField(client: PrismaClient | undefined, modelName: string, fieldName: string) {
  const runtimeModel = (client as PrismaClientWithRuntimeModel | undefined)?._runtimeDataModel
  const fields = runtimeModel?.models?.[modelName]?.fields ?? []
  return fields.some((field) => field.name === fieldName)
}

const cached = globalForPrisma.prisma
const needsRefresh =
  !cached ||
  (process.env.NODE_ENV !== "production" && (
    typeof (cached as any).clientProject === "undefined" ||
    !hasModelField(cached, "ClientProject", "dueDate") ||
    !hasModelField(cached, "ClientProject", "priority") ||
    !hasModelField(cached, "ClientProject", "status") ||
    !hasModelField(cached, "ClientProject", "createdById") ||
    !hasModelField(cached, "ClientProject", "members") ||
    !hasModelField(cached, "Task", "assignedByName") ||
    !hasModelField(cached, "Task", "assignedByAvatar")
  ))

export const prisma = needsRefresh
  ? new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    })
  : cached

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
