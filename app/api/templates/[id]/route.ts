import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageDelivery } from "@/lib/permissions"

/** Full template for the preview modal's Tasks / Statuses / Stages tabs. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const template = await prisma.projectTemplate.findUnique({
    where: { id },
    include: {
      stages: { orderBy: { orderIndex: "asc" } },
      attributes: { orderBy: { orderIndex: "asc" } },
      tasks: { orderBy: { orderIndex: "asc" } },
    },
  })

  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 })
  return NextResponse.json(template)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || !canManageDelivery(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const template = await prisma.projectTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 })

  // Built-ins are reseeded by the seed script, so deleting one would silently
  // come back. Blocking it keeps the gallery honest about what is removable.
  if (template.isBuiltIn) {
    return NextResponse.json({ error: "Built-in templates cannot be deleted" }, { status: 400 })
  }

  await prisma.projectTemplate.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
