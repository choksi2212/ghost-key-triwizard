import { type NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { AUTH_CONFIG } from "@/config/auth-config"

export async function POST(request: NextRequest) {
  try {
    const { username, adminPassword } = await request.json()

    // Verify admin password
    if (adminPassword !== "admin123") {
      return NextResponse.json({ error: "Invalid admin credentials" }, { status: 403 })
    }

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    console.log(`🗑️ Starting complete data deletion for user: ${username}`)

    const deletionResults = {
      keystrokeModels: false,
      voiceModels: false,
      authLogs: false,
      errors: [] as string[],
    }

    // 1. Delete keystroke authentication models and data
    try {
      const userDir = path.join(process.cwd(), AUTH_CONFIG.MODELS_DIR, username)
      await fs.access(userDir)
      await fs.rm(userDir, { recursive: true, force: true })
      deletionResults.keystrokeModels = true
      console.log(`✅ Deleted keystroke models for ${username}`)
    } catch (error) {
      console.log(`ℹ️ No keystroke models found for ${username}`)
    }

    // 2. Delete voice authentication models and data
    try {
      const voiceDir = path.join(process.cwd(), "voice_models", username)
      await fs.access(voiceDir)
      await fs.rm(voiceDir, { recursive: true, force: true })
      deletionResults.voiceModels = true
      console.log(`✅ Deleted voice models for ${username}`)
    } catch (error) {
      console.log(`ℹ️ No voice models found for ${username}`)
    }

    // 3. Remove user entries from authentication logs
    try {
      const logFile = path.join(process.cwd(), "logs", "access_log.csv")

      try {
        const content = await fs.readFile(logFile, "utf-8")
        const lines = content.split("\n")
        const header = lines[0]

        // Filter out lines that contain the username
        const filteredLines = lines.filter((line, index) => {
          if (index === 0) return true // Keep header
          if (!line.trim()) return false // Remove empty lines
          const columns = line.split(",")
          return columns[1] !== username // Remove if username matches
        })

        // Write back the filtered content
        const newContent = filteredLines.join("\n")
        await fs.writeFile(logFile, newContent, "utf-8")
        deletionResults.authLogs = true
        console.log(`✅ Removed ${username} entries from authentication logs`)
      } catch (error) {
        console.log(`ℹ️ No authentication logs found or error processing logs`)
      }
    } catch (error) {
      deletionResults.errors.push(`Failed to clean authentication logs: ${error}`)
    }

    // 4. Clean up summary metrics if they exist
    try {
      const summaryFile = path.join(process.cwd(), AUTH_CONFIG.MODELS_DIR, "summary_metrics.csv")

      try {
        const content = await fs.readFile(summaryFile, "utf-8")
        const lines = content.split("\n")
        const header = lines[0]

        // Filter out lines that start with the username
        const filteredLines = lines.filter((line, index) => {
          if (index === 0) return true // Keep header
          if (!line.trim()) return false // Remove empty lines
          return !line.startsWith(username + ",")
        })

        const newContent = filteredLines.join("\n")
        await fs.writeFile(summaryFile, newContent, "utf-8")
        console.log(`✅ Removed ${username} from summary metrics`)
      } catch (error) {
        console.log(`ℹ️ No summary metrics found`)
      }
    } catch (error) {
      deletionResults.errors.push(`Failed to clean summary metrics: ${error}`)
    }

    // 5. Clean up any additional user-specific files
    try {
      // Check for any other user-specific directories or files
      const additionalPaths = [
        path.join(process.cwd(), "user_data", username),
        path.join(process.cwd(), "temp", username),
        path.join(process.cwd(), "exports", username),
      ]

      for (const additionalPath of additionalPaths) {
        try {
          await fs.access(additionalPath)
          await fs.rm(additionalPath, { recursive: true, force: true })
          console.log(`✅ Deleted additional data at ${additionalPath}`)
        } catch (error) {
          // Path doesn't exist, which is fine
        }
      }
    } catch (error) {
      deletionResults.errors.push(`Failed to clean additional data: ${error}`)
    }

    const success = deletionResults.keystrokeModels || deletionResults.voiceModels || deletionResults.authLogs

    console.log(`🏁 Data deletion completed for ${username}:`, deletionResults)

    return NextResponse.json({
      success,
      message: success ? `Successfully deleted all data for user: ${username}` : `No data found for user: ${username}`,
      deletionResults,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Failed to delete user data:", error)
    return NextResponse.json(
      {
        error: "Failed to delete user data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
