// Declare the chrome variable

class BackgroundService {
  constructor() {
    this.init()
  }

  init() {
    // Listen for extension installation
    chrome.runtime.onInstalled.addListener(() => {
      console.log("GhostKey Extension installed")
      this.initializeStorage()
    })

    // Listen for tab updates to auto-enable on login pages
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url) {
        this.checkAutoEnable(tabId, tab.url)
      }
    })

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse)
      return true // Keep message channel open for async responses
    })
  }

  async initializeStorage() {
    const defaultSettings = {
      autoEnable: true,
      voiceAuthEnabled: true,
      privacyMode: false,
      userProfiles: {},
      authConfig: {
        SAMPLES_REQUIRED: 10,
        AUTOENCODER_THRESHOLD: 0.03,
        VOICE_SIMILARITY_THRESHOLD: 0.75,
        NOISE_LEVEL: 0.1,
        AUGMENTATION_FACTOR: 3,
      },
    }

    // Only set defaults if they don't exist
    const existing = await chrome.storage.local.get(Object.keys(defaultSettings))
    const toSet = {}

    for (const [key, value] of Object.entries(defaultSettings)) {
      if (existing[key] === undefined) {
        toSet[key] = value
      }
    }

    if (Object.keys(toSet).length > 0) {
      await chrome.storage.local.set(toSet)
    }
  }

  async checkAutoEnable(tabId, url) {
    try {
      const settings = await chrome.storage.local.get(["autoEnable", "userProfiles"])

      if (!settings.autoEnable || Object.keys(settings.userProfiles || {}).length === 0) {
        return
      }

      // Check if URL looks like a login page
      const loginPatterns = [/login/i, /signin/i, /auth/i, /account/i, /portal/i, /dashboard/i]

      const isLoginPage = loginPatterns.some((pattern) => pattern.test(url))

      if (isLoginPage) {
        // Inject authentication interface
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            window.postMessage(
              {
                type: "GHOSTKEY_AUTO_ENABLE",
                source: "extension",
              },
              "*",
            )
          },
        })
      }
    } catch (error) {
      console.error("Error in auto-enable:", error)
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case "SAVE_USER_PROFILE":
          await this.saveUserProfile(message.data)
          sendResponse({ success: true })
          break

        case "GET_USER_PROFILE":
          const profile = await this.getUserProfile(message.username)
          sendResponse({ success: true, profile })
          break

        case "AUTHENTICATE_USER":
          const authResult = await this.authenticateUser(message.data)
          sendResponse({ success: true, result: authResult })
          break

        case "SAVE_TRAINING_SAMPLE":
          await this.saveTrainingSample(message.data)
          sendResponse({ success: true })
          break

        case "GET_SETTINGS":
          const settings = await chrome.storage.local.get([
            "autoEnable",
            "voiceAuthEnabled",
            "privacyMode",
            "authConfig",
          ])
          sendResponse({ success: true, settings })
          break

        case "LOG_AUTH_ATTEMPT":
          await this.logAuthAttempt(message.data)
          sendResponse({ success: true })
          break

        default:
          sendResponse({ success: false, error: "Unknown message type" })
      }
    } catch (error) {
      console.error("Error handling message:", error)
      sendResponse({ success: false, error: error.message })
    }
  }

  async saveUserProfile(profileData) {
    const { userProfiles } = await chrome.storage.local.get(["userProfiles"])
    const profiles = userProfiles || {}

    profiles[profileData.username] = {
      ...profileData,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    }

    await chrome.storage.local.set({
      userProfiles: profiles,
      currentUser: profileData.username,
    })
  }

  async getUserProfile(username) {
    const { userProfiles } = await chrome.storage.local.get(["userProfiles"])
    return userProfiles?.[username] || null
  }

  async authenticateUser(authData) {
    const profile = await this.getUserProfile(authData.username)

    if (!profile) {
      return {
        success: false,
        authenticated: false,
        reason: "No profile found for user",
      }
    }

    // Use the same authentication logic as the original project
    if (profile.modelType === "autoencoder") {
      return await this.authenticateWithAutoencoder(authData, profile)
    } else {
      return await this.authenticateWithStatistical(authData, profile)
    }
  }

  async authenticateWithAutoencoder(authData, profile) {
    try {
      // Normalize features
      const { min, max } = profile.normalizationParams
      const normalizedFeatures = authData.features.map((value, i) => {
        if (i >= min.length || i >= max.length) return 0
        const range = max[i] - min[i]
        return range === 0 ? 0 : (value - min[i]) / range
      })

      // Simple autoencoder prediction (simplified for extension)
      const autoencoder = profile.autoencoder
      const reconstructed = this.predictAutoencoder(normalizedFeatures, autoencoder)

      // Calculate reconstruction error
      let reconstructionError = 0
      for (let i = 0; i < normalizedFeatures.length; i++) {
        const diff = normalizedFeatures[i] - reconstructed[i]
        reconstructionError += diff * diff
      }
      reconstructionError /= normalizedFeatures.length

      const threshold = profile.threshold
      const success = reconstructionError <= threshold

      return {
        success: true,
        authenticated: success,
        mse: reconstructionError,
        reconstructionError,
        method: "autoencoder",
        reason: success
          ? "Authentication successful"
          : `Reconstruction error too high: ${reconstructionError.toFixed(6)} > ${threshold.toFixed(6)}`,
      }
    } catch (error) {
      return {
        success: false,
        authenticated: false,
        reason: "Autoencoder authentication failed: " + error.message,
      }
    }
  }

  async authenticateWithStatistical(authData, profile) {
    try {
      const { means, stds, mseStats } = profile

      let mse = 0
      for (let i = 0; i < authData.features.length && i < means.length; i++) {
        const normalized = (authData.features[i] - means[i]) / (stds[i] || 1)
        mse += normalized * normalized
      }
      mse = mse / authData.features.length

      const threshold = mseStats?.percentileThreshold || 0.1
      const success = mse <= threshold

      return {
        success: true,
        authenticated: success,
        mse,
        reconstructionError: mse,
        method: "statistical",
        reason: success
          ? "Authentication successful"
          : `MSE (${mse.toFixed(5)}) exceeds threshold (${threshold.toFixed(5)})`,
      }
    } catch (error) {
      return {
        success: false,
        authenticated: false,
        reason: "Statistical authentication failed: " + error.message,
      }
    }
  }

  predictAutoencoder(input, autoencoder) {
    // Simplified autoencoder prediction for the extension
    // This is a basic implementation - the full version would be more complex
    const { weights1, weights2, weights3, biases1, biases2, biases3 } = autoencoder

    // Forward pass through the network (simplified)
    const hidden = new Array(biases1.length)
    for (let i = 0; i < hidden.length; i++) {
      let sum = biases1[i]
      for (let j = 0; j < input.length; j++) {
        sum += input[j] * (weights1[j]?.[i] || 0)
      }
      hidden[i] = Math.max(0, sum) // ReLU
    }

    const bottleneck = new Array(biases2.length)
    for (let i = 0; i < bottleneck.length; i++) {
      let sum = biases2[i]
      for (let j = 0; j < hidden.length; j++) {
        sum += hidden[j] * (weights2[j]?.[i] || 0)
      }
      bottleneck[i] = Math.max(0, sum) // ReLU
    }

    const output = new Array(input.length)
    for (let i = 0; i < output.length; i++) {
      let sum = biases3[i]
      for (let j = 0; j < bottleneck.length; j++) {
        sum += bottleneck[j] * (weights3[j]?.[i] || 0)
      }
      output[i] = 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, sum)))) // Sigmoid
    }

    return output
  }

  async saveTrainingSample(sampleData) {
    const key = `training_${sampleData.username}`
    const existing = await chrome.storage.local.get([key])
    const samples = existing[key] || []

    samples.push({
      ...sampleData,
      timestamp: new Date().toISOString(),
    })

    await chrome.storage.local.set({
      [key]: samples,
      trainingSamples: samples.length,
      trainingUser: sampleData.username,
      trainingInProgress: samples.length < 10,
    })
  }

  async logAuthAttempt(logData) {
    const logs = await chrome.storage.local.get(["authLogs"])
    const authLogs = logs.authLogs || []

    authLogs.push({
      ...logData,
      timestamp: new Date().toISOString(),
    })

    // Keep only last 100 logs
    if (authLogs.length > 100) {
      authLogs.splice(0, authLogs.length - 100)
    }

    await chrome.storage.local.set({ authLogs })
  }
}

// Initialize background service
new BackgroundService()

let keystrokeModelUrl = 'https://yourdomain.com/api/get-keystroke-model';
let voiceModelUrl = 'https://yourdomain.com/api/get-voice-model';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_MODELS') {
    Promise.all([
      fetch(keystrokeModelUrl).then(r => r.json()),
      fetch(voiceModelUrl).then(r => r.json())
    ]).then(([keystrokeModel, voiceModel]) => {
      chrome.storage.local.set({ keystrokeModel, voiceModel }, () => {
        sendResponse({ success: true });
      });
    });
    return true; // async
  }
});
