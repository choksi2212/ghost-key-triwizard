// Keystroke analysis utilities for the extension
class KeystrokeAnalyzer {
  constructor() {
    this.PASSWORD_LENGTH = 19 // For "MySecretPassword123"
  }

  extractFeatures(keystrokeData) {
    const keydowns = keystrokeData.filter((k) => k.type === "keydown")
    const keyups = keystrokeData.filter((k) => k.type === "keyup")

    const matchedKeys = keydowns.map((k) => [k.key, k.timestamp])
    const holdTimes = []
    const ddTimes = []
    const udTimes = []

    // Calculate hold times (key press to key release)
    matchedKeys.forEach(([key, downTs]) => {
      const upEvent = keyups.find((u) => u.key === key && u.timestamp > downTs)
      if (upEvent) {
        holdTimes.push(upEvent.timestamp - downTs)
      }
    })

    // Calculate dwell times (down-down times between consecutive key presses)
    for (let i = 0; i < matchedKeys.length - 1; i++) {
      const press1 = matchedKeys[i][1]
      const press2 = matchedKeys[i + 1][1]
      ddTimes.push(press2 - press1)
    }

    // Calculate flight times (up-down times)
    for (let i = 0; i < matchedKeys.length - 1; i++) {
      const currentKey = matchedKeys[i][0]
      const currentDown = matchedKeys[i][1]
      const nextDown = matchedKeys[i + 1][1]

      const currentUp = keyups.find((u) => u.key === currentKey && u.timestamp > currentDown)
      if (currentUp) {
        udTimes.push(nextDown - currentUp.timestamp)
      } else {
        udTimes.push(nextDown - currentDown)
      }
    }

    // Calculate additional features
    const totalTime =
      Math.max(
        holdTimes.reduce((sum, t) => sum + t, 0),
        ddTimes.reduce((sum, t) => sum + t, 0),
        udTimes.reduce((sum, t) => sum + t, 0),
      ) || 0.001

    const typingSpeed = matchedKeys.length / (totalTime / 1000)
    const flightTime = udTimes.length > 0 ? udTimes.reduce((a, b) => a + b, 0) / udTimes.length : 0
    const errorRate = keystrokeData.filter((k) => k.key === "Backspace").length

    const meanHoldTime = holdTimes.length > 0 ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length : 0
    const pressPressure =
      holdTimes.length > 0
        ? Math.sqrt(holdTimes.reduce((sum, t) => sum + Math.pow(t - meanHoldTime, 2), 0) / holdTimes.length)
        : 0

    // Create feature vector
    const featureVector = [
      ...holdTimes.slice(0, this.PASSWORD_LENGTH),
      ...ddTimes.slice(0, this.PASSWORD_LENGTH - 1),
      ...udTimes.slice(0, this.PASSWORD_LENGTH - 1),
      typingSpeed,
      flightTime,
      errorRate,
      pressPressure,
    ]

    // Pad with zeros if needed
    while (featureVector.length < this.PASSWORD_LENGTH * 3 + 1) {
      featureVector.push(0)
    }

    return {
      holdTimes,
      ddTimes,
      udTimes,
      typingSpeed,
      flightTime,
      errorRate,
      pressPressure,
      features: featureVector,
    }
  }

  // Simple autoencoder implementation for training
  trainAutoencoder(samples, options = {}) {
    const {
      hiddenSize = 16,
      bottleneckSize = 8,
      epochs = 100,
      learningRate = 0.01,
      noiseLevel = 0.1,
      augmentationFactor = 3,
    } = options

    // Data augmentation
    const augmentedSamples = []
    samples.forEach((sample) => {
      augmentedSamples.push(sample)

      // Add noisy versions
      for (let i = 0; i < augmentationFactor; i++) {
        const noisySample = sample.map((value) => {
          const noise = (Math.random() - 0.5) * 2 * noiseLevel * value
          return Math.max(0, value + noise)
        })
        augmentedSamples.push(noisySample)
      }
    })

    // Normalize features
    const normalized = this.normalizeFeatures(augmentedSamples)

    // Create and train autoencoder
    const autoencoder = new SimpleAutoencoder(normalized.normalized[0].length, hiddenSize, bottleneckSize)

    const losses = autoencoder.train(normalized.normalized, epochs, learningRate)

    // Calculate threshold based on original samples
    const originalNormalized = samples.map((sample) =>
      sample.map((value, i) => {
        const range = normalized.max[i] - normalized.min[i]
        return range === 0 ? 0 : (value - normalized.min[i]) / range
      }),
    )

    const reconstructionErrors = originalNormalized.map((sample) => {
      const reconstructed = autoencoder.predict(sample)
      let mse = 0
      for (let i = 0; i < sample.length; i++) {
        const diff = sample[i] - reconstructed[i]
        mse += diff * diff
      }
      return mse / sample.length
    })

    const sortedErrors = [...reconstructionErrors].sort((a, b) => a - b)
    const percentileIndex = Math.floor(0.95 * sortedErrors.length)
    const calculatedThreshold = sortedErrors[percentileIndex]
    const finalThreshold = Math.max(0.03, calculatedThreshold * 1.2)

    return {
      autoencoder: autoencoder.serialize(),
      normalizationParams: {
        min: normalized.min,
        max: normalized.max,
      },
      threshold: finalThreshold,
      trainingStats: {
        samples: samples.length,
        augmentedSamples: augmentedSamples.length,
        reconstructionErrors,
        meanError: reconstructionErrors.reduce((a, b) => a + b, 0) / reconstructionErrors.length,
        maxError: Math.max(...reconstructionErrors),
        minError: Math.min(...reconstructionErrors),
        finalLoss: losses[losses.length - 1],
      },
    }
  }

  normalizeFeatures(features) {
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
}

// Simple autoencoder implementation
class SimpleAutoencoder {
  constructor(inputSize, hiddenSize = 16, bottleneckSize = 8) {
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

  initializeWeights(inputSize, outputSize) {
    const weights = []
    const scale = Math.sqrt(2.0 / inputSize)
    for (let i = 0; i < inputSize; i++) {
      weights[i] = []
      for (let j = 0; j < outputSize; j++) {
        weights[i][j] = (Math.random() * 2 - 1) * scale
      }
    }
    return weights
  }

  relu(x) {
    return Math.max(0, x)
  }

  sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))))
  }

  predict(input) {
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

  train(data, epochs = 100, learningRate = 0.01) {
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

        // Backpropagation
        this.updateWeights(sample, hidden, bottleneck, output, learningRate)
      }

      const avgLoss = totalLoss / data.length
      losses.push(avgLoss)
    }

    return losses
  }

  forward(input) {
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

  updateWeights(input, hidden, bottleneck, output, learningRate) {
    // Simplified backpropagation
    const outputErrors = new Array(this.inputSize)
    for (let i = 0; i < this.inputSize; i++) {
      outputErrors[i] = (input[i] - output[i]) * output[i] * (1 - output[i])
    }

    // Update weights and biases (simplified)
    for (let i = 0; i < this.bottleneckSize; i++) {
      for (let j = 0; j < this.inputSize; j++) {
        this.weights3[i][j] += learningRate * outputErrors[j] * bottleneck[i]
      }
    }

    for (let i = 0; i < this.inputSize; i++) {
      this.biases3[i] += learningRate * outputErrors[i]
    }
  }

  serialize() {
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
}

// Export for use in other parts of the extension
if (typeof module !== "undefined" && module.exports) {
  module.exports = { KeystrokeAnalyzer, SimpleAutoencoder }
}
