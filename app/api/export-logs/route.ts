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

      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="security_audit_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      })
    } catch (fileError) {
      console.error("File operation error:", fileError)
      // Return empty CSV with headers
      const headers = "timestamp,username,result,mse,ip,userAgent,reason\n"
      return new NextResponse(headers, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="security_audit_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      })
    }
  } catch (error) {
    console.error("Failed to export logs:", error)
    return NextResponse.json({ error: "Failed to export logs" }, { status: 500 })
  }
}
