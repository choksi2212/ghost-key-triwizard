// // Remove the chrome declaration - it's already available globally

class PopupManager {
  constructor() {
    this.init()
  }

  async init() {
    await this.loadStatus()
    this.bindEvents()
    this.loadSettings()
  }

  async loadStatus() {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      // Check if user has registered profiles
      const result = await chrome.storage.local.get(["userProfiles", "currentUser"])
      const userProfiles = result.userProfiles || {}
      const currentUser = result.currentUser

      const statusDot = document.getElementById("statusDot")
      const statusText = document.getElementById("statusText")
      const alertContainer = document.getElementById("alertContainer")

      if (Object.keys(userProfiles).length === 0) {
        // No profiles registered
        statusText.textContent = "No biometric profiles registered"
        document.getElementById("registrationSection").style.display = "block"
        this.showAlert("info", "🔐 Register your biometric profile to enable secure authentication")
      } else if (currentUser && userProfiles[currentUser]) {
        // User has profile and is logged in
        statusDot.classList.add("active")
        statusText.textContent = `Active profile: ${currentUser}`
        document.getElementById("authenticationSection").style.display = "block"
        this.showAlert("success", "✅ Biometric authentication ready")
      } else {
        // Profiles exist but no current user
        statusText.textContent = "Biometric profiles available"
        document.getElementById("authenticationSection").style.display = "block"
        this.showAlert("info", "🔑 Click to enable authentication on this page")
      }

      // Check if currently training
      const trainingData = await chrome.storage.local.get(["trainingInProgress"])
      if (trainingData.trainingInProgress) {
        document.getElementById("trainingSection").style.display = "block"
        this.updateTrainingProgress()
      }
    } catch (error) {
      console.error("Error loading status:", error)
      this.showAlert("error", "❌ Error loading authentication status")
    }
  }

  bindEvents() {
    document.getElementById("startRegistration").addEventListener("click", () => {
      this.startRegistration()
    })

    document.getElementById("enableAuth").addEventListener("click", () => {
      this.enableAuthentication()
    })

    document.getElementById("testAuth").addEventListener("click", () => {
      this.testAuthentication()
    })

    document.getElementById("clearData").addEventListener("click", () => {
      this.clearAllData()
    })

    // Settings
    document.getElementById("autoEnable").addEventListener("change", (e) => {
      chrome.storage.local.set({ autoEnable: e.target.checked })
    })

    document.getElementById("voiceAuth").addEventListener("change", (e) => {
      chrome.storage.local.set({ voiceAuthEnabled: e.target.checked })
    })

    document.getElementById("privacyMode").addEventListener("change", (e) => {
      chrome.storage.local.set({ privacyMode: e.target.checked })
    })

    document.getElementById('fetchModelsBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'FETCH_MODELS' }, (response) => {
        if (response && response.success) {
          alert('Models fetched and ready!');
        }
      });
    });
  }

  async loadSettings() {
    const settings = await chrome.storage.local.get(["autoEnable", "voiceAuthEnabled", "privacyMode"])

    document.getElementById("autoEnable").checked = settings.autoEnable !== false
    document.getElementById("voiceAuth").checked = settings.voiceAuthEnabled !== false
    document.getElementById("privacyMode").checked = settings.privacyMode === true
  }

  async startRegistration() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      // Inject the registration interface
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          window.postMessage(
            {
              type: "GHOSTKEY_START_REGISTRATION",
              source: "extension",
            },
            "*",
          )
        },
      })

      this.showAlert("info", "🔄 Registration interface injected. Follow the on-page instructions.")
      window.close()
    } catch (error) {
      console.error("Error starting registration:", error)
      this.showAlert("error", "❌ Failed to start registration")
    }
  }

  async enableAuthentication() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          window.postMessage(
            {
              type: "GHOSTKEY_ENABLE_AUTH",
              source: "extension",
            },
            "*",
          )
        },
      })

      this.showAlert("success", "⚡ Authentication enabled on this page")
      window.close()
    } catch (error) {
      console.error("Error enabling authentication:", error)
      this.showAlert("error", "❌ Failed to enable authentication")
    }
  }

  async testAuthentication() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          window.postMessage(
            {
              type: "GHOSTKEY_TEST_AUTH",
              source: "extension",
            },
            "*",
          )
        },
      })

      this.showAlert("info", "🧪 Test mode activated. Try logging in to test authentication.")
      window.close()
    } catch (error) {
      console.error("Error testing authentication:", error)
      this.showAlert("error", "❌ Failed to start test mode")
    }
  }

  async clearAllData() {
    if (confirm("Are you sure you want to clear all biometric data? This cannot be undone.")) {
      try {
        await chrome.storage.local.clear()
        this.showAlert("success", "🗑️ All data cleared successfully")
        setTimeout(() => {
          this.loadStatus()
        }, 1000)
      } catch (error) {
        console.error("Error clearing data:", error)
        this.showAlert("error", "❌ Failed to clear data")
      }
    }
  }

  showAlert(type, message) {
    const alertContainer = document.getElementById("alertContainer")
    const alert = document.createElement("div")
    alert.className = `alert alert-${type}`
    alert.textContent = message

    alertContainer.innerHTML = ""
    alertContainer.appendChild(alert)

    setTimeout(() => {
      alert.remove()
    }, 5000)
  }

  async updateTrainingProgress() {
    const trainingData = await chrome.storage.local.get(["trainingSamples", "requiredSamples", "trainingUser"])

    const samples = trainingData.trainingSamples || 0
    const required = trainingData.requiredSamples || 10
    const progress = (samples / required) * 100

    document.getElementById("progressFill").style.width = `${progress}%`
    document.getElementById("trainingStatus").textContent =
      `${samples}/${required} samples collected for ${trainingData.trainingUser || "user"}`

    if (samples >= required) {
      document.getElementById("trainingSection").style.display = "none"
      this.showAlert("success", "🎉 Training completed! Voice registration will start next.")
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new PopupManager()
})