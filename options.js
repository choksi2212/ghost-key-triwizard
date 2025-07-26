// Declare the chrome variable to fix the lint/correctness/noUndeclaredVariables error
const chrome = window.chrome

class OptionsManager {
  constructor() {
    this.init()
  }

  async init() {
    await this.loadSettings()
    await this.loadStatistics()
    this.bindEvents()
  }

  async loadSettings() {
    const settings = await chrome.storage.local.get([
      "autoEnable",
      "voiceAuthEnabled",
      "privacyMode",
      "debugMode",
      "authConfig",
    ])

    // Load general settings
    document.getElementById("autoEnable").checked = settings.autoEnable !== false
    document.getElementById("voiceAuthEnabled").checked = settings.voiceAuthEnabled !== false
    document.getElementById("privacyMode").checked = settings.privacyMode === true
    document.getElementById("debugMode").checked = settings.debugMode === true

    // Load auth config
    const config = settings.authConfig || {}

    const autoencoderThreshold = config.AUTOENCODER_THRESHOLD || 0.03
    document.getElementById("autoencoderThreshold").value = autoencoderThreshold
    document.getElementById("autoencoderValue").textContent = autoencoderThreshold

    const voiceThreshold = config.VOICE_SIMILARITY_THRESHOLD || 0.75
    document.getElementById("voiceThreshold").value = voiceThreshold
    document.getElementById("voiceValue").textContent = voiceThreshold

    const samplesRequired = config.SAMPLES_REQUIRED || 10
    document.getElementById("samplesRequired").value = samplesRequired
    document.getElementById("samplesValue").textContent = samplesRequired

    const noiseLevel = config.NOISE_LEVEL || 0.1
    document.getElementById("noiseLevel").value = noiseLevel
    document.getElementById("noiseValue").textContent = noiseLevel

    const augmentationFactor = config.AUGMENTATION_FACTOR || 3
    document.getElementById("augmentationFactor").value = augmentationFactor
    document.getElementById("augmentationValue").textContent = augmentationFactor
  }

  async loadStatistics() {
    const data = await chrome.storage.local.get(["userProfiles", "authLogs"])

    const userProfiles = data.userProfiles || {}
    const authLogs = data.authLogs || []

    // Total users
    document.getElementById("totalUsers").textContent = Object.keys(userProfiles).length

    // Total attempts
    document.getElementById("totalAttempts").textContent = authLogs.length

    // Success rate
    if (authLogs.length > 0) {
      const successfulAttempts = authLogs.filter((log) => log.success).length
      const successRate = Math.round((successfulAttempts / authLogs.length) * 100)
      document.getElementById("successRate").textContent = `${successRate}%`
    }

    // Last authentication
    if (authLogs.length > 0) {
      const lastAuth = authLogs[authLogs.length - 1]
      const date = new Date(lastAuth.timestamp)
      document.getElementById("lastAuth").textContent = date.toLocaleDateString()
    }
  }

  bindEvents() {
    // General settings
    document.getElementById("autoEnable").addEventListener("change", (e) => {
      this.saveSetting("autoEnable", e.target.checked)
    })

    document.getElementById("voiceAuthEnabled").addEventListener("change", (e) => {
      this.saveSetting("voiceAuthEnabled", e.target.checked)
    })

    document.getElementById("privacyMode").addEventListener("change", (e) => {
      this.saveSetting("privacyMode", e.target.checked)
    })

    document.getElementById("debugMode").addEventListener("change", (e) => {
      this.saveSetting("debugMode", e.target.checked)
    })

    // Threshold sliders
    document.getElementById("autoencoderThreshold").addEventListener("input", (e) => {
      const value = Number.parseFloat(e.target.value)
      document.getElementById("autoencoderValue").textContent = value
      this.saveAuthConfig("AUTOENCODER_THRESHOLD", value)
    })

    document.getElementById("voiceThreshold").addEventListener("input", (e) => {
      const value = Number.parseFloat(e.target.value)
      document.getElementById("voiceValue").textContent = value
      this.saveAuthConfig("VOICE_SIMILARITY_THRESHOLD", value)
    })

    document.getElementById("samplesRequired").addEventListener("input", (e) => {
      const value = Number.parseInt(e.target.value)
      document.getElementById("samplesValue").textContent = value
      this.saveAuthConfig("SAMPLES_REQUIRED", value)
    })

    document.getElementById("noiseLevel").addEventListener("input", (e) => {
      const value = Number.parseFloat(e.target.value)
      document.getElementById("noiseValue").textContent = value
      this.saveAuthConfig("NOISE_LEVEL", value)
    })

    document.getElementById("augmentationFactor").addEventListener("input", (e) => {
      const value = Number.parseInt(e.target.value)
      document.getElementById("augmentationValue").textContent = value
      this.saveAuthConfig("AUGMENTATION_FACTOR", value)
    })

    // Data management
    document.getElementById("exportData").addEventListener("click", () => {
      this.exportData()
    })

    document.getElementById("importData").addEventListener("click", () => {
      document.getElementById("importFile").click()
    })

    document.getElementById("importFile").addEventListener("change", (e) => {
      this.importData(e.target.files[0])
    })

    document.getElementById("clearAllData").addEventListener("click", () => {
      this.clearAllData()
    })
  }

