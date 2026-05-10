import { env } from './env.js';

export const providerConfig = {
  activeProvider: env.activeProvider,

  // ---------------------------------------------------------------------------
  // Gemini provider config
  // ---------------------------------------------------------------------------
  gemini: {
    apiKey: env.geminiApiKey,
    model: env.geminiModel,
    maxRetries: Math.max(0, env.geminiMaxRetries),
    retryDelayMs: Math.max(1000, env.geminiRetryDelayMs),
  },

  // ---------------------------------------------------------------------------
  // OpenAI provider config
  // ---------------------------------------------------------------------------
  openai: {
    apiKey: env.openaiApiKey,
    model: env.openaiModel,
    maxRetries: Math.max(0, env.openaiMaxRetries),
    retryDelayMs: Math.max(1000, env.openaiRetryDelayMs),
    ...(env.openaiBaseURL ? { baseURL: env.openaiBaseURL } : {}),
    temperature: env.openaiTemperature,
    maxTokens: env.openaiMaxTokens,
  },

  // ---------------------------------------------------------------------------
  // Pipeline stage config
  //
  // Each stage specifies:
  //   provider  – which provider to use for this stage (overrides activeProvider)
  //   options   – model/retry overrides merged on top of the provider's base config
  // ---------------------------------------------------------------------------
  pipeline: {
    draft: {
      provider: env.aiDraftProvider,
      options: {
        // Gemini draft overrides (only applied when provider=gemini)
        model: env.geminiDraftModel,
        maxRetries: Math.max(0, env.geminiDraftMaxRetries),
        retryDelayMs: Math.max(1000, env.geminiDraftRetryDelayMs),
      },
      openaiOptions: {
        // OpenAI draft overrides (only applied when provider=openai)
        model: env.openaiDraftModel,
        maxRetries: Math.max(0, env.openaiDraftMaxRetries),
        retryDelayMs: Math.max(1000, env.openaiDraftRetryDelayMs),
      },
    },
    refiner: {
      provider: env.aiRefinerProvider,
      options: {
        model: env.geminiRefinerModel,
        maxRetries: Math.max(0, env.geminiRefinerMaxRetries),
        retryDelayMs: Math.max(1000, env.geminiRefinerRetryDelayMs),
      },
      openaiOptions: {
        model: env.openaiRefinerModel,
        maxRetries: Math.max(0, env.openaiRefinerMaxRetries),
        retryDelayMs: Math.max(1000, env.openaiRefinerRetryDelayMs),
      },
    },
  },
};
