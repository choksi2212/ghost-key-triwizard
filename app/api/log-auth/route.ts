import { type NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, result, mse, reason } = body

    // Get client IP and user agent
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), "logs")
    await fs.mkdir(logsDir, { recursive: true })

    const logFile = path.join(logsDir, "access_log.csv")
    const timestamp = new Date().toISOString()

    // Check if file exists, if not create it with headers
    try {
      await fs.access(logFile)
    } catch {
      const headers = "timestamp,username,result,mse,ip,userAgent,reason\n"
      await fs.writeFile(logFile, headers, "utf-8")
    }

    // Prepare log entry
    const logEntry = `${timestamp},${username},${result},${mse || ""},${ip},"${userAgent}",${reason || ""}\n`

    // Append to log file
    await fs.appendFile(logFile, logEntry, "utf-8")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to log authentication:", error)
    return NextResponse.json({ error: "Failed to log authentication" }, { status: 500 })
  }
}
