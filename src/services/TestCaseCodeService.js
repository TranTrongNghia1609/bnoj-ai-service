import {
  buildTestCaseCodePrompt,
  buildTestCaseCodeMessages,
  buildTestCaseInputOnlyPrompt,
  buildTestCaseInputOnlyMessages,
} from '../providers/shared/testCaseCodePromptBuilder.js';

/**
 * TestCaseCodeService
 *
 * Calls the draft provider to generate Python input-generation and
 * output/solution code. Parses the JSON response into { inputCode, outputCode }.
 *
 * Supports two modes:
 *  - "ai" (default): generates both inputCode and outputCode
 *  - "user-solution": generates only inputCode (user provides their own solution)
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
   * @param {string} [requestData.mode] — "ai" (default) or "user-solution"
   * @param {string} [requestData.feedback]
   * @param {string} [requestData.previousInputCode]
   * @param {string} [requestData.previousOutputCode]
   * @returns {Promise<{ inputCode: string, outputCode: string, source: string, model: string|null }>}
   */
  async generate(requestData) {
    const isInputOnly = requestData.mode === 'user-solution';

    const basePrompt = isInputOnly
      ? (this.draftProvider.name === 'openai'
          ? buildTestCaseInputOnlyMessages(requestData)
          : buildTestCaseInputOnlyPrompt(requestData))
      : (this.draftProvider.name === 'openai'
          ? buildTestCaseCodeMessages(requestData)
          : buildTestCaseCodePrompt(requestData));

    const maxAttempts = 2;
    let lastParseError = null;
    let lastResult = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const prompt = attempt === 1 ? basePrompt : this._appendRetryReminder(basePrompt, lastParseError?.message);
      const maxTokens = attempt === 1 ? 8192 : 16384;

      let result;
      try {
        result = await this.draftProvider.generate(prompt, {
          stage: 'draft',
          responseFormat: 'json',
          maxTokens,
        });
      } catch (err) {
        console.error(`[TestCaseCodeService] Provider call failed (attempt ${attempt}):`, err);
        if (attempt >= maxAttempts) {
          return this._fallbackResponse('PROVIDER_ERROR', err.message);
        }
        continue;
      }

      lastResult = result;

      if (!result?.ok || !String(result?.text || '').trim()) {
        console.warn(`[TestCaseCodeService] Non-ok result (attempt ${attempt}):`, result?.errorType);
        if (attempt >= maxAttempts) {
          return this._fallbackResponse(result?.errorType || 'GENERATION_FAILED', null, result?.model);
        }
        continue;
      }

      const raw = this._stripFences(String(result.text).trim());
      console.log(`[TestCaseCodeService] Raw response (attempt ${attempt}, length=${raw.length}, first 300 chars): ${raw.slice(0, 300)}`);

      try {
        const parsed = this._tryParseAndClean(raw);

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('AI response is not a JSON object');
        }

        const inputCode = String(parsed.inputCode || '').trim();
        const outputCode = isInputOnly ? '' : String(parsed.outputCode || '').trim();

        if (!inputCode && (!isInputOnly && !outputCode)) {
          throw new Error('Both inputCode and outputCode are empty');
        }

        if (isInputOnly && !inputCode) {
          throw new Error('inputCode is empty in input-only mode');
        }

        console.log(
          `[TestCaseCodeService] mode=${isInputOnly ? 'user-solution' : 'ai'} | inputCode=${inputCode.length} chars, outputCode=${outputCode.length} chars | provider=${this.draftProvider.name} (attempt ${attempt})`
        );

        return {
          inputCode,
          outputCode,
          source: `${this.draftProvider.name}:draft`,
          model: result.model,
        };
      } catch (parseErr) {
        lastParseError = parseErr;
        console.warn(`[TestCaseCodeService] JSON parse failed on attempt ${attempt}/${maxAttempts}: ${parseErr.message}`);

        if (attempt < maxAttempts) {
          console.warn('[TestCaseCodeService] Retrying generation with higher maxTokens (16384)...');
        }
      }
    }

    console.error('[TestCaseCodeService] All attempts failed to produce valid JSON code:', lastParseError?.message);
    return this._fallbackResponse('JSON_PARSE_FAILED', lastParseError?.message, lastResult?.model);
  }

  _tryParseAndClean(raw) {
    try {
      return JSON.parse(raw);
    } catch (firstErr) {
      // Attempt cleanup: strip trailing commas before closing braces/brackets
      const cleaned = raw.replace(/,\s*([\]}])/g, '$1');
      try {
        return JSON.parse(cleaned);
      } catch (secondErr) {
        throw firstErr;
      }
    }
  }

  _appendRetryReminder(basePrompt, errorMessage) {
    const reminder = `\n\nIMPORTANT REMINDER: Your previous attempt failed to parse as valid JSON (${errorMessage || 'truncated output or syntax error'}). Ensure your response is ONE complete, valid JSON object with ALL strings properly escaped and terminated within the token limit. Start with { and end with }. Do NOT cut off mid-string.`;

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
