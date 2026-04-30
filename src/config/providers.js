import { env } from './env.js';

export const providerConfig = {
  activeProvider: env.activeProvider,
  gemini: {
    apiKey: env.geminiApiKey,
    model: env.geminiModel,
    maxRetries: Math.max(0, env.geminiMaxRetries),
    retryDelayMs: Math.max(1000, env.geminiRetryDelayMs),
  },
  pipeline: {
    draft: {
      provider: env.aiDraftProvider,
      options: {
        model: env.geminiDraftModel,
        maxRetries: Math.max(0, env.geminiDraftMaxRetries),
        retryDelayMs: Math.max(1000, env.geminiDraftRetryDelayMs),
      },
    },
    refiner: {
      provider: env.aiRefinerProvider,
      options: {
        model: env.geminiRefinerModel,
        maxRetries: Math.max(0, env.geminiRefinerMaxRetries),
        retryDelayMs: Math.max(1000, env.geminiRefinerRetryDelayMs),
      },
    },
  },
};
