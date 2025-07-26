import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

export async function GET() {
  try {
    const logFile = path.join(process.cwd(), "logs", "access_log.csv")

    try {
      // Ensure logs directory exists
      const logsDir = path.join(process.cwd(), "logs")
      await fs.mkdir(logsDir, { recursive: true })

      // Check if file exists, if not create it with headers
      try {
        await fs.access(logFile)
      } catch {
        const headers = "timestamp,username,result,mse,ip,userAgent,reason\n"
        await fs.writeFile(logFile, headers, "utf-8")
      }

      const content = await fs.readFile(logFile, "utf-8")
      const lines = content.trim().split("\n")

      // If only headers exist, return empty array
      if (lines.length <= 1) {
        return NextResponse.json([])
      }

      const logs = lines
        .slice(1)
        .filter((line) => line.trim()) // Filter out empty lines
        .map((line) => {
          const values = line.split(",")
          return {
            timestamp: values[0] || new Date().toISOString(),
            username: values[1] || "unknown",
            result: (values[2] as "Pass" | "Fail") || "Fail",
            mse: values[3] ? Number.parseFloat(values[3]) : null,
            ip: values[4] || "unknown",
            userAgent: values[5]?.replace(/"/g, "") || "unknown",
            reason: values[6] || "",
          }
        })
        .reverse() // Most recent first

      return NextResponse.json(logs)
    } catch (fileError) {
      console.error("File operation error:", fileError)
      return NextResponse.json([])
    }
  } catch (error) {
    console.error("Failed to fetch logs:", error)
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 })
  }
}
