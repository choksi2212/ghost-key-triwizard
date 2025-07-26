import { NextResponse, type NextRequest } from "next/server"
import { AUTH_CONFIG } from "@/config/auth-config"

export async function GET() {
  return NextResponse.json({
    currentPercentile: AUTH_CONFIG.PERCENTILE_THRESHOLD,
    availablePercentiles: AUTH_CONFIG.PERCENTILE_OPTIONS,
    config: AUTH_CONFIG,
  })
}

export async function POST(request: NextRequest) {
  try {
    const { percentile } = await request.json()

    if (!AUTH_CONFIG.PERCENTILE_OPTIONS.includes(percentile)) {
      return NextResponse.json({ error: "Invalid percentile value" }, { status: 400 })
    }

    // In a real implementation, you would update the config file or database
    // For now, we'll just return the updated config
    return NextResponse.json({
      message: `Percentile threshold updated to ${percentile}%`,
      newPercentile: percentile,
      note: "To permanently change this, update AUTH_CONFIG.PERCENTILE_THRESHOLD in config/auth-config.ts",
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update configuration" }, { status: 500 })
  }
}
