import OpenAI from 'openai';
import { ProviderBase } from '../ProviderBase.js';
import { ConfigError } from '../../core/errors.js';
import { buildDraftMessages, buildRefinerMessages } from '../shared/promptBuilder.js';

export class OpenAIProvider extends ProviderBase {
  constructor(config) {
    super('openai', config);
    this.client = null;
  }

  validateConfig() {
    super.validateConfig();

    if (!this.config?.apiKey) {
      throw new ConfigError('OPENAI_API_KEY is required for OpenAIProvider');
    }

    if (!this.config?.model) {
      throw new ConfigError('OPENAI_MODEL is required for OpenAIProvider');
    }
  }

  // ---------------------------------------------------------------------------
  // Lazy client initialisation
  // ---------------------------------------------------------------------------

  _getClient() {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        ...(this.config.baseURL ? { baseURL: this.config.baseURL } : {}),
      });
    }
    return this.client;
  }

  // ---------------------------------------------------------------------------
  // Prompt building — returns an OpenAI messages array
  // ---------------------------------------------------------------------------

  _buildPrompt(request, options = {}) {
    const stage = String(options?.stage || 'draft').toLowerCase();
    return stage === 'refiner'
      ? buildRefinerMessages(request, options?.draftHint)
      : buildDraftMessages(request);
  }

  // ---------------------------------------------------------------------------
  // API call — delegates to openai v4 SDK
  // ---------------------------------------------------------------------------

  async _callApi(messages, modelName, _stage) {
    const client = this._getClient();

    const completion = await client.chat.completions.create({
      model: modelName,
      messages,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 2048,
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty response');
    }
    return content;
  }
}
