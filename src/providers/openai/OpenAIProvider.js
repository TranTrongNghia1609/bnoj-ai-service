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

  async _callApi(messages, modelName, _stage, options = {}) {
    const client = this._getClient();
    const maxTokens = options?.maxTokens || this.config.maxTokens || 8192;
    const requestPayload = {
      model: modelName,
      messages,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: maxTokens,
    };

    let completion;
    if (options?.responseFormat === 'json') {
      try {
        completion = await client.chat.completions.create({
          ...requestPayload,
          response_format: { type: 'json_object' },
        });
      } catch (formatErr) {
        // Many third-party OpenAI proxies reject response_format with 400 Bad Request
        if (String(formatErr?.message || '').toLowerCase().includes('response_format') || formatErr?.status === 400) {
          console.warn(`[OpenAIProvider] Proxy/Model "${modelName}" does not support response_format. Retrying without it...`);
          completion = await client.chat.completions.create(requestPayload);
        } else {
          throw formatErr;
        }
      }
    } else {
      completion = await client.chat.completions.create(requestPayload);
    }

    const choice = completion.choices?.[0];
    const content = choice?.message?.content;
    const finishReason = choice?.finish_reason || null;

    if (!content) {
      throw new Error('OpenAI returned an empty response');
    }

    if (finishReason === 'length' || finishReason === 'max_tokens') {
      console.warn(`[OpenAIProvider] Output truncated by token limit (finish_reason=${finishReason}, model=${modelName}, max_tokens=${maxTokens})`);
    }

    return { text: content, finishReason };
  }
}
