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
    const basePrompt = this.draftProvider.name === 'openai'
      ? buildTestCasePlanMessages(requestData)
      : buildTestCasePlanPrompt(requestData);

    const maxAttempts = 2;
    let lastParseError = null;
    let lastResult = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const prompt = attempt === 1 ? basePrompt : this._appendRetryReminder(basePrompt, lastParseError?.message);
      const maxTokens = attempt === 1 ? 4096 : 8192;

      let result;
      try {
        result = await this.draftProvider.generate(prompt, {
          stage: 'draft',
          responseFormat: 'json',
          maxTokens,
        });
      } catch (err) {
        console.error(`[TestCasePlanService] Provider call failed (attempt ${attempt}):`, err);
        if (attempt >= maxAttempts) {
          return { categories: this._fallback('PROVIDER_ERROR', err.message), source: 'fallback', model: null };
        }
        continue;
      }

      lastResult = result;

      if (!result?.ok || !String(result?.text || '').trim()) {
        console.warn(`[TestCasePlanService] Non-ok result (attempt ${attempt}):`, result?.errorType);
        if (attempt >= maxAttempts) {
          return { categories: this._fallback(result?.errorType || 'GENERATION_FAILED'), source: 'fallback', model: result?.model || null };
        }
        continue;
      }

      const raw = this._stripFences(String(result.text).trim());
      console.log(`[TestCasePlanService] Raw response (attempt ${attempt}, length=${raw.length}, first 300 chars): ${raw.slice(0, 300)}`);

      try {
        const parsed = this._tryParseAndClean(raw);

        if (!Array.isArray(parsed)) {
          throw new Error('AI response is not a JSON array');
        }

        const categories = parsed.map((group) => ({
          category: this._normalizeCategory(group.category),
          count: Math.max(1, Math.floor(Number(group.count) || 1)),
          description: String(group.description || '').slice(0, 1000),
        }));

        const total = categories.reduce((sum, g) => sum + g.count, 0);
        console.log(`[TestCasePlanService] ${categories.length} groups, ${total} total | provider=${this.draftProvider.name} (attempt ${attempt})`);

        return { categories, source: `${this.draftProvider.name}:draft`, model: result.model };
      } catch (parseErr) {
        lastParseError = parseErr;
        console.warn(`[TestCasePlanService] JSON parse failed on attempt ${attempt}/${maxAttempts}: ${parseErr.message}`);

        if (attempt < maxAttempts) {
          console.warn('[TestCasePlanService] Retrying generation with higher maxTokens (8192)...');
        }
      }
    }

    console.error('[TestCasePlanService] All attempts failed to produce valid JSON array:', lastParseError?.message);
    return { categories: this._fallback('JSON_PARSE_FAILED', lastParseError?.message), source: 'fallback', model: lastResult?.model || null };
  }

  _tryParseAndClean(raw) {
    try {
      return JSON.parse(raw);
    } catch (firstErr) {
      const cleaned = raw.replace(/,\s*([\]}])/g, '$1');
      try {
        return JSON.parse(cleaned);
      } catch (secondErr) {
        throw firstErr;
      }
    }
  }

  _appendRetryReminder(basePrompt, errorMessage) {
    const reminder = `\n\nIMPORTANT REMINDER: Your previous attempt failed to parse as valid JSON (${errorMessage || 'syntax error'}). Ensure your response is ONE complete, valid JSON array. Start with [ and end with ]. Do NOT cut off or output any text outside the JSON array.`;

    if (Array.isArray(basePrompt)) {
      return [
        ...basePrompt.slice(0, -1),
        {
          ...basePrompt[basePrompt.length - 1],
          content: `${basePrompt[basePrompt.length - 1].content}${reminder}`,
        },
      ];
    }
    return `${basePrompt}${reminder}`;
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
