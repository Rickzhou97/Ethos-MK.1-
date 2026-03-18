import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { tasks } = body as { tasks: { id: string; queuePosition: number }[] }

  if (!tasks || !Array.isArray(tasks)) {
    return NextResponse.json(
      { error: "tasks array is required" },
      { status: 400 }
    )
  }

  await prisma.$transaction(
    tasks.map((t) =>
      prisma.installationTask.update({
        where: { id: t.id },
        data: { queuePosition: t.queuePosition },
      })
    )
  )

  revalidatePath("/installation")
  revalidatePath("/installation/dashboard")

  return NextResponse.json({ success: true, updated: tasks.length })
}
