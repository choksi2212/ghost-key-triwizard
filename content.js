// Declare chrome variable to fix undeclared variable error

class GhostKeyContent {
  constructor() {
    this.isEnabled = false
    this.isRegistering = false
    this.currentUser = null
    this.keystrokeData = []
    this.trainingCount = 0
    this.requiredSamples = 10
    this.failedAttempts = 0
    this.ui = null

    this.init()
  }

  async init() {
    // Load settings and check if should auto-enable
    const settings = await this.getSettings()

    // Listen for messages from popup and background
    window.addEventListener("message", (event) => {
      if (event.source !== window) return

      if (event.data.source === "extension") {
        this.handleExtensionMessage(event.data)
      }
    })

    // Check if this looks like a login page and auto-enable if configured
    if (settings.autoEnable && this.isLoginPage()) {
      setTimeout(() => this.enableAuthentication(), 1000)
    }
  }

  async getSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
        resolve(response.success ? response.settings : {})
      })
    })
  }

  isLoginPage() {
    // Check if page has login-related elements
    const loginSelectors = [
      'input[type="password"]',
      'input[name*="password"]',
      'input[name*="login"]',
      'input[name*="email"]',
      'input[name*="username"]',
      ".login",
      ".signin",
      "#login",
      "#signin",
    ]

    return loginSelectors.some((selector) => document.querySelector(selector))
  }

  handleExtensionMessage(message) {
    switch (message.type) {
      case "GHOSTKEY_START_REGISTRATION":
        this.startRegistration()
        break
      case "GHOSTKEY_ENABLE_AUTH":
        this.enableAuthentication()
        break
      case "GHOSTKEY_TEST_AUTH":
        this.enableTestMode()
        break
      case "GHOSTKEY_AUTO_ENABLE":
        this.enableAuthentication()
        break
    }
  }

  startRegistration() {
    if (this.isRegistering) return

    this.isRegistering = true
    this.showRegistrationUI()
  }

  enableAuthentication() {
    if (this.isEnabled) return

    this.isEnabled = true
    this.attachToPasswordFields()
    this.showAuthenticationUI()
  }

  enableTestMode() {
    this.enableAuthentication()
    this.showNotification("🧪 Test mode enabled. Try logging in to test authentication.", "info")
  }

  showRegistrationUI() {
    this.createUI("registration")
  }

  showAuthenticationUI() {
    this.createUI("authentication")
  }

  createUI(mode) {
    // Remove existing UI
    if (this.ui) {
      this.ui.remove()
    }

    // Create floating UI
    this.ui = document.createElement("div")
    this.ui.id = "ghostkey-ui"
    this.ui.innerHTML = this.getUIHTML(mode)

    // Add styles
    const style = document.createElement("style")
    style.textContent = this.getUIStyles()
    document.head.appendChild(style)

    document.body.appendChild(this.ui)

    // Bind events
    this.bindUIEvents(mode)

    // Auto-hide after 10 seconds unless interacting
    setTimeout(() => {
      if (this.ui && !this.ui.classList.contains("interacting")) {
        this.ui.style.opacity = "0.3"
      }
    }, 10000)
  }

  getUIHTML(mode) {
    if (mode === "registration") {
      return `
        <div class="ghostkey-panel">
          <div class="ghostkey-header">
            <div class="ghostkey-logo">🛡️</div>
            <div class="ghostkey-title">GhostKey Registration</div>
            <button class="ghostkey-close" id="ghostkey-close">×</button>
          </div>
          <div class="ghostkey-content">
            <div class="ghostkey-step" id="step-username">
              <h3>Step 1: Enter Username</h3>
              <input type="text" id="ghostkey-username" placeholder="Enter your username" />
              <button id="ghostkey-start-training" class="ghostkey-btn primary">Start Training</button>
            </div>
            <div class="ghostkey-step hidden" id="step-training">
              <h3>Step 2: Keystroke Training</h3>
              <p>Type the passphrase exactly as shown:</p>
              <div class="ghostkey-passphrase">"MySecretPassword123"</div>
              <input type="password" id="ghostkey-training-input" placeholder="Type the passphrase here" />
              <div class="ghostkey-progress">
                <div class="ghostkey-progress-bar">
                  <div class="ghostkey-progress-fill" id="training-progress"></div>
                </div>
                <div class="ghostkey-progress-text" id="training-text">0/10 samples</div>
              </div>
            </div>
            <div class="ghostkey-step hidden" id="step-voice">
              <h3>Step 3: Voice Registration</h3>
              <p>Record yourself saying: <strong>"I'll Always Choose You"</strong></p>
              <div class="ghostkey-voice-controls">
                <button id="ghostkey-record" class="ghostkey-btn record">🎤 Record</button>
                <button id="ghostkey-play" class="ghostkey-btn secondary hidden">▶️ Play</button>
                <button id="ghostkey-accept" class="ghostkey-btn success hidden">✅ Accept</button>
              </div>
              <div class="ghostkey-voice-progress">
                <div id="voice-samples-text">0/5 voice samples</div>
              </div>
            </div>
            <div class="ghostkey-step hidden" id="step-complete">
              <h3>🎉 Registration Complete!</h3>
              <p>Your biometric profile has been created successfully.</p>
              <button id="ghostkey-finish" class="ghostkey-btn success">Finish</button>
            </div>
          </div>
        </div>
      `
    } else {
      return `
        <div class="ghostkey-panel">
          <div class="ghostkey-header">
            <div class="ghostkey-logo">🛡️</div>
            <div class="ghostkey-title">GhostKey Active</div>
            <button class="ghostkey-close" id="ghostkey-close">×</button>
          </div>
          <div class="ghostkey-content">
            <div class="ghostkey-status">
              <div class="ghostkey-status-indicator active"></div>
              <span>Biometric authentication enabled</span>
            </div>
            <div class="ghostkey-features">
              <div class="ghostkey-feature">⌨️ Keystroke Analysis</div>
              <div class="ghostkey-feature">🎤 Voice Recognition</div>
              <div class="ghostkey-feature">🧠 Neural Network</div>
            </div>
            <div id="ghostkey-auth-result" class="ghostkey-result hidden"></div>
          </div>
        </div>
      `
    }
  }

  getUIStyles() {
    return `
      #ghostkey-ui {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        transition: all 0.3s ease;
      }

      .ghostkey-panel {
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        border: 1px solid #475569;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        width: 350px;
        max-height: 500px;
        overflow: hidden;
      }

      .ghostkey-header {
        background: linear-gradient(to right, rgba(30, 41, 59, 0.9), rgba(51, 65, 85, 0.9));
        padding: 15px 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid #475569;
      }

      .ghostkey-logo {
        font-size: 20px;
      }

      .ghostkey-title {
        flex: 1;
        color: #e2e8f0;
        font-weight: 600;
        font-size: 16px;
      }

      .ghostkey-close {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .ghostkey-close:hover {
        background: rgba(239, 68, 68, 0.2);
        color: #ef4444;
      }

      .ghostkey-content {
        padding: 20px;
        color: #e2e8f0;
      }

      .ghostkey-step {
        animation: fadeIn 0.3s ease;
      }

      .ghostkey-step.hidden {
        display: none;
      }

      .ghostkey-step h3 {
        margin: 0 0 15px 0;
        color: #06b6d4;
        font-size: 16px;
      }

      .ghostkey-step p {
        margin: 0 0 10px 0;
        color: #94a3b8;
        font-size: 14px;
      }

      .ghostkey-passphrase {
        background: rgba(51, 65, 85, 0.5);
        border: 1px solid #475569;
        border-radius: 6px;
        padding: 10px;
        margin: 10px 0;
        font-family: monospace;
        font-size: 14px;
        color: #06b6d4;
        text-align: center;
      }

      .ghostkey-step input {
        width: 100%;
        padding: 10px;
        border: 1px solid #475569;
        border-radius: 6px;
        background: rgba(51, 65, 85, 0.5);
        color: #e2e8f0;
        font-size: 14px;
        margin-bottom: 15px;
        box-sizing: border-box;
      }

      .ghostkey-step input:focus {
        outline: none;
        border-color: #06b6d4;
        box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
      }

      .ghostkey-btn {
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        margin-right: 8px;
        margin-bottom: 8px;
      }

      .ghostkey-btn.primary {
        background: linear-gradient(to right, #06b6d4, #3b82f6);
        color: white;
      }

      .ghostkey-btn.primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
      }

      .ghostkey-btn.secondary {
        background: rgba(71, 85, 105, 0.5);
        color: #e2e8f0;
        border: 1px solid #475569;
      }

      .ghostkey-btn.success {
        background: linear-gradient(to right, #10b981, #059669);
        color: white;
      }

      .ghostkey-btn.record {
        background: linear-gradient(to right, #f59e0b, #d97706);
        color: white;
      }

      .ghostkey-btn.record.recording {
        background: linear-gradient(to right, #ef4444, #dc2626);
        animation: pulse 1s infinite;
      }

      .ghostkey-progress {
        margin: 15px 0;
      }

      .ghostkey-progress-bar {
        width: 100%;
        height: 6px;
        background: rgba(71, 85, 105, 0.5);
        border-radius: 3px;
        overflow: hidden;
      }

      .ghostkey-progress-fill {
        height: 100%;
        background: linear-gradient(to right, #06b6d4, #3b82f6);
        transition: width 0.3s ease;
        width: 0%;
      }

      .ghostkey-progress-text {
        text-align: center;
        font-size: 12px;
        color: #94a3b8;
        margin-top: 5px;
      }

      .ghostkey-voice-controls {
        display: flex;
        gap: 10px;
        margin: 15px 0;
      }

      .ghostkey-voice-progress {
        text-align: center;
        font-size: 12px;
        color: #94a3b8;
      }

      .ghostkey-status {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
      }

      .ghostkey-status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ef4444;
      }

      .ghostkey-status-indicator.active {
        background: #10b981;
        animation: pulse 2s infinite;
      }

      .ghostkey-features {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 15px;
      }

      .ghostkey-feature {
        font-size: 12px;
        color: #94a3b8;
        padding: 5px 0;
      }

      .ghostkey-result {
        padding: 10px;
        border-radius: 6px;
        margin-top: 15px;
        font-size: 12px;
        font-family: monospace;
        white-space: pre-line;
      }

      .ghostkey-result.success {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #10b981;
      }

      .ghostkey-result.error {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #ef4444;
      }

      .ghostkey-result.hidden {
        display: none;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `
  }

  bindUIEvents(mode) {
    // Close button
    document.getElementById("ghostkey-close").addEventListener("click", () => {
      this.hideUI()
    })

    // Make UI interactive on hover
    this.ui.addEventListener("mouseenter", () => {
      this.ui.classList.add("interacting")
      this.ui.style.opacity = "1"
    })

    this.ui.addEventListener("mouseleave", () => {
      this.ui.classList.remove("interacting")
    })

    if (mode === "registration") {
      this.bindRegistrationEvents()
    }
  }

  bindRegistrationEvents() {
    const startTrainingBtn = document.getElementById("ghostkey-start-training")
    const usernameInput = document.getElementById("ghostkey-username")
    const trainingInput = document.getElementById("ghostkey-training-input")
    const recordBtn = document.getElementById("ghostkey-record")
    const playBtn = document.getElementById("ghostkey-play")
    const acceptBtn = document.getElementById("ghostkey-accept")
    const finishBtn = document.getElementById("ghostkey-finish")

    startTrainingBtn.addEventListener("click", () => {
      const username = usernameInput.value.trim()
      if (!username) {
        this.showNotification("Please enter a username", "error")
        return
      }
      this.currentUser = username
      this.startKeystrokeTraining()
    })

    trainingInput.addEventListener("keydown", (e) => {
      this.captureKeystroke(e, "keydown")
      if (e.key === "Enter") {
        this.processTrainingSample()
      }
    })

    trainingInput.addEventListener("keyup", (e) => {
      this.captureKeystroke(e, "keyup")
    })

    recordBtn.addEventListener("click", () => {
      this.toggleVoiceRecording()
    })

    playBtn.addEventListener("click", () => {
      this.playVoiceRecording()
    })

    acceptBtn.addEventListener("click", () => {
      this.acceptVoiceSample()
    })

    finishBtn.addEventListener("click", () => {
      this.finishRegistration()
    })
  }

  startKeystrokeTraining() {
    document.getElementById("step-username").classList.add("hidden")
    document.getElementById("step-training").classList.remove("hidden")

    // Focus on training input
    setTimeout(() => {
      document.getElementById("ghostkey-training-input").focus()
    }, 100)
  }

  captureKeystroke(event, type) {
    this.keystrokeData.push({
      key: event.key,
      type: type,
      timestamp: performance.now(),
    })
  }

  async processTrainingSample() {
    const input = document.getElementById("ghostkey-training-input")
    const expectedPassphrase = "MySecretPassword123"

    if (input.value !== expectedPassphrase) {
      this.showNotification("Please type the exact passphrase shown", "error")
      input.value = ""
      this.keystrokeData = []
      return
    }

    // Extract features from keystroke data
    const features = this.extractKeystrokeFeatures(this.keystrokeData)

    // Save training sample
    await this.saveTrainingSample({
      username: this.currentUser,
      features: features,
      sampleIndex: this.trainingCount,
    })

    this.trainingCount++
    this.updateTrainingProgress()

    // Clear for next sample
    input.value = ""
    this.keystrokeData = []

    if (this.trainingCount >= this.requiredSamples) {
      this.startVoiceTraining()
    }
  }

  extractKeystrokeFeatures(data) {
    // Same feature extraction logic as the original project
    const keydowns = data.filter((k) => k.type === "keydown")
    const keyups = data.filter((k) => k.type === "keyup")

    const matchedKeys = keydowns.map((k) => [k.key, k.timestamp])
    const holdTimes = []
    const ddTimes = []
    const udTimes = []

    // Calculate hold times
    matchedKeys.forEach(([key, downTs]) => {
      const upEvent = keyups.find((u) => u.key === key && u.timestamp > downTs)
      if (upEvent) {
        holdTimes.push(upEvent.timestamp - downTs)
      }
    })

    // Calculate dwell times (down-down)
    for (let i = 0; i < matchedKeys.length - 1; i++) {
      ddTimes.push(matchedKeys[i + 1][1] - matchedKeys[i][1])
    }

    // Calculate flight times (up-down)
    for (let i = 0; i < matchedKeys.length - 1; i++) {
      const currentKey = matchedKeys[i][0]
      const currentDown = matchedKeys[i][1]
      const nextDown = matchedKeys[i + 1][1]

      const currentUp = keyups.find((u) => u.key === currentKey && u.timestamp > currentDown)
      if (currentUp) {
        udTimes.push(nextDown - currentUp.timestamp)
      }
    }

    // Calculate additional features
    const totalTime = Math.max(...ddTimes) || 1
    const typingSpeed = matchedKeys.length / (totalTime / 1000)
    const flightTime = udTimes.length > 0 ? udTimes.reduce((a, b) => a + b, 0) / udTimes.length : 0
    const errorRate = data.filter((k) => k.key === "Backspace").length

    const meanHoldTime = holdTimes.length > 0 ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length : 0
    const pressPressure =
      holdTimes.length > 0
        ? Math.sqrt(holdTimes.reduce((sum, t) => sum + Math.pow(t - meanHoldTime, 2), 0) / holdTimes.length)
        : 0

    // Create feature vector
    const PASSWORD_LENGTH = 19 // Length of "MySecretPassword123"
    const featureVector = [
      ...holdTimes.slice(0, PASSWORD_LENGTH),
      ...ddTimes.slice(0, PASSWORD_LENGTH - 1),
      ...udTimes.slice(0, PASSWORD_LENGTH - 1),
      typingSpeed,
      flightTime,
      errorRate,
      pressPressure,
    ]

    // Pad with zeros if needed
    while (featureVector.length < PASSWORD_LENGTH * 3 + 1) {
      featureVector.push(0)
    }

    return featureVector
  }

  async saveTrainingSample(sampleData) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "SAVE_TRAINING_SAMPLE",
          data: sampleData,
        },
        (response) => {
          resolve(response.success)
        },
      )
    })
  }

  updateTrainingProgress() {
    const progressFill = document.getElementById("training-progress")
    const progressText = document.getElementById("training-text")

    const percentage = (this.trainingCount / this.requiredSamples) * 100
    progressFill.style.width = `${percentage}%`
    progressText.textContent = `${this.trainingCount}/${this.requiredSamples} samples`
  }

  startVoiceTraining() {
    document.getElementById("step-training").classList.add("hidden")
    document.getElementById("step-voice").classList.remove("hidden")

    this.voiceSamples = []
    this.requiredVoiceSamples = 5
    this.isRecording = false
    this.mediaRecorder = null
    this.audioChunks = []
  }

  async toggleVoiceRecording() {
    const recordBtn = document.getElementById("ghostkey-record")

    if (!this.isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        this.mediaRecorder = new MediaRecorder(stream)
        this.audioChunks = []

        this.mediaRecorder.ondataavailable = (event) => {
          this.audioChunks.push(event.data)
        }

        this.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" })
          this.currentAudioBlob = audioBlob
          this.currentAudioUrl = URL.createObjectURL(audioBlob)

          document.getElementById("ghostkey-play").classList.remove("hidden")
          document.getElementById("ghostkey-accept").classList.remove("hidden")
        }

        this.mediaRecorder.start()
        this.isRecording = true
        recordBtn.textContent = "⏹️ Stop"
        recordBtn.classList.add("recording")
      } catch (error) {
        this.showNotification("Microphone access denied", "error")
      }
    } else {
      this.mediaRecorder.stop()
      this.mediaRecorder.stream.getTracks().forEach((track) => track.stop())
      this.isRecording = false
      recordBtn.textContent = "🎤 Record"
      recordBtn.classList.remove("recording")
    }
  }

  playVoiceRecording() {
    if (this.currentAudioUrl) {
      const audio = new Audio(this.currentAudioUrl)
      audio.play()
    }
  }

  acceptVoiceSample() {
    if (this.currentAudioBlob) {
      this.voiceSamples.push(this.currentAudioBlob)

      const samplesText = document.getElementById("voice-samples-text")
      samplesText.textContent = `${this.voiceSamples.length}/${this.requiredVoiceSamples} voice samples`

      // Reset for next sample
      document.getElementById("ghostkey-play").classList.add("hidden")
      document.getElementById("ghostkey-accept").classList.add("hidden")
      this.currentAudioBlob = null
      this.currentAudioUrl = null

      if (this.voiceSamples.length >= this.requiredVoiceSamples) {
        this.completeRegistration()
      } else {
        this.showNotification(
          `Voice sample ${this.voiceSamples.length} saved. Record ${this.requiredVoiceSamples - this.voiceSamples.length} more.`,
          "success",
        )
      }
    }
  }

  async completeRegistration() {
    try {
      // Train the keystroke model
      await this.trainKeystrokeModel()

      // Save voice profile
      await this.saveVoiceProfile()

      // Show completion
      document.getElementById("step-voice").classList.add("hidden")
      document.getElementById("step-complete").classList.remove("hidden")
    } catch (error) {
      this.showNotification("Registration failed: " + error.message, "error")
    }
  }

  async trainKeystrokeModel() {
    // Get all training samples
    const samples = []
    for (let i = 0; i < this.trainingCount; i++) {
      // In a real implementation, you'd retrieve the saved samples
      // For now, we'll create a simplified model
    }

    // Create a simplified autoencoder model (placeholder)
    const model = {
      modelType: "autoencoder",
      username: this.currentUser,
      threshold: 0.03,
      createdAt: new Date().toISOString(),
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "SAVE_USER_PROFILE",
          data: model,
        },
        (response) => {
          resolve(response.success)
        },
      )
    })
  }

  async saveVoiceProfile() {
    // In a real implementation, you'd process the voice samples
    // and extract features. For now, we'll save a placeholder.
    const voiceProfile = {
      username: this.currentUser,
      voiceSamples: this.voiceSamples.length,
      createdAt: new Date().toISOString(),
    }

    // Voice profile would be saved separately or merged with keystroke profile
    console.log("Voice profile created:", voiceProfile)
  }

  finishRegistration() {
    this.hideUI()
    this.showNotification("🎉 Registration complete! You can now use biometric authentication.", "success")
    this.isRegistering = false
  }

  attachToPasswordFields() {
    const passwordFields = document.querySelectorAll('input[type="password"]')

    passwordFields.forEach((field) => {
      if (field.dataset.ghostkeyAttached) return

      field.dataset.ghostkeyAttached = "true"
      field.addEventListener("keydown", (e) => this.captureKeystroke(e, "keydown"))
      field.addEventListener("keyup", (e) => this.captureKeystroke(e, "keyup"))
      field.addEventListener("blur", () => this.processAuthentication(field))

      // Add visual indicator
      field.style.boxShadow = "0 0 0 2px rgba(6, 182, 212, 0.3)"
      field.style.transition = "box-shadow 0.2s"
    })
  }

  async processAuthentication(field) {
    if (this.keystrokeData.length === 0) return

    const features = this.extractKeystrokeFeatures(this.keystrokeData)

    // Try to determine username (could be from a username field or stored)
    const usernameField = document.querySelector('input[type="email"], input[name*="username"], input[name*="email"]')
    const username = usernameField ? usernameField.value : this.currentUser || "default"

    const authResult = await this.authenticateUser({
      username: username,
      features: features,
    })

    this.showAuthenticationResult(authResult)
    this.keystrokeData = [] // Reset for next attempt
  }

  async authenticateUser(authData) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "AUTHENTICATE_USER",
          data: authData,
        },
        (response) => {
          resolve(response.success ? response.result : { success: false, authenticated: false })
        },
      )
    })
  }

  showAuthenticationResult(result) {
    const resultDiv = document.getElementById("ghostkey-auth-result")
    if (!resultDiv) return

    resultDiv.classList.remove("hidden", "success", "error")

    if (result.authenticated) {
      resultDiv.classList.add("success")
      resultDiv.textContent = `✅ AUTHENTICATION SUCCESSFUL\nBiometric Error: ${(result.reconstructionError || 0).toFixed(5)}\n🛡️ ACCESS GRANTED`
      this.failedAttempts = 0
    } else {
      resultDiv.classList.add("error")
      this.failedAttempts++

      if (this.failedAttempts >= 2) {
        resultDiv.textContent = `❌ AUTHENTICATION FAILED (${this.failedAttempts}/2)\n🎤 Voice authentication required`
        this.triggerVoiceAuthentication()
      } else {
        resultDiv.textContent = `❌ AUTHENTICATION FAILED (${this.failedAttempts}/2)\nBiometric Error: ${(result.reconstructionError || 0).toFixed(5)}\n🚫 ACCESS DENIED`
      }
    }

    // Log the attempt
    this.logAuthAttempt({
      username: result.username || "unknown",
      success: result.authenticated,
      mse: result.reconstructionError || 0,
      timestamp: new Date().toISOString(),
    })
  }

  triggerVoiceAuthentication() {
    // Create voice authentication modal
    this.showVoiceAuthModal()
  }

  showVoiceAuthModal() {
    // Implementation for voice authentication modal
    // This would be similar to the voice registration but for authentication
    this.showNotification("🎤 Voice authentication required. Feature coming soon!", "info")
  }

  async logAuthAttempt(logData) {
    chrome.runtime.sendMessage({
      type: "LOG_AUTH_ATTEMPT",
      data: logData,
    })
  }

  hideUI() {
    if (this.ui) {
      this.ui.remove()
      this.ui = null
    }
  }

  showNotification(message, type = "info") {
    // Create notification
    const notification = document.createElement("div")
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000000;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      animation: slideDown 0.3s ease;
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
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    `
    document.head.appendChild(style)

    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = "slideDown 0.3s ease reverse"
      setTimeout(() => {
        notification.remove()
        style.remove()
      }, 300)
    }, 5000)
  }
}

// Initialize GhostKey when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new GhostKeyContent()
  })
} else {
  new GhostKeyContent()
}

let keystrokes = [];
let modelLoaded = false;
let tfModel = null;

// Load TensorFlow.js
function loadTfJs(callback) {
  if (window.tf) return callback();
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.18.0/dist/tf.min.js';
  script.onload = callback;
  document.head.appendChild(script);
}

// Listen for keystrokes
window.addEventListener('keydown', (e) => {
  if (e.target.type === 'password' || e.target.type === 'text') {
    keystrokes.push({ key: e.key, time: Date.now() });
  }
});

// On form submit, run inference
window.addEventListener('submit', async (e) => {
  if (!modelLoaded) {
    await new Promise((resolve) => loadTfJs(resolve));
    chrome.storage.local.get('keystrokeModel', async (data) => {
      if (data.keystrokeModel) {
        tfModel = await tf.loadLayersModel(tf.io.browserFiles([
          new File([JSON.stringify(data.keystrokeModel)], 'model.json', { type: 'application/json' })
        ]));
        modelLoaded = true;
      }
    });
  }
  // Wait for model to load
  if (!tfModel) return;

  // Extract features (implement your own logic)
  const features = extractFeatures(keystrokes);

  // Run inference
  const input = tf.tensor([features]);
  const output = tfModel.predict(input);
  const reconstructionError = tf.losses.meanSquaredError(input, output).dataSync()[0];

  // Threshold (tune this value)
  if (reconstructionError > 0.1) {
    e.preventDefault();
    alert('Biometric authentication failed!');
  }
  // else allow login
});

// Example feature extraction (customize as needed)
function extractFeatures(keystrokes) {
  // Example: time between keystrokes
  let times = [];
  for (let i = 1; i < keystrokes.length; i++) {
    times.push(keystrokes[i].time - keystrokes[i - 1].time);
  }
  // Pad or trim to fixed length
  while (times.length < 20) times.push(0);
  return times.slice(0, 20);
}
