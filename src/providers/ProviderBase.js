import { ConfigError } from '../core/errors.js';
import { CircuitBreaker } from '../core/CircuitBreaker.js';
import {
  classifyError,
  getSafeErrorMessage,
  isRetryableError,
  parseRetryDelayMs,
} from './shared/errorUtils.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Abstract base class for all AI providers.
 *
 * Concrete providers must implement:
 *   - validateConfig()   – throw ConfigError for missing/invalid config
 *   - _callApi(prompt, modelName, stage)  – call the underlying API and return the raw text
 *
 * Optionally override:
 *   - _buildPrompt(request, options)  – return the prompt to send (text or messages array)
 *   - _classifyError(error)           – map errors to ERROR_TYPES
 *   - _isRetryable(error)             – decide if an error is worth retrying
 *   - _parseRetryDelayMs(error)       – extract retry delay from error
 */
export class ProviderBase {
  /**
   * @param {string} name      – human-readable provider name (e.g. 'gemini', 'openai')
   * @param {Object} config    – provider-specific config (apiKey, model, maxRetries, etc.)
   */
  constructor(name, config) {
    this.name = name;
    this.config = config;

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: config?.circuitBreakerFailures || 5,
      resetTimeoutMs: config?.circuitBreakerResetMs || 60000,
      monitorWindowMs: config?.circuitBreakerWindowMs || 120000,
    });
  }

  // ---------------------------------------------------------------------------
  // To be implemented by concrete providers
  // ---------------------------------------------------------------------------

  validateConfig() {
    if (!this.name) {
      throw new ConfigError('Provider name is required');
    }
  }

  /**
   * Perform the actual API call.
   * Return the generated text string (not an object).
   *
   * @param {string|Array} prompt     – text string or messages array depending on provider
   * @param {string}       modelName  – model identifier to use
   * @param {string}       stage      – 'draft' | 'refiner'
   * @returns {Promise<string>}
   */
  async _callApi(_prompt, _modelName, _stage) {
    throw new Error(`${this.name}: _callApi() must be implemented`);
  }

  /**
   * Build the prompt to send to `_callApi`.
   * Default: subclasses override this to return text or messages array.
   *
   * @param {Object} request
   * @param {Object} options  – { stage, draftHint, ... }
   * @returns {string|Array}
   */
  _buildPrompt(_request, _options) {
    throw new Error(`${this.name}: _buildPrompt() must be implemented`);
  }

  // ---------------------------------------------------------------------------
  // Error helpers — override in subclass for provider-specific behaviour
  // ---------------------------------------------------------------------------

  _classifyError(error) {
    return classifyError(error);
  }

  _isRetryable(error) {
    return isRetryableError(error);
  }

  _parseRetryDelayMs(error) {
    return parseRetryDelayMs(error, this.config?.retryDelayMs);
  }

  // ---------------------------------------------------------------------------
  // Shared generateHint — retry loop + circuit breaker (do not override)
  // ---------------------------------------------------------------------------

  /**
   * Generate a hint for the given request.
   *
   * @param {Object} request   – normalized request from RequestHandler
   * @param {Object} [options] – { stage, draftHint, model, prompt }
   * @returns {Promise<{ok, hint, model, stage, errorType?, errorMessage?, retryAfterMs?}>}
   */
  async generateHint(request, options = {}) {
    const stage = String(options?.stage || 'draft').toLowerCase();
    const modelName = String(options?.model || this.config?.model || '').trim();

    if (!modelName) {
      return {
        ok: false,
        hint: null,
        model: null,
        stage,
        errorType: 'CONFIG_ERROR',
        errorMessage: `${this.name}: model is not configured`,
        retryAfterMs: 0,
      };
    }

    const prompt = options?.prompt ?? this._buildPrompt(request, options);

    const maxRetries = Math.max(0, this.config?.maxRetries ?? 0);
    const maxAttempts = maxRetries + 1;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const cbResult = await this.circuitBreaker.execute(() =>
          this._callApi(prompt, modelName, stage)
        );

        if (cbResult.circuitOpen) {
          console.warn(`[${this.name}] Circuit OPEN – skipping ${stage} stage (attempt ${attempt})`);
          return {
            ok: false,
            hint: null,
            model: modelName,
            stage,
            errorType: 'CIRCUIT_OPEN',
            errorMessage: `${this.name} circuit breaker is open due to repeated failures`,
            retryAfterMs: this.circuitBreaker.resetTimeoutMs || 60000,
          };
        }

        return {
          ok: true,
          hint: cbResult.result,
          model: modelName,
          stage,
        };
      } catch (error) {
        lastError = error;
        const retryable = this._isRetryable(error);

        if (!retryable || attempt >= maxAttempts) {
          console.warn(
            `[${this.name}] ${stage} failed (attempt ${attempt}/${maxAttempts}): ${getSafeErrorMessage(error)}`
          );
          break;
        }

        const retryDelayMs = this._parseRetryDelayMs(error);
        console.warn(
          `[${this.name}] ${stage} attempt ${attempt}/${maxAttempts} failed (retryable). Retrying in ${retryDelayMs}ms...`
        );
        await sleep(retryDelayMs);
      }
    }

    return {
      ok: false,
      hint: null,
      model: modelName,
      stage,
      errorType: this._classifyError(lastError),
      errorMessage: getSafeErrorMessage(lastError),
      retryAfterMs: this._parseRetryDelayMs(lastError),
    };
  }
}
