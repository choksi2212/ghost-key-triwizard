import { type NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { type AggregatedVoiceFeatures, calculateRobustSimilarityScore } from "@/utils/voice-feature-extractor"
import { AUTH_CONFIG } from "@/config/auth-config"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const username = formData.get("username") as string
    const voiceSample = formData.get("voice_sample") as File
    const featuresJson = formData.get("features") as string

    if (!username || !voiceSample) {
      return NextResponse.json({ error: "Username and voice sample are required" }, { status: 400 })
    }

    // Parse the extracted features
    const extractedFeatures: AggregatedVoiceFeatures = featuresJson ? JSON.parse(featuresJson) : null

    if (!extractedFeatures) {
      return NextResponse.json({ error: "Voice features are required" }, { status: 400 })
    }

    // Check if voice profile exists
    const voiceDir = path.join(process.cwd(), "voice_models", username)
    const profilePath = path.join(voiceDir, "voice_profile.json")

    try {
      await fs.access(profilePath)
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "No voice profile found for this user",
        },
        { status: 404 },
      )
    }

    // Load voice profile
    const profileData = await fs.readFile(profilePath, "utf-8")
    const voiceProfile = JSON.parse(profileData)

    // Save verification sample for analysis
    const verificationPath = path.join(voiceDir, `verification_${Date.now()}.webm`)
    const arrayBuffer = await voiceSample.arrayBuffer()
    await fs.writeFile(verificationPath, Buffer.from(arrayBuffer))

    // Compare extracted features with the reference model using robust similarity
    const referenceModel = voiceProfile.referenceModel

    // Calculate robust similarity score that handles voice variations
    const similarityResult = calculateRobustSimilarityScore(extractedFeatures, referenceModel)

    // Use configurable threshold
    const SIMILARITY_THRESHOLD = AUTH_CONFIG.VOICE_SIMILARITY_THRESHOLD
    const success = similarityResult.overallSimilarity >= SIMILARITY_THRESHOLD

    // Enhanced logging with robustness metrics
    const verificationLog = {
      timestamp: new Date().toISOString(),
      username,
      success,
      similarityScore: similarityResult.overallSimilarity,
      threshold: SIMILARITY_THRESHOLD,
      sampleSize: voiceSample.size,
      verificationFile: path.basename(verificationPath),
      robustnessMetrics: {
        pitchNormalizedSimilarity: similarityResult.pitchNormalizedSimilarity,
        tempoNormalizedSimilarity: similarityResult.tempoNormalizedSimilarity,
        spectralSimilarity: similarityResult.spectralSimilarity,
        voiceQualitySimilarity: similarityResult.voiceQualitySimilarity,
        confidenceScore: similarityResult.confidenceScore,
      },
      detailedMetrics: {
        mfccDistance: similarityResult.detailedMetrics.mfccDistance,
        spectralCentroidDiff: similarityResult.detailedMetrics.spectralCentroidDiff,
        zcrDiff: similarityResult.detailedMetrics.zcrDiff,
        pitchDiff: similarityResult.detailedMetrics.pitchDiff,
        energyDiff: similarityResult.detailedMetrics.energyDiff,
      },
    }

    const logPath = path.join(voiceDir, "verification_log.jsonl")
    await fs.appendFile(logPath, JSON.stringify(verificationLog) + "\n")

    // Clean up verification file after processing (optional)
    setTimeout(async () => {
      try {
        await fs.unlink(verificationPath)
      } catch (error) {
        console.error("Failed to clean up verification file:", error)
      }
    }, 5000)

    return NextResponse.json({
      success,
      similarityScore: similarityResult.overallSimilarity,
      threshold: SIMILARITY_THRESHOLD,
      message: success ? "Voice authentication successful" : "Voice authentication failed",
      robustnessMetrics: verificationLog.robustnessMetrics,
      detailedMetrics: verificationLog.detailedMetrics,
      confidenceLevel:
        similarityResult.confidenceScore > 0.8 ? "high" : similarityResult.confidenceScore > 0.6 ? "medium" : "low",
    })
  } catch (error) {
    console.error("Voice verification failed:", error)
    return NextResponse.json({ error: "Voice verification failed" }, { status: 500 })
  }
}
