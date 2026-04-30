import { ConfigError } from '../core/errors.js';
import { GeminiProvider } from './gemini/GeminiProvider.js';

export class ProviderRegistry {
  constructor(config) {
    this.config = config;
    this.providers = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    this.register('gemini', (overrides = {}) => new GeminiProvider({
      ...this.config.gemini,
      ...overrides,
    }));
  }

  register(name, factory) {
    this.providers.set(String(name).toLowerCase(), factory);
  }

  getProvider(name, overrides = {}) {
    const providerName = String(name || '').toLowerCase();
    const factory = this.providers.get(providerName);

    if (!factory) {
      throw new ConfigError(`Unsupported provider: ${providerName}`);
    }

    const provider = factory(overrides);
    provider.validateConfig();
    return provider;
  }

  getActiveProvider() {
    const activeProviderName = String(this.config.activeProvider || '').toLowerCase();
    return this.getProvider(activeProviderName);
  }
}
