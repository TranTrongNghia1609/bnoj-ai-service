import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProviderBase } from '../ProviderBase.js';
import { ConfigError } from '../../core/errors.js';
import { CircuitBreaker } from '../../core/CircuitBreaker.js';
import { buildDraftPrompt, buildRefinerPrompt } from './promptBuilder.js';
import {
  classifyError,
  getSafeErrorMessage,
  isRetryableError,
  parseRetryDelayMs,
} from './errorUtils.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class GeminiProvider extends ProviderBase {
  constructor(config) {
    super('gemini', config);
    this.client = null;
    this.models = new Map();
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: config?.circuitBreakerFailures || 5,
      resetTimeoutMs: config?.circuitBreakerResetMs || 60000,
      monitorWindowMs: config?.circuitBreakerWindowMs || 120000,
    });
  }

  validateConfig() {
    super.validateConfig();

    if (!this.config?.apiKey) {
      throw new ConfigError('GEMINI_API_KEY is required for GeminiProvider');
    }

    if (!this.config?.model) {
      throw new ConfigError('GEMINI_MODEL is required for GeminiProvider');
    }
  }

  initModel(modelName) {
    if (!this.client) {
      this.client = new GoogleGenerativeAI(this.config.apiKey);
    }

    if (this.models.has(modelName)) {
      return this.models.get(modelName);
    }

    const model = this.client.getGenerativeModel({ model: modelName });
    this.models.set(modelName, model);
    return model;
  }

  async generateHint(request, options = {}) {
    const stage = String(options?.stage || 'draft').toLowerCase();
    const modelName = String(options?.model || this.config.model || '').trim();

    if (!modelName) {
      return {
        ok: false,
        hint: null,
        model: null,
        stage,
        errorType: 'CONFIG_ERROR',
        errorMessage: 'Gemini model is not configured',
        retryAfterMs: 0,
      };
    }

    const model = this.initModel(modelName);
    const prompt = String(options?.prompt || (stage === 'refiner'
      ? buildRefinerPrompt(request, options?.draftHint)
      : buildDraftPrompt(request)));

    const maxRetries = Math.max(0, this.config.maxRetries || 0);
    const maxAttempts = maxRetries + 1;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        // --- Circuit Breaker check ---
        const cbResult = await this.circuitBreaker.execute(async () => {
          const result = await model.generateContent(prompt);
          return await result.response;
        });

        if (cbResult.circuitOpen) {
          console.warn(`[GeminiProvider] Circuit OPEN – skipping ${stage} stage (attempt ${attempt})`);
          return {
            ok: false,
            hint: null,
            model: modelName,
            stage,
            errorType: 'CIRCUIT_OPEN',
            errorMessage: 'Gemini API circuit breaker is open due to repeated failures',
            retryAfterMs: this.circuitBreaker.resetTimeoutMs || 60000,
          };
        }

        // cbResult.result is the Gemini response
        const response = cbResult.result;
        return {
          ok: true,
          hint: response.text(),
          model: modelName,
          stage,
        };
      } catch (error) {
        lastError = error;
        const retryable = isRetryableError(error);

        if (!retryable || attempt >= maxAttempts) {
          console.warn(`[GeminiProvider] ${stage} failed (attempt ${attempt}/${maxAttempts}): ${getSafeErrorMessage(error)}`);
          break;
        }

        const retryDelayMs = parseRetryDelayMs(error, this.config.retryDelayMs);
        console.warn(`[GeminiProvider] ${stage} attempt ${attempt}/${maxAttempts} failed (retryable). Retrying in ${retryDelayMs}ms...`);
        await sleep(retryDelayMs);
      }
    }

    return {
      ok: false,
      hint: null,
      model: modelName,
      stage,
      errorType: classifyError(lastError),
      errorMessage: getSafeErrorMessage(lastError),
      retryAfterMs: parseRetryDelayMs(lastError, this.config.retryDelayMs),
    };
  }
}
