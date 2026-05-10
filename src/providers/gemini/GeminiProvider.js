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

  _getModel(modelName) {
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

  // ---------------------------------------------------------------------------
  // API call — delegates to @google/generative-ai
  // ---------------------------------------------------------------------------

  async _callApi(prompt, modelName, _stage) {
    const model = this._getModel(modelName);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }
}
