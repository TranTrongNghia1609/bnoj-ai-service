import { ConfigError } from '../core/errors.js';
import { AnthropicProvider } from './anthropic/AnthropicProvider.js';
import { GeminiProvider } from './gemini/GeminiProvider.js';
import { OpenAIProvider } from './openai/OpenAIProvider.js';

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

    this.register('anthropic', (overrides = {}) => new AnthropicProvider({
      ...this.config.anthropic,
      ...overrides,
    }));

    this.register('openai', (overrides = {}) => new OpenAIProvider({
      ...this.config.openai,
      ...overrides,
    }));
  }

  /**
   * Register a custom provider factory.
   *
   * @param {string}   name    – provider identifier (case-insensitive)
   * @param {Function} factory – (overrides) => ProviderBase instance
   */
  register(name, factory) {
    this.providers.set(String(name).toLowerCase(), factory);
  }

  /**
   * Instantiate and validate a provider by name.
   *
   * @param {string} name      – provider identifier
   * @param {Object} overrides – config overrides merged on top of the registered base config
   * @returns {ProviderBase}
   */
  getProvider(name, overrides = {}) {
    const providerName = String(name || '').toLowerCase();
    const factory = this.providers.get(providerName);

    if (!factory) {
      throw new ConfigError(
        `Unsupported provider: "${providerName}". Registered providers: ${[...this.providers.keys()].join(', ')}`
      );
    }

    const provider = factory(overrides);
    provider.validateConfig();
    return provider;
  }

  /**
   * Return the active provider using pipeline stage config.
   * Automatically picks the correct override block (gemini vs openai options).
   *
   * @param {Object} [stageConfig] – a pipeline stage entry from providerConfig.pipeline.*
   * @returns {ProviderBase}
   */
  getStageProvider(stageConfig = {}) {
    const providerName = String(
      stageConfig.provider || this.config.activeProvider || ''
    ).toLowerCase();

    // Pick the right options block for this provider
    const overrides = providerName === 'openai'
      ? (stageConfig.openaiOptions || {})
      : providerName === 'anthropic'
        ? (stageConfig.anthropicOptions || {})
        : (stageConfig.options || {});

    return this.getProvider(providerName, overrides);
  }

  /**
   * Return the default active provider (no pipeline stage overrides).
   *
   * @returns {ProviderBase}
   */
  getActiveProvider() {
    const activeProviderName = String(this.config.activeProvider || '').toLowerCase();
    return this.getProvider(activeProviderName);
  }
}
