// This script is injected into the page context to handle deep integration
;(() => {
  class GhostKeyInjected {
    constructor() {
      this.init()
    }

    init() {
      // Listen for messages from content script
      window.addEventListener("message", (event) => {
        if (event.source !== window) return

        if (event.data.type && event.data.type.startsWith("GHOSTKEY_")) {
          this.handleMessage(event.data)
        }
      })

      // Monitor for form submissions
      this.monitorFormSubmissions()

      // Monitor for dynamic content changes
      this.observePageChanges()
    }

    handleMessage(message) {
      switch (message.type) {
        case "GHOSTKEY_INJECT_AUTH":
          this.injectAuthenticationLogic()
          break
        case "GHOSTKEY_MONITOR_FORMS":
          this.monitorForms()
          break
      }
    }

    injectAuthenticationLogic() {
      // Override form submission to include biometric verification
      const originalSubmit = HTMLFormElement.prototype.submit

      HTMLFormElement.prototype.submit = function () {
        
        const passwordField = this.querySelector('input[type="password"]')

        if (passwordField && passwordField.dataset.ghostkeyAttached) {
          // Trigger biometric authentication before submission
          window.postMessage(
            {
              type: "GHOSTKEY_FORM_SUBMIT",
              formData: new FormData(this),
            },
            "*",
          )

          // Delay submission to allow authentication
          setTimeout(() => {
            originalSubmit.call(this)
          }, 100)
        } else {
          originalSubmit.call(this)
        }
      }
    }

    monitorFormSubmissions() {
      document.addEventListener("submit", (event) => {
        const form = event.target
        const passwordField = form.querySelector('input[type="password"]')

        if (passwordField && passwordField.dataset.ghostkeyAttached) {
          // Notify content script about form submission
          window.postMessage(
            {
              type: "GHOSTKEY_FORM_SUBMITTING",
              source: "injected",
            },
            "*",
          )
        }
      })
    }

    observePageChanges() {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const passwordFields = node.querySelectorAll('input[type="password"]')
                if (passwordFields.length > 0) {
                  // Notify content script about new password fields
                  window.postMessage(
                    {
                      type: "GHOSTKEY_NEW_PASSWORD_FIELDS",
                      count: passwordFields.length,
                      source: "injected",
                    },
                    "*",
                  )
                }
              }
            })
          }
        })
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      })
    }

    monitorForms() {
      const forms = document.querySelectorAll("form")
      forms.forEach((form) => {
        if (!form.dataset.ghostkeyMonitored) {
          form.dataset.ghostkeyMonitored = "true"

          form.addEventListener("input", (event) => {
            if (event.target.type === "password") {
              // Notify about password input activity
              window.postMessage(
                {
                  type: "GHOSTKEY_PASSWORD_INPUT",
                  source: "injected",
                },
                "*",
              )
            }
          })
        }
      })
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      new GhostKeyInjected()
    })
  } else {
    new GhostKeyInjected()
  }
})()
