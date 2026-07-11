import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProviderBase } from '../ProviderBase.js';
import { ConfigError } from '../../core/errors.js';
import { buildDraftPrompt, buildRefinerPrompt } from '../shared/promptBuilder.js';

export class GeminiProvider extends ProviderBase {
  constructor(config) {
    super('gemini', config);
    this.client = null;
    this.models = new Map();
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

  // ---------------------------------------------------------------------------
  // Prompt building — returns a raw text string for Gemini's generateContent()
  // ---------------------------------------------------------------------------

  _buildPrompt(request, options = {}) {
    const stage = String(options?.stage || 'draft').toLowerCase();
    return stage === 'refiner'
      ? buildRefinerPrompt(request, options?.draftHint)
      : buildDraftPrompt(request);
  }

  // ---------------------------------------------------------------------------
  // Lazy model initialisation
  // ---------------------------------------------------------------------------

  _getModel(modelName, options = {}) {
    if (!this.client) {
      this.client = new GoogleGenerativeAI(this.config.apiKey);
    }

    const generationConfig = {
      maxOutputTokens: options?.maxTokens || this.config.maxTokens || 8192,
      temperature: this.config.temperature ?? 0.7,
      ...(options?.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
    };

    const cacheKey = `${modelName}:${JSON.stringify(generationConfig)}`;
    if (this.models.has(cacheKey)) {
      return this.models.get(cacheKey);
    }

    const model = this.client.getGenerativeModel({
      model: modelName,
      generationConfig,
    });
    this.models.set(cacheKey, model);
    return model;
  }

  // ---------------------------------------------------------------------------
  // API call — delegates to @google/generative-ai
  // ---------------------------------------------------------------------------

  async _callApi(prompt, modelName, _stage, options = {}) {
    const model = this._getModel(modelName, options);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const finishReason = response.candidates?.[0]?.finishReason || null;

    if (finishReason === 'MAX_TOKENS') {
      console.warn(`[GeminiProvider] Output truncated by token limit (finishReason=${finishReason}, model=${modelName})`);
    }

    return { text, finishReason };
  }
}
