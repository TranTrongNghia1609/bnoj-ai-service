import { ConfigError } from '../core/errors.js';

export class ProviderBase {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  validateConfig() {
    if (!this.name) {
      throw new ConfigError('Provider name is required');
    }
  }

  async generateHint(_request, _options = {}) {
    throw new Error('generateHint must be implemented by provider');
  }
}
