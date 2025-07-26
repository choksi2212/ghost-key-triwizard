import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { AUTH_CONFIG } from "@/config/auth-config"

export async function GET() {
  try {
    const users = new Set<string>()

    // Get users from keystroke models
    try {
      const modelsDir = path.join(process.cwd(), AUTH_CONFIG.MODELS_DIR)
      const entries = await fs.readdir(modelsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== "." && entry.name !== "..") {
          users.add(entry.name)
        }
      }
    } catch (error) {
      console.log("No keystroke models directory found")
    }

    // Get users from voice models
    try {
      const voiceDir = path.join(process.cwd(), "voice_models")
      const entries = await fs.readdir(voiceDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== "." && entry.name !== "..") {
          users.add(entry.name)
        }
      }
    } catch (error) {
      console.log("No voice models directory found")
    }

    // Get users from authentication logs
    try {
      const logFile = path.join(process.cwd(), "logs", "access_log.csv")
      const content = await fs.readFile(logFile, "utf-8")
      const lines = content.split("\n")

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line) {
          const columns = line.split(",")
          if (columns[1]) {
            users.add(columns[1])
          }
        }
      }
    } catch (error) {
      console.log("No authentication logs found")
    }

    const userList = Array.from(users).sort()

    return NextResponse.json({
      users: userList,
      count: userList.length,
    })
  } catch (error) {
    console.error("Failed to list users:", error)
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 })
  }
}