  async saveSetting(key, value) {
    await chrome.storage.local.set({ [key]: value })
    this.showNotification(`Setting saved: ${key}`, "success")
  }

  async saveAuthConfig(key, value) {
    const { authConfig } = await chrome.storage.local.get(["authConfig"])
    const config = authConfig || {}
    config[key] = value

    await chrome.storage.local.set({ authConfig: config })
    this.showNotification(`Configuration updated: ${key}`, "success")
  }

  async exportData() {
    try {
      const data = await chrome.storage.local.get(null)

      // Remove sensitive data if privacy mode is enabled
      const exportData = { ...data }
      if (data.privacyMode) {
        // Remove raw keystroke data
        Object.keys(exportData).forEach((key) => {
          if (key.startsWith("training_")) {
            delete exportData[key]
          }
        })
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ghostkey-data-${new Date().toISOString().split("T")[0]}.json`
      a.click()

      URL.revokeObjectURL(url)
      this.showNotification("Data exported successfully", "success")
    } catch (error) {
      this.showNotification("Export failed: " + error.message, "error")
    }
  }

  async importData(file) {
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate data structure
      if (!data || typeof data !== "object") {
        throw new Error("Invalid data format")
      }

      // Confirm import
      if (!confirm("This will overwrite all existing data. Continue?")) {
        return
      }

      await chrome.storage.local.clear()
      await chrome.storage.local.set(data)

      this.showNotification("Data imported successfully", "success")
      setTimeout(() => {
        location.reload()
      }, 1000)
    } catch (error) {
      this.showNotification("Import failed: " + error.message, "error")
    }
  }

  async clearAllData() {
    if (!confirm("Are you sure you want to clear all data? This cannot be undone.")) {
      return
    }

    if (!confirm("This will delete all biometric profiles and settings. Are you absolutely sure?")) {
      return
    }

    try {
      await chrome.storage.local.clear()
      this.showNotification("All data cleared successfully", "success")
      setTimeout(() => {
        location.reload()
      }, 1000)
    } catch (error) {
      this.showNotification("Clear failed: " + error.message, "error")
    }
  }

  showNotification(message, type = "info") {
    // Create notification element
    const notification = document.createElement("div")
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      animation: slideIn 0.3s ease;
    `

    switch (type) {
      case "success":
        notification.style.background = "rgba(16, 185, 129, 0.9)"
        notification.style.color = "white"
        break
      case "error":
        notification.style.background = "rgba(239, 68, 68, 0.9)"
        notification.style.color = "white"
        break
      default:
        notification.style.background = "rgba(59, 130, 246, 0.9)"
        notification.style.color = "white"
    }

    notification.textContent = message
    document.body.appendChild(notification)

    // Add animation styles
    const style = document.createElement("style")
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `
    document.head.appendChild(style)

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = "slideIn 0.3s ease reverse"
      setTimeout(() => {
        notification.remove()
        style.remove()
      }, 300)
    }, 3000)
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new OptionsManager()
})
