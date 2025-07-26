import { type NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import type { AggregatedVoiceFeatures } from "@/utils/voice-feature-extractor"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const username = formData.get("username") as string
    const featuresJson = formData.get("features") as string

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    // Parse the extracted features with validation
    let extractedFeatures: AggregatedVoiceFeatures[] = []
    try {
      extractedFeatures = featuresJson ? JSON.parse(featuresJson) : []

      // Validate that we have features
      if (extractedFeatures.length === 0) {
        return NextResponse.json(
          {
            error: "No voice features extracted. Please ensure audio quality is sufficient.",
            success: false,
          },
          { status: 400 },
        )
      }

      // Validate feature structure
      for (const feature of extractedFeatures) {
        if (!feature.mfccMean || !Array.isArray(feature.mfccMean)) {
          return NextResponse.json(
            {
              error: "Invalid voice features detected. Please try recording again.",
              success: false,
            },
            { status: 400 },
          )
        }
      }
    } catch (error) {
      console.error("Failed to parse features:", error)
      return NextResponse.json(
        {
          error: "Failed to process voice features. Please try again.",
          success: false,
        },
        { status: 400 },
      )
    }

    // Create user voice directory
    const voiceDir = path.join(process.cwd(), "voice_models", username)
    await fs.mkdir(voiceDir, { recursive: true })

    // Save voice samples
    const samples = []
    let sampleIndex = 0

    while (formData.get(`sample_${sampleIndex}`)) {
      const sample = formData.get(`sample_${sampleIndex}`) as File
      const samplePath = path.join(voiceDir, `voice_sample_${sampleIndex}.webm`)

      const arrayBuffer = await sample.arrayBuffer()
      await fs.writeFile(samplePath, Buffer.from(arrayBuffer))

      samples.push({
        index: sampleIndex,
        filename: `voice_sample_${sampleIndex}.webm`,
        size: sample.size,
        timestamp: new Date().toISOString(),
      })

      sampleIndex++
    }

    // Create voice profile metadata with extracted features
    const voiceProfile = {
      username,
      samples,
      sampleCount: samples.length,
      passphrase: "I'll Always Choose You",
      createdAt: new Date().toISOString(),
      modelType: "voice_biometric",
      version: "1.0",
      features: extractedFeatures,
      // Calculate average features across all samples for the reference model
      referenceModel: calculateAverageFeatures(extractedFeatures),
    }

    // Save voice profile
    const profilePath = path.join(voiceDir, "voice_profile.json")
    await fs.writeFile(profilePath, JSON.stringify(voiceProfile, null, 2))

    console.log(`Voice profile created for ${username} with ${samples.length} samples and biometric features`)

    return NextResponse.json({
      success: true,
      message: "Voice profile registered successfully with biometric features",
      sampleCount: samples.length,
      featureCount: extractedFeatures.length,
    })
  } catch (error) {
    console.error("Voice registration failed:", error)
    return NextResponse.json({ error: "Voice registration failed" }, { status: 500 })
  }
}

// Helper function to calculate average features across multiple samples
function calculateAverageFeatures(features: AggregatedVoiceFeatures[]): AggregatedVoiceFeatures {
  if (features.length === 0) {
    throw new Error("No features to average")
  }

  // Initialize with the structure of the first feature
  const result: any = {}
  const firstFeature = features[0]

  // For each property in the first feature
  for (const key in firstFeature) {
    if (Array.isArray(firstFeature[key])) {
      // Handle arrays (like MFCC)
      const arrayLength = firstFeature[key].length
      result[key] = new Array(arrayLength).fill(0)

      // Sum all values
      for (const feature of features) {
        for (let i = 0; i < arrayLength; i++) {
          result[key][i] += feature[key][i]
        }
      }

      // Calculate average
      for (let i = 0; i < arrayLength; i++) {
        result[key][i] /= features.length
      }
    } else if (typeof firstFeature[key] === "number") {
      // Handle numeric values
      result[key] = 0

      // Sum all values
      for (const feature of features) {
        result[key] += feature[key]
      }

      // Calculate average
      result[key] /= features.length
    } else {
      // Copy other values as is
      result[key] = firstFeature[key]
    }
  }

  return result as AggregatedVoiceFeatures
}
