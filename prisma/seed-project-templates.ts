/**
 * Seeds the built-in project templates and backfills projects created before
 * stages/attributes became real rows.
 *
 * Run with: npm run seed:templates
 *
 * Idempotent — every write is an upsert keyed on a natural unique, so re-running
 * refreshes the built-in templates without touching user-created ones.
 */
import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { defaultAttributeRows, FALLBACK_STAGE } from "../lib/project-defaults"

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

interface TemplateSeed {
  name: string
  description: string
  category: string
  tag?: string
  stages: Array<{ name: string; color: string }>
  taskStatuses: Array<{ name: string; color: string; isTerminal?: boolean }>
  tags?: Array<{ name: string; color: string }>
  tasks: Array<{ title: string; stageName: string; priority?: string; estimatedHours?: number; description?: string }>
}

// The statuses the reference flow ships with, reused by most templates.
const RICH_STATUSES = [
  { name: "Idea", color: "#64748b" },
  { name: "In Discussion", color: "#8b5cf6" },
  { name: "Planned", color: "#0ea5e9" },
  { name: "In Progress", color: "#3b82f6" },
  { name: "Review", color: "#eab308" },
  { name: "Blocked", color: "#ef4444" },
  { name: "Completed", color: "#22c55e", isTerminal: true },
]

const TEMPLATES: TemplateSeed[] = [
  {
    name: "Software Delivery",
    description:
      "End-to-end build pipeline, from discovery through launch. Suits product and web development engagements.",
    category: "Engineering",
    tag: "Delivery",
    stages: [
      { name: "Discovery", color: "#8b5cf6" },
      { name: "Planning", color: "#0ea5e9" },
      { name: "Design", color: "#ec4899" },
      { name: "Development", color: "#3b82f6" },
      { name: "Testing", color: "#eab308" },
      { name: "Review & Approval", color: "#f97316" },
      { name: "Launch", color: "#22c55e" },
    ],
    taskStatuses: RICH_STATUSES,
    tags: [
      { name: "frontend", color: "#3b82f6" },
      { name: "backend", color: "#8b5cf6" },
      { name: "bug", color: "#ef4444" },
    ],
    tasks: [
      { title: "Run kickoff call with client", stageName: "Discovery", priority: "high", estimatedHours: 2 },
      { title: "Document requirements and success metrics", stageName: "Discovery", estimatedHours: 6 },
      { title: "Break scope into milestones", stageName: "Planning", estimatedHours: 4 },
      { title: "Produce wireframes", stageName: "Design", estimatedHours: 12 },
      { title: "Sign off on visual design", stageName: "Design", priority: "high", estimatedHours: 3 },
      { title: "Set up repository and environments", stageName: "Development", estimatedHours: 4 },
      { title: "Build core features", stageName: "Development", priority: "high", estimatedHours: 40 },
      { title: "Write and run QA test cases", stageName: "Testing", estimatedHours: 10 },
      { title: "Client UAT and feedback round", stageName: "Review & Approval", estimatedHours: 6 },
      { title: "Deploy to production", stageName: "Launch", priority: "urgent", estimatedHours: 4 },
    ],
  },
  {
    name: "Digital Marketing Retainer",
    description:
      "Monthly marketing delivery across strategy, local listings, paid ads and social. Built for ongoing client retainers.",
    category: "Marketing",
    tag: "Retainer",
    stages: [
      { name: "Strategy", color: "#8b5cf6" },
      { name: "GMB", color: "#0ea5e9" },
      { name: "Ads", color: "#f97316" },
      { name: "Instagram", color: "#ec4899" },
      { name: "Reporting", color: "#22c55e" },
    ],
    taskStatuses: RICH_STATUSES,
    tags: [
      { name: "content", color: "#ec4899" },
      { name: "paid", color: "#f97316" },
      { name: "organic", color: "#22c55e" },
    ],
    tasks: [
      { title: "Audit current performance", stageName: "Strategy", priority: "high", estimatedHours: 6 },
      { title: "Agree monthly content calendar", stageName: "Strategy", estimatedHours: 4 },
      { title: "Optimise Google Business Profile", stageName: "GMB", estimatedHours: 3 },
      { title: "Publish weekly GMB posts", stageName: "GMB", estimatedHours: 2 },
      { title: "Collect and respond to reviews", stageName: "GMB", estimatedHours: 2 },
      { title: "Build ad creatives", stageName: "Ads", priority: "high", estimatedHours: 8 },
      { title: "Launch and monitor campaigns", stageName: "Ads", priority: "high", estimatedHours: 6 },
      { title: "Design Instagram grid for the month", stageName: "Instagram", estimatedHours: 8 },
      { title: "Schedule reels and stories", stageName: "Instagram", estimatedHours: 5 },
      { title: "Send monthly performance report", stageName: "Reporting", priority: "high", estimatedHours: 4 },
    ],
  },
  {
    name: "Client Onboarding",
    description:
      "Everything needed to take a signed client live: paperwork, access, brand assets and the first delivery plan.",
    category: "Operations",
    tag: "Onboarding",
    stages: [
      { name: "Paperwork", color: "#64748b" },
      { name: "Access & Assets", color: "#0ea5e9" },
      { name: "Setup", color: "#3b82f6" },
      { name: "Handover", color: "#22c55e" },
    ],
    taskStatuses: [
      { name: "Not Started", color: "#64748b" },
      { name: "In Progress", color: "#3b82f6" },
      { name: "Waiting on Client", color: "#eab308" },
      { name: "Completed", color: "#22c55e", isTerminal: true },
    ],
    tasks: [
      { title: "Countersign contract and SOW", stageName: "Paperwork", priority: "urgent", estimatedHours: 1 },
      { title: "Raise first invoice", stageName: "Paperwork", priority: "high", estimatedHours: 1 },
      { title: "Collect brand guidelines and logo files", stageName: "Access & Assets", estimatedHours: 2 },
      { title: "Get access to ad and analytics accounts", stageName: "Access & Assets", priority: "high", estimatedHours: 2 },
      { title: "Create shared drive and comms channel", stageName: "Setup", estimatedHours: 1 },
      { title: "Set up reporting dashboard", stageName: "Setup", estimatedHours: 4 },
      { title: "Run kickoff call and confirm plan", stageName: "Handover", priority: "high", estimatedHours: 2 },
    ],
  },
  {
    name: "Content Production",
    description:
      "Editorial pipeline for blogs, video and design work — from brief through to published asset.",
    category: "Creative",
    tag: "Content",
    stages: [
      { name: "Brief", color: "#64748b" },
      { name: "Draft", color: "#3b82f6" },
      { name: "Edit", color: "#eab308" },
      { name: "Approval", color: "#f97316" },
      { name: "Published", color: "#22c55e" },
    ],
    taskStatuses: RICH_STATUSES,
    tags: [
      { name: "blog", color: "#3b82f6" },
      { name: "video", color: "#ec4899" },
      { name: "design", color: "#8b5cf6" },
    ],
    tasks: [
      { title: "Write content brief", stageName: "Brief", estimatedHours: 2 },
      { title: "Keyword and topic research", stageName: "Brief", estimatedHours: 3 },
      { title: "Produce first draft", stageName: "Draft", priority: "high", estimatedHours: 8 },
      { title: "Copy edit and fact check", stageName: "Edit", estimatedHours: 4 },
      { title: "Design supporting visuals", stageName: "Edit", estimatedHours: 6 },
      { title: "Client review round", stageName: "Approval", estimatedHours: 2 },
      { title: "Publish and distribute", stageName: "Published", priority: "high", estimatedHours: 2 },
    ],
  },
]

