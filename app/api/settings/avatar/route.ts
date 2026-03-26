import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get("avatar") as File | null

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image" }, { status: 400 })
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "File must be under 2MB" }, { status: 400 })

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
    const filename = `${session.user.id}.${ext}`
    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars")

    await mkdir(uploadDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, filename), buffer)

    const avatarUrl = `/uploads/avatars/${filename}`

    if (session.user.employeeId) {
      await prisma.employee.update({
        where: { id: session.user.employeeId },
        data: { avatar: avatarUrl },
      })
    }

    return NextResponse.json({ avatarUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to upload"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
