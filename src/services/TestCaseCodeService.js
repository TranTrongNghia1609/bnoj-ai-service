import {
  buildTestCaseCodePrompt,
  buildTestCaseCodeMessages,
} from '../providers/shared/testCaseCodePromptBuilder.js';

/**
 * TestCaseCodeService
 *
 * Calls the draft provider to generate Python input-generation and
 * output/solution code. Parses the JSON response into { inputCode, outputCode }.
 */
export class TestCaseCodeService {
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
   * @param {Array}  requestData.categories
   * @param {string} [requestData.feedback]
   * @param {string} [requestData.previousInputCode]
   * @param {string} [requestData.previousOutputCode]
   * @returns {Promise<{ inputCode: string, outputCode: string, source: string, model: string|null }>}
   */
  async generate(requestData) {
    const prompt = this.draftProvider.name === 'openai'
      ? buildTestCaseCodeMessages(requestData)
      : buildTestCaseCodePrompt(requestData);

    let result;
    try {
      result = await this.draftProvider.generate(prompt, { stage: 'draft' });
    } catch (err) {
      console.error('[TestCaseCodeService] Provider call failed:', err);
      return this._fallbackResponse('PROVIDER_ERROR', err.message);
    }

    if (!result?.ok || !String(result?.text || '').trim()) {
      console.warn('[TestCaseCodeService] Non-ok result:', result?.errorType);
      return this._fallbackResponse(result?.errorType || 'GENERATION_FAILED', null, result?.model);
    }

    const raw = this._stripFences(String(result.text).trim());
    console.log(`[TestCaseCodeService] Raw response (first 300 chars): ${raw.slice(0, 300)}`);

    try {
      const parsed = JSON.parse(raw);

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('AI response is not a JSON object');
      }

      const inputCode = String(parsed.inputCode || '').trim();
      const outputCode = String(parsed.outputCode || '').trim();

      if (!inputCode && !outputCode) {
        console.warn('[TestCaseCodeService] Both inputCode and outputCode are empty');
        return this._fallbackResponse('EMPTY_CODE', null, result.model);
      }

      console.log(
        `[TestCaseCodeService] inputCode=${inputCode.length} chars, outputCode=${outputCode.length} chars | provider=${this.draftProvider.name}`
      );

      return {
        inputCode,
        outputCode,
        source: `${this.draftProvider.name}:draft`,
        model: result.model,
      };
    } catch (parseErr) {
      console.error('[TestCaseCodeService] JSON parse failed:', parseErr.message);
      return this._fallbackResponse('JSON_PARSE_FAILED', null, result?.model);
    }
  }

  _stripFences(text) {
    return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  _fallbackResponse(errorType, detail = '', model = null) {
    return {
      inputCode: '',
      outputCode: '',
      source: 'fallback',
      model,
      error: detail || `AI could not generate code (${errorType}). Please try again.`,
    };
  }
}
