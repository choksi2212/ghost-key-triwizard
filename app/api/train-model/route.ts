import { type NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { AUTH_CONFIG } from "@/config/auth-config"

// Helper function to add noise for data augmentation
function addNoise(data: number[], noiseLevel: number = AUTH_CONFIG.NOISE_LEVEL): number[] {
  return data.map((value) => {
    const noise = (Math.random() - 0.5) * 2 * noiseLevel * value
    return Math.max(0, value + noise)
  })
}

// Normalize features to [0, 1] range
function normalizeFeatures(features: number[][]): { normalized: number[][]; min: number[]; max: number[] } {
  const featureCount = features[0].length
  const min = new Array(featureCount).fill(Number.POSITIVE_INFINITY)
  const max = new Array(featureCount).fill(Number.NEGATIVE_INFINITY)

  // Find min and max for each feature
  features.forEach((sample) => {
    sample.forEach((value, i) => {
      min[i] = Math.min(min[i], value)
      max[i] = Math.max(max[i], value)
    })
  })

  // Normalize features
  const normalized = features.map((sample) =>
    sample.map((value, i) => {
      const range = max[i] - min[i]
      return range === 0 ? 0 : (value - min[i]) / range
    }),
  )

  return { normalized, min, max }
}

// Simple autoencoder implementation
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

    // Initialize weights and biases randomly
    this.weights1 = this.initializeWeights(inputSize, hiddenSize)
    this.weights2 = this.initializeWeights(hiddenSize, bottleneckSize)
    this.weights3 = this.initializeWeights(bottleneckSize, inputSize)

    this.biases1 = new Array(hiddenSize).fill(0).map(() => Math.random() * 0.1 - 0.05)
    this.biases2 = new Array(bottleneckSize).fill(0).map(() => Math.random() * 0.1 - 0.05)
    this.biases3 = new Array(inputSize).fill(0).map(() => Math.random() * 0.1 - 0.05)
  }

  private initializeWeights(inputSize: number, outputSize: number): number[][] {
    const weights = []
    const scale = Math.sqrt(2.0 / inputSize) // Xavier initialization
    for (let i = 0; i < inputSize; i++) {
      weights[i] = []
      for (let j = 0; j < outputSize; j++) {
        weights[i][j] = (Math.random() * 2 - 1) * scale
      }
    }
    return weights
  }

  private relu(x: number): number {
    return Math.max(0, x)
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))))
  }

  private forward(input: number[]): { hidden: number[]; bottleneck: number[]; output: number[] } {
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

    return { hidden, bottleneck, output }
  }

  predict(input: number[]): number[] {
    return this.forward(input).output
  }

  train(data: number[][], epochs = 100, learningRate = 0.01): number[] {
    const losses = []

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0

      for (const sample of data) {
        const { hidden, bottleneck, output } = this.forward(sample)

        // Calculate loss (MSE)
        let loss = 0
        for (let i = 0; i < this.inputSize; i++) {
          const error = sample[i] - output[i]
          loss += error * error
        }
        loss /= this.inputSize
        totalLoss += loss

        // Backpropagation (simplified gradient descent)
        this.updateWeights(sample, hidden, bottleneck, output, learningRate)
      }

      const avgLoss = totalLoss / data.length
      losses.push(avgLoss)

      if (epoch % 20 === 0) {
        console.log(`Epoch ${epoch}: Loss = ${avgLoss.toFixed(6)}`)
      }
    }

    return losses
  }

  private updateWeights(
    input: number[],
    hidden: number[],
    bottleneck: number[],
    output: number[],
    learningRate: number,
  ): void {
    // Output layer gradients
    const outputErrors = new Array(this.inputSize)
    for (let i = 0; i < this.inputSize; i++) {
      outputErrors[i] = (input[i] - output[i]) * output[i] * (1 - output[i]) // sigmoid derivative
    }

    // Update weights3 and biases3
    for (let i = 0; i < this.bottleneckSize; i++) {
      for (let j = 0; j < this.inputSize; j++) {
        this.weights3[i][j] += learningRate * outputErrors[j] * bottleneck[i]
      }
    }
    for (let i = 0; i < this.inputSize; i++) {
      this.biases3[i] += learningRate * outputErrors[i]
    }

    // Bottleneck layer gradients
    const bottleneckErrors = new Array(this.bottleneckSize)
    for (let i = 0; i < this.bottleneckSize; i++) {
      let error = 0
      for (let j = 0; j < this.inputSize; j++) {
        error += outputErrors[j] * this.weights3[i][j]
      }
      bottleneckErrors[i] = error * (bottleneck[i] > 0 ? 1 : 0) // ReLU derivative
    }

    // Update weights2 and biases2
    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < this.bottleneckSize; j++) {
        this.weights2[i][j] += learningRate * bottleneckErrors[j] * hidden[i]
      }
    }
    for (let i = 0; i < this.bottleneckSize; i++) {
      this.biases2[i] += learningRate * bottleneckErrors[i]
    }

    // Hidden layer gradients
    const hiddenErrors = new Array(this.hiddenSize)
    for (let i = 0; i < this.hiddenSize; i++) {
      let error = 0
      for (let j = 0; j < this.bottleneckSize; j++) {
        error += bottleneckErrors[j] * this.weights2[i][j]
      }
      hiddenErrors[i] = error * (hidden[i] > 0 ? 1 : 0) // ReLU derivative
    }

    // Update weights1 and biases1
    for (let i = 0; i < this.inputSize; i++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        this.weights1[i][j] += learningRate * hiddenErrors[j] * input[i]
      }
    }
    for (let i = 0; i < this.hiddenSize; i++) {
      this.biases1[i] += learningRate * hiddenErrors[i]
    }
  }

  serialize(): any {
    return {
      weights1: this.weights1,
      weights2: this.weights2,
      weights3: this.weights3,
      biases1: this.biases1,
      biases2: this.biases2,
      biases3: this.biases3,
      inputSize: this.inputSize,
      hiddenSize: this.hiddenSize,
      bottleneckSize: this.bottleneckSize,
    }
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
    const { username, features, holdTimes, ddTimes, udTimes, additionalFeatures, sampleCount, privacyMode, rawData } =
      await request.json()

    // Create user-specific directory structure
    const userDir = path.join(process.cwd(), AUTH_CONFIG.MODELS_DIR, username)
    const samplesDir = path.join(userDir, "samples")
    const rawDataDir = path.join(userDir, "raw_data")

    // Ensure directories exist
    await fs.mkdir(samplesDir, { recursive: true })
    if (!privacyMode) {
      await fs.mkdir(rawDataDir, { recursive: true })
    }

    // Save sample data with detailed features
    const sampleData = {
      sampleId: sampleCount,
      timestamp: new Date().toISOString(),
      features,
      detailedFeatures: {
        holdTimes,
        ddTimes,
        udTimes,
        ...additionalFeatures,
      },
      privacyMode,
    }

    const sampleFile = path.join(samplesDir, `sample_${sampleCount}.json`)
    await fs.writeFile(sampleFile, JSON.stringify(sampleData, null, 2))

    // Save raw keystroke data if not in privacy mode
    if (!privacyMode && rawData) {
      const rawDataFile = path.join(rawDataDir, `raw_${sampleCount}.json`)
      await fs.writeFile(
        rawDataFile,
        JSON.stringify(
          {
            sampleId: sampleCount,
            timestamp: new Date().toISOString(),
            rawKeystrokes: rawData,
          },
          null,
          2,
        ),
      )
    }

    // If we have enough samples, train the autoencoder
    if (sampleCount >= AUTH_CONFIG.SAMPLES_REQUIRED - 1) {
      const samples = []

      // Load all samples
      for (let i = 0; i <= sampleCount; i++) {
        try {
          const samplePath = path.join(samplesDir, `sample_${i}.json`)
          const sampleData = JSON.parse(await fs.readFile(samplePath, "utf-8"))
          samples.push(sampleData.features)
        } catch (error) {
          console.error(`Failed to load sample ${i}:`, error)
        }
      }

      if (samples.length >= AUTH_CONFIG.SAMPLES_REQUIRED) {
        console.log(`Training autoencoder for ${username} with ${samples.length} samples...`)

        // Data augmentation - add noise to create more training samples
        const augmentedSamples = []
        samples.forEach((sample) => {
          augmentedSamples.push(sample) // Original sample

          // Add augmented samples with noise
          for (let i = 0; i < AUTH_CONFIG.AUGMENTATION_FACTOR; i++) {
            augmentedSamples.push(addNoise(sample))
          }
        })

        // Normalize features
        const { normalized, min, max } = normalizeFeatures(augmentedSamples)

        // Create and train autoencoder
        const inputDim = normalized[0].length
        const autoencoder = new SimpleAutoencoder(inputDim, 16, 8)

        console.log("Training autoencoder...")
        const losses = autoencoder.train(normalized, 200, 0.01)

        // Calculate reconstruction errors for original samples
        const originalNormalized = samples.map((sample) =>
          sample.map((value, i) => {
            const range = max[i] - min[i]
            return range === 0 ? 0 : (value - min[i]) / range
          }),
        )

        const reconstructionErrors = []
        for (const sample of originalNormalized) {
          const reconstructed = autoencoder.predict(sample)
          let mse = 0
          for (let i = 0; i < sample.length; i++) {
            const diff = sample[i] - reconstructed[i]
            mse += diff * diff
          }
          mse /= sample.length
          reconstructionErrors.push(mse)
        }

        // Calculate threshold based on training errors
        const sortedErrors = [...reconstructionErrors].sort((a, b) => a - b)
        const percentileIndex = Math.floor(0.95 * sortedErrors.length) // 95th percentile
        const calculatedThreshold = sortedErrors[percentileIndex]

        // Use the configured threshold or calculated one, whichever is higher
        const finalThreshold = Math.max(AUTH_CONFIG.AUTOENCODER_THRESHOLD, calculatedThreshold * 1.2)

        // Create model data - SAVE AS model.json (not autoencoder_model.json)
        const modelData = {
          username,
          modelType: "autoencoder",
          inputDim,
          normalizationParams: { min, max },
          threshold: finalThreshold,
          autoencoder: autoencoder.serialize(),
          trainingStats: {
            samples: samples.length,
            augmentedSamples: augmentedSamples.length,
            reconstructionErrors,
            meanError: reconstructionErrors.reduce((a, b) => a + b, 0) / reconstructionErrors.length,
            maxError: Math.max(...reconstructionErrors),
            minError: Math.min(...reconstructionErrors),
            calculatedThreshold,
            finalThreshold,
            finalLoss: losses[losses.length - 1],
          },
          createdAt: new Date().toISOString(),
        }

        // Save model as model.json (changed from autoencoder_model.json)
        const modelFile = path.join(userDir, "model.json")
        await fs.writeFile(modelFile, JSON.stringify(modelData, null, 2))

        console.log(`Autoencoder trained successfully for ${username}:`, {
          samples: samples.length,
          augmented: augmentedSamples.length,
          threshold: finalThreshold,
          meanReconstructionError: modelData.trainingStats.meanError,
          finalLoss: losses[losses.length - 1],
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Autoencoder training failed:", error)
    return NextResponse.json({ error: "Training failed" }, { status: 500 })
  }
}