async function seedTemplates() {
  for (const seed of TEMPLATES) {
    const template = await prisma.projectTemplate.upsert({
      where: { name: seed.name },
      update: {
        description: seed.description,
        category: seed.category,
        tag: seed.tag ?? null,
        isBuiltIn: true,
      },
      create: {
        name: seed.name,
        description: seed.description,
        category: seed.category,
        tag: seed.tag ?? null,
        isBuiltIn: true,
      },
    })

    // Replace the children wholesale so edits to this file are what ships.
    await prisma.templateStage.deleteMany({ where: { templateId: template.id } })
    await prisma.templateAttribute.deleteMany({ where: { templateId: template.id } })
    await prisma.templateTask.deleteMany({ where: { templateId: template.id } })

    await prisma.templateStage.createMany({
      data: seed.stages.map((stage, index) => ({
        templateId: template.id,
        name: stage.name,
        color: stage.color,
        orderIndex: index,
      })),
    })

    const attributes = [
      ...seed.taskStatuses.map((status, index) => ({
        templateId: template.id,
        scope: "task",
        kind: "status",
        name: status.name,
        color: status.color,
        orderIndex: index,
        isTerminal: status.isTerminal ?? false,
      })),
      ...(seed.tags ?? []).map((tag, index) => ({
        templateId: template.id,
        scope: "task",
        kind: "tag",
        name: tag.name,
        color: tag.color,
        orderIndex: index,
        isTerminal: false,
      })),
    ]
    if (attributes.length) await prisma.templateAttribute.createMany({ data: attributes })

    await prisma.templateTask.createMany({
      data: seed.tasks.map((task, index) => ({
        templateId: template.id,
        title: task.title,
        description: task.description ?? null,
        priority: task.priority ?? "medium",
        stageName: task.stageName,
        statusName: seed.taskStatuses[0]?.name ?? null,
        estimatedHours: task.estimatedHours ?? null,
        orderIndex: index,
      })),
    })

    console.log(
      `Template "${seed.name}": ${seed.stages.length} stages, ${attributes.length} attributes, ${seed.tasks.length} tasks`
    )
  }
}

/**
 * Projects created before this feature have stage names in the legacy string
 * array and no attribute rows. Give them both so every project renders the same
 * way, without changing any task.
 */
async function backfillProjects() {
  const projects = await prisma.clientProject.findMany({
    select: { id: true, name: true, stages: true },
  })

  for (const project of projects) {
    const existingStages = await prisma.projectStage.count({ where: { projectId: project.id } })
    if (existingStages === 0) {
      const names = project.stages.length ? project.stages : [FALLBACK_STAGE]
      await prisma.projectStage.createMany({
        data: names.map((name, index) => ({
          projectId: project.id,
          name,
          color: "#64748b",
          orderIndex: index,
        })),
        skipDuplicates: true,
      })
    }

    const existingAttributes = await prisma.projectAttribute.count({ where: { projectId: project.id } })
    if (existingAttributes === 0) {
      await prisma.projectAttribute.createMany({
        data: defaultAttributeRows().map((row) => ({
          projectId: project.id,
          scope: row.scope,
          kind: row.kind,
          name: row.name,
          color: row.color,
          orderIndex: row.orderIndex,
          isTerminal: row.isTerminal ?? false,
        })),
        skipDuplicates: true,
      })
    }
  }

  console.log(`Backfilled ${projects.length} existing project(s)`)
}

async function main() {
  await seedTemplates()
  await backfillProjects()
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
