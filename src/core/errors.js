export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ProviderError';
    this.errorType = options.errorType || 'GENERATION_FAILED';
    this.retryAfterMs = options.retryAfterMs || null;
    this.cause = options.cause || null;
  }
}
