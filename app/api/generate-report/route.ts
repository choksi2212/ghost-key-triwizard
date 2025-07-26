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

      // If only headers exist, return empty report
      if (lines.length <= 1) {
        return NextResponse.json({
          totalAttempts: 0,
          successfulAttempts: 0,
          failedAttempts: 0,
          uniqueUsers: 0,
          avgMSE: 0,
          successRate: 0,
          recentActivity: [],
          hourlyStats: Array.from({ length: 24 }, (_, i) => ({ hour: i, attempts: 0 })),
        })
      }

      const logs = lines
        .slice(1)
        .filter((line) => line.trim())
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

      // Generate report statistics
      const totalAttempts = logs.length
      const successfulAttempts = logs.filter((log) => log.result === "Pass").length
      const failedAttempts = logs.filter((log) => log.result === "Fail").length
      const uniqueUsers = new Set(logs.map((log) => log.username)).size
      const validMSEs = logs.filter((log) => log.mse != null).map((log) => log.mse!)
      const avgMSE = validMSEs.length > 0 ? validMSEs.reduce((sum, mse) => sum + mse, 0) / validMSEs.length : 0
      const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0

      // Hourly statistics
      const hourlyStats = Array.from({ length: 24 }, (_, hour) => {
        const hourAttempts = logs.filter((log) => new Date(log.timestamp).getHours() === hour)
        return {
          hour,
          attempts: hourAttempts.length,
          successful: hourAttempts.filter((log) => log.result === "Pass").length,
          failed: hourAttempts.filter((log) => log.result === "Fail").length,
        }
      })

      const report = {
        totalAttempts,
        successfulAttempts,
        failedAttempts,
        uniqueUsers,
        avgMSE,
        successRate,
        recentActivity: logs.slice(0, 10).reverse(),
        hourlyStats,
        generatedAt: new Date().toISOString(),
      }

      return NextResponse.json(report)
    } catch (fileError) {
      console.error("File operation error:", fileError)
      return NextResponse.json({
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        uniqueUsers: 0,
        avgMSE: 0,
        successRate: 0,
        recentActivity: [],
        hourlyStats: Array.from({ length: 24 }, (_, i) => ({ hour: i, attempts: 0 })),
      })
    }
  } catch (error) {
    console.error("Failed to generate report:", error)
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 })
  }
}
