import Anthropic from '@anthropic-ai/sdk';
import { ProviderBase } from '../ProviderBase.js';
import { ConfigError } from '../../core/errors.js';
import { buildDraftMessages, buildRefinerMessages } from '../shared/promptBuilder.js';

export class AnthropicProvider extends ProviderBase {
  constructor(config) {
    super('anthropic', config);
    this.client = null;
  }

  validateConfig() {
    super.validateConfig();

    if (!this.config?.apiKey) {
      throw new ConfigError('ANTHROPIC_API_KEY is required for AnthropicProvider');
    }

    if (!this.config?.model) {
      throw new ConfigError('ANTHROPIC_MODEL is required for AnthropicProvider');
    }
  }

  // ---------------------------------------------------------------------------
  // Lazy client initialisation
  // ---------------------------------------------------------------------------

  _getClient() {
    if (!this.client) {
      // @anthropic-ai/sdk automatically appends "/v1/messages" when making API requests.
      // If baseURL ends with "/v1", stripping it prevents paths like "/v1/v1/messages".
      const baseURL = this.config.baseURL
        ? String(this.config.baseURL).replace(/\/v1\/?$/, '')
        : undefined;

      this.client = new Anthropic({
        apiKey: this.config.apiKey,
        ...(baseURL ? { baseURL } : {}),
      });
    }
    return this.client;
  }

  // ---------------------------------------------------------------------------
  // Prompt building — returns a messages array
  // ---------------------------------------------------------------------------

  _buildPrompt(request, options = {}) {
    const stage = String(options?.stage || 'draft').toLowerCase();
    return stage === 'refiner'
      ? buildRefinerMessages(request, options?.draftHint)
      : buildDraftMessages(request);
  }

  // ---------------------------------------------------------------------------
  // Normalize messages for Anthropic messages API
  // 1. Extract system prompt (Anthropic forbids role: 'system' inside messages array)
  // 2. Ensure the first message has role: 'user'
  // 3. Merge consecutive turns with the same role (user/user or assistant/assistant)
  // ---------------------------------------------------------------------------

  _normalizeMessages(rawMessages, options = {}) {
    let systemPrompt = '';
    const rawList = Array.isArray(rawMessages)
      ? rawMessages
      : [{ role: 'user', content: String(rawMessages || '') }];

    const filtered = [];
    for (const msg of rawList) {
      if (!msg) continue;
      const role = String(msg.role || 'user').toLowerCase();
      const content = String(msg.content || '');

      if (role === 'system') {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${content}` : content;
      } else if (role === 'user' || role === 'assistant') {
        filtered.push({ role, content });
      }
    }

    if (options?.responseFormat === 'json') {
      const jsonInstruction = 'IMPORTANT: Return strictly valid JSON ONLY, without any markdown formatting, code fences (```json), or extra commentary.';
      systemPrompt = systemPrompt ? `${systemPrompt}\n\n${jsonInstruction}` : jsonInstruction;
    }

    // Anthropic requires the first message in the array to be from 'user'
    while (filtered.length > 0 && filtered[0].role !== 'user') {
      filtered.shift();
    }

    // Merge consecutive messages of the same role
    const merged = [];
    for (const item of filtered) {
      if (merged.length === 0) {
        merged.push({ role: item.role, content: item.content });
      } else {
        const last = merged[merged.length - 1];
        if (last.role === item.role) {
          last.content = `${last.content}\n\n${item.content}`;
        } else {
          merged.push({ role: item.role, content: item.content });
        }
      }
    }

    if (merged.length === 0) {
      merged.push({ role: 'user', content: 'Please assist.' });
    }

    return { systemPrompt, messages: merged };
  }

  // ---------------------------------------------------------------------------
  // API call — delegates to @anthropic-ai/sdk
  // ---------------------------------------------------------------------------

  async _callApi(rawMessages, modelName, _stage, options = {}) {
    const client = this._getClient();
    const maxTokens = options?.maxTokens || this.config.maxTokens || 4096;
    const { systemPrompt, messages } = this._normalizeMessages(rawMessages, options);

    const requestPayload = {
      model: modelName,
      messages,
      max_tokens: maxTokens,
      temperature: this.config.temperature ?? 0.7,
      ...(systemPrompt ? { system: systemPrompt } : {}),
    };

    let completion;
    try {
      completion = await client.messages.create(requestPayload);
    } catch (apiErr) {
      console.error(`[AnthropicProvider] API error: ${apiErr.message}`, apiErr?.status);
      throw apiErr;
    }

    // Extract text from content blocks
    const textBlocks = Array.isArray(completion.content)
      ? completion.content.filter((block) => block.type === 'text')
      : [];
    const content = textBlocks.map((block) => block.text).join('\n');
    const finishReason = completion.stop_reason || null;

    if (!content) {
      throw new Error('Anthropic returned an empty response');
    }

    if (finishReason === 'max_tokens') {
      console.warn(`[AnthropicProvider] Output truncated by token limit (stop_reason=${finishReason}, model=${modelName}, max_tokens=${maxTokens})`);
    }

    return { text: content, finishReason };
  }
}
