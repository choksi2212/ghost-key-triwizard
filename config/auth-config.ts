export const AUTH_CONFIG = {
  // Keystroke dynamics settings
  PASSWORD_LENGTH: 8,
  SAMPLES_REQUIRED: 5,
  NOISE_LEVEL: 0.1,
  AUGMENTATION_FACTOR: 3,

  // Autoencoder settings
  AUTOENCODER_THRESHOLD: 0.03, // Change this value for testing different thresholds
  AUTOENCODER_THRESHOLDS: [0.01, 0.03, 0.05, 0.07, 0.1], // Test different values

  // Voice authentication settings
  VOICE_SIMILARITY_THRESHOLD: 0.75, // Change this value for testing different thresholds
  VOICE_THRESHOLDS: [0.5, 0.6, 0.65, 0.7, 0.75], // Test different values
  VOICE_SAMPLE_DURATION: 3000, // 3 seconds
  VOICE_FEATURES_COUNT: 13, // MFCC features

  // File paths
  MODELS_DIR: "models",
  VOICE_MODELS_DIR: "voice_models",

  // Legacy settings (for backward compatibility)
  PERCENTILE_THRESHOLD: 95,
} as const
