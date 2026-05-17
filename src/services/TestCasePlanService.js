import {
  buildTestCasePlanPrompt,
  buildTestCasePlanMessages,
} from '../providers/shared/testCasePlanPromptBuilder.js';

const VALID_CATEGORIES = ['normal', 'edge', 'boundary', 'stress'];

/**
 * TestCasePlanService
 *
 * Calls the draft provider and parses the grouped JSON response into an
 * array of category groups — each with a category name, a count, and a
 * description of what those tests should cover. No individual test cases.
 */
export class TestCasePlanService {
  /**
   * @param {Object} options
   * @param {Object} options.draftProvider – ProviderBase instance
   */
  constructor({ draftProvider }) {
    this.draftProvider = draftProvider;
  }

  /**
   * @param {Object} requestData
   * @param {string} requestData.statement
   * @param {string} requestData.inputConstraint
   * @param {string} requestData.outputConstraint
   * @param {number} requestData.numberOfTestCases
   * @returns {Promise<{ categories: Array, source: string, model: string|null }>}
   */
  async generate(requestData) {
    const prompt = this.draftProvider.name === 'openai'
      ? buildTestCasePlanMessages(requestData)
      : buildTestCasePlanPrompt(requestData);

    let result;
    try {
      result = await this.draftProvider.generate(prompt, { stage: 'draft' });
    } catch (err) {
      console.error('[TestCasePlanService] Provider call failed:', err);
      return { categories: this._fallback('PROVIDER_ERROR', err.message), source: 'fallback', model: null };
    }

    if (!result?.ok || !String(result?.text || '').trim()) {
      console.warn('[TestCasePlanService] Non-ok result:', result?.errorType);
      return { categories: this._fallback(result?.errorType || 'GENERATION_FAILED'), source: 'fallback', model: result?.model || null };
    }

    const raw = this._stripFences(String(result.text).trim());
    console.log(`[TestCasePlanService] Raw response (first 300 chars): ${raw.slice(0, 300)}`);

    try {
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        throw new Error('AI response is not a JSON array');
      }

      const categories = parsed.map((group) => ({
        category: this._normalizeCategory(group.category),
        count: Math.max(1, Math.floor(Number(group.count) || 1)),
        description: String(group.description || '').slice(0, 1000),
      }));

      const total = categories.reduce((sum, g) => sum + g.count, 0);
      console.log(`[TestCasePlanService] ${categories.length} groups, ${total} total | provider=${this.draftProvider.name}`);

      return { categories, source: `${this.draftProvider.name}:draft`, model: result.model };
    } catch (parseErr) {
      console.error('[TestCasePlanService] JSON parse failed:', parseErr.message);
      return { categories: this._fallback('JSON_PARSE_FAILED'), source: 'fallback', model: result?.model || null };
    }
  }

  _stripFences(text) {
    return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  _normalizeCategory(value) {
    const cat = String(value || '').toLowerCase();
    return VALID_CATEGORIES.includes(cat) ? cat : 'normal';
  }

  _fallback(errorType, detail = '') {
    return [
      {
        category: 'normal',
        count: 1,
        description: detail || `AI could not generate test case plan (${errorType}). Please try again.`,
      },
    ];
  }
}
