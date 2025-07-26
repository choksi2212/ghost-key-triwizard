import { type NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { AUTH_CONFIG } from "@/config/auth-config"

// Simple autoencoder class for prediction
class SimpleAutoencoder {
  private weights1: number[][]
  private weights2: number[][]
  private weights3: number[][]
  private biases1: number[]
  private biases2: number[]
  private biases3: number[]
  private inputSize: number
  private hiddenSize: number
  private bottleneckSize: number

  constructor(inputSize: number, hiddenSize = 16, bottleneckSize = 8) {
    this.inputSize = inputSize
    this.hiddenSize = hiddenSize
    this.bottleneckSize = bottleneckSize
  }

  private relu(x: number): number {
    return Math.max(0, x)
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))))
  }

  predict(input: number[]): number[] {
    // Input to hidden layer
    const hidden = new Array(this.hiddenSize)
    for (let i = 0; i < this.hiddenSize; i++) {
      let sum = this.biases1[i]
      for (let j = 0; j < this.inputSize; j++) {
        sum += input[j] * this.weights1[j][i]
      }
      hidden[i] = this.relu(sum)
    }

    // Hidden to bottleneck layer
    const bottleneck = new Array(this.bottleneckSize)
    for (let i = 0; i < this.bottleneckSize; i++) {
      let sum = this.biases2[i]
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += hidden[j] * this.weights2[j][i]
      }
      bottleneck[i] = this.relu(sum)
    }

    // Bottleneck to output layer
    const output = new Array(this.inputSize)
    for (let i = 0; i < this.inputSize; i++) {
      let sum = this.biases3[i]
      for (let j = 0; j < this.bottleneckSize; j++) {
        sum += bottleneck[j] * this.weights3[j][i]
      }
      output[i] = this.sigmoid(sum)
    }

    return output
  }

  static deserialize(data: any): SimpleAutoencoder {
    const autoencoder = new SimpleAutoencoder(data.inputSize, data.hiddenSize, data.bottleneckSize)
    autoencoder.weights1 = data.weights1
    autoencoder.weights2 = data.weights2
    autoencoder.weights3 = data.weights3
    autoencoder.biases1 = data.biases1
    autoencoder.biases2 = data.biases2
    autoencoder.biases3 = data.biases3
    return autoencoder
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json()
    console.log("Authentication request received for:", body.username)

    // Extract username and password
    const { username, password } = body

    if (!username) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          mse: 0,
          reconstructionError: 0,
          reason: "Username is required",
        },
        { status: 400 },
      )
    }

    const userDir = path.join(process.cwd(), AUTH_CONFIG.MODELS_DIR, username)
    const modelFile = path.join(userDir, "model.json")

    try {
      const modelData = JSON.parse(await fs.readFile(modelFile, "utf-8"))
      console.log("Model loaded for user:", username, "Model type:", modelData.modelType || "statistical")

      // Extract features from the request body
      let features = []

      if (body.features && Array.isArray(body.features)) {
        features = body.features
      } else if (body.features && body.features.features && Array.isArray(body.features.features)) {
        features = body.features.features
      } else if (body.extractedFeatures && Array.isArray(body.extractedFeatures)) {
        features = body.extractedFeatures
      } else if (
        body.extractedFeatures &&
        body.extractedFeatures.features &&
        Array.isArray(body.extractedFeatures.features)
      ) {
        features = body.extractedFeatures.features
      }

      // If we still don't have features, try to build them from components
      if (features.length === 0) {
        const holdTimes = body.holdTimes || []
        const ddTimes = body.ddTimes || []
        const udTimes = body.udTimes || []
        const typingSpeed = body.typingSpeed || 0
        const flightTime = body.flightTime || 0
        const errorRate = body.errorRate || 0
        const pressPressure = body.pressPressure || 0

        // Build feature vector similar to the one in useKeystrokeAnalyzer
        const PASSWORD_LENGTH = 11
        features = [
          ...holdTimes.slice(0, PASSWORD_LENGTH),
          ...ddTimes.slice(0, PASSWORD_LENGTH - 1),
          ...udTimes.slice(0, PASSWORD_LENGTH - 1),
          typingSpeed,
          flightTime,
          errorRate,
          pressPressure,
        ]

        // Pad with zeros if needed
        while (features.length < PASSWORD_LENGTH * 3 + 1) {
          features.push(0)
        }
      }

      console.log("Using features array of length:", features.length)

      // Check if this is an autoencoder model or statistical model
      if (modelData.modelType === "autoencoder" && modelData.autoencoder) {
        console.log("Using autoencoder authentication")

        // Normalize the input features using saved parameters
        const { min, max } = modelData.normalizationParams
        const normalizedFeatures = features.map((value: number, i: number) => {
          if (i >= min.length || i >= max.length) {
            return 0 // Pad with zeros if features array is longer than training data
          }
          const range = max[i] - min[i]
          return range === 0 ? 0 : (value - min[i]) / range
        })

        // Load the autoencoder
        const autoencoder = SimpleAutoencoder.deserialize(modelData.autoencoder)

        // Get reconstruction
        const reconstructed = autoencoder.predict(normalizedFeatures)

        // Calculate reconstruction error (MSE)
        let reconstructionError = 0
        for (let i = 0; i < normalizedFeatures.length; i++) {
          const diff = normalizedFeatures[i] - reconstructed[i]
          reconstructionError += diff * diff
        }
        reconstructionError /= normalizedFeatures.length

        // Check against threshold
        const threshold = modelData.threshold
        const success = reconstructionError <= threshold

        // Calculate confidence score
        const maxError = modelData.trainingStats?.maxError || threshold * 2
        const confidence = Math.max(0, Math.min(1, 1 - reconstructionError / (maxError * 2)))

        // Create deviations for heatmap (use normalized features)
        const deviations = normalizedFeatures.slice(0, 10).map((val) => Math.min(Math.abs(val), 1))

        console.log(`Autoencoder authentication for ${username}:`, {
          reconstructionError: reconstructionError.toFixed(6),
          threshold: threshold.toFixed(6),
          authenticated: success,
          confidence: confidence.toFixed(3),
        })

        // Log authentication attempt
        try {
          await fetch(`${request.nextUrl.origin}/api/log-auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              timestamp: new Date().toISOString(),
              username,
              result: success ? "Pass" : "Fail",
              mse: reconstructionError,
              ip: request.headers.get("x-forwarded-for") || "localhost",
              userAgent: request.headers.get("user-agent") || "Unknown",
            }),
          })
        } catch (logError) {
          console.error("Failed to log authentication:", logError)
        }

        return NextResponse.json({
          success,
          authenticated: success,
          mse: reconstructionError,
          reconstructionError,
          deviations,
          confidence,
          reason: success
            ? "Authentication successful"
            : `Reconstruction error too high: ${reconstructionError.toFixed(6)} > ${threshold.toFixed(6)}`,
          method: "autoencoder",
        })
      } else {
        console.log("Using statistical authentication")

        // Statistical model authentication (original method)
        if (!modelData.means || !modelData.stds) {
          throw new Error("Statistical model data is incomplete")
        }

        // Calculate MSE using the same normalization as training
        let mse = 0
        const deviations = []

        for (let i = 0; i < features.length && i < modelData.means.length; i++) {
          const normalized = (features[i] - modelData.means[i]) / (modelData.stds[i] || 1)
          const deviation = Math.abs(normalized)
          deviations.push(Math.min(deviation, 1)) // Cap at 1 for visualization
          mse += normalized * normalized
        }

        mse = mse / features.length

        // Use percentile-based authentication
        const percentileThreshold = modelData.mseStats?.percentileThreshold || 0.1
        const success = mse <= percentileThreshold

        let reason = ""
        if (!success) {
          const percentileUsed = modelData.mseStats?.percentileUsed || AUTH_CONFIG.PERCENTILE_THRESHOLD
          reason = `MSE (${mse.toFixed(5)}) exceeds ${percentileUsed}th percentile threshold (${percentileThreshold.toFixed(5)})`
        }

        console.log(`Statistical authentication for ${username}:`, {
          mse: mse.toFixed(6),
          threshold: percentileThreshold.toFixed(6),
          authenticated: success,
        })

        // Log authentication attempt
        try {
          await fetch(`${request.nextUrl.origin}/api/log-auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              timestamp: new Date().toISOString(),
              username,
              result: success ? "Pass" : "Fail",
              mse,
              ip: request.headers.get("x-forwarded-for") || "localhost",
              userAgent: request.headers.get("user-agent") || "Unknown",
            }),
          })
        } catch (logError) {
          console.error("Failed to log authentication:", logError)
        }

        return NextResponse.json({
          success,
          authenticated: success,
          mse,
          reconstructionError: mse,
          deviations,
          reason: success ? "Authentication successful" : reason,
          method: "statistical",
          thresholds: {
            percentileThreshold,
            percentileUsed: modelData.mseStats?.percentileUsed || AUTH_CONFIG.PERCENTILE_THRESHOLD,
          },
        })
      }
    } catch (error) {
      console.error("Authentication error:", error)
      return NextResponse.json({
        success: false,
        authenticated: false,
        mse: 0,
        reconstructionError: 0,
        deviations: [],
        reason: `No model found for user ${username}. Please register first.`,
      })
    }
  } catch (error) {
    console.error("Authentication failed:", error)
    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        mse: 0,
        reconstructionError: 0,
        deviations: [],
        reason: "Authentication system error",
      },
      { status: 500 },
    )
  }
}
