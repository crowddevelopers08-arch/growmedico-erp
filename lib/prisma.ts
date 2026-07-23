import { PrismaClient } from "./generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Use the unpooled (direct) connection because the pooled URL uses
// channel_binding=require, which is not supported by the pg adapter.
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!

const isDev = process.env.NODE_ENV !== "production"

type PrismaClientWithRuntimeModel = PrismaClient & {
  _runtimeDataModel?: {
    models?: Record<string, { fields?: Array<{ name?: string }> }>
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })
}

/**
 * A cheap signature of every model + field name the client knows about.
 * Comparing signatures detects *any* schema change generically, so we no longer
 * have to hand-maintain a list of newly added fields here — forgetting to do so
 * silently kept a stale client alive across hot-reloads and made new columns
 * fail with "Unknown argument".
 */
function datamodelSignature(client: PrismaClient | undefined): string {
  const models = (client as PrismaClientWithRuntimeModel | undefined)?._runtimeDataModel?.models ?? {}
  return Object.entries(models)
    .map(([model, def]) => `${model}:${(def.fields ?? []).map((f) => f.name).join(",")}`)
    .sort()
    .join("|")
}

function resolveClient(): PrismaClient {
  // Production evaluates this module once; no invalidation needed.
  if (!isDev) return globalForPrisma.prisma ?? createClient()

  const cached = globalForPrisma.prisma
  if (!cached) return createClient()

  // Building a client is cheap and does not open a connection (the pg pool is
  // lazy), so we can create one to compare schemas and discard the loser.
  const candidate = createClient()
  if (datamodelSignature(cached) === datamodelSignature(candidate)) {
    void candidate.$disconnect().catch(() => {})
    return cached
  }

  void cached.$disconnect().catch(() => {})
  return candidate
}

export const prisma = resolveClient()

if (isDev) globalForPrisma.prisma = prisma
