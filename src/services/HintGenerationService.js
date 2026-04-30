const DEFAULT_SKIP_REFINER_MIN_LENGTH = 200;

export class HintGenerationService {
  /**
   * @param {Object} options
   * @param {Object} options.draftProvider
   * @param {Object} options.refinerProvider
   * @param {Object} options.fallbackHintService
   * @param {number} [options.skipRefinerMinLength] – Ngưỡng ký tự để skip refiner (default: 200)
   */
  constructor({ draftProvider, refinerProvider, fallbackHintService, skipRefinerMinLength }) {
    this.draftProvider = draftProvider;
    this.refinerProvider = refinerProvider;
    this.fallbackHintService = fallbackHintService;
    this.skipRefinerMinLength = Math.max(
      50,
      Number.isFinite(skipRefinerMinLength) ? skipRefinerMinLength : DEFAULT_SKIP_REFINER_MIN_LENGTH
    );
  }

  /**
   * Kiểm tra draft hint có đủ chất lượng để skip refiner không.
   * Điều kiện: đủ dài + có ít nhất 1 markdown heading (###, ##, #).
   */
  _isDraftSufficientQuality(draftHint) {
    const text = String(draftHint || '').trim();
    if (text.length < this.skipRefinerMinLength) {
      return false;
    }
    // Có ít nhất 1 markdown heading
    return /^#{1,4}\s+.+/m.test(text);
  }

  async generate(requestData) {
    try {
      let draftResult;

      try {
        draftResult = await this.draftProvider.generateHint(requestData, {
          stage: 'draft',
        });
      } catch (draftError) {
        console.error('[HintGenerationService] draft stage crashed:', draftError);
        draftResult = {
          ok: false,
          hint: null,
          model: null,
          errorType: 'DRAFT_FAILED',
        };
      }

      const hasDraftHint = Boolean(String(draftResult?.hint || '').trim());
      if (!draftResult?.ok || !hasDraftHint) {
        return {
          hint: this.fallbackHintService.buildHint(requestData, {
            ...draftResult,
            errorType: draftResult?.errorType || 'DRAFT_FAILED',
          }),
          source: 'fallback',
          model: draftResult?.model || null,
          errorType: draftResult?.errorType || 'DRAFT_FAILED',
        };
      }

      // --- Smart Refiner Skip ---
      // Skip refiner khi:
      //   1. Draft đủ dài + có markdown heading, HOẶC
      //   2. Request là follow-up (context đã rõ, không cần refine thêm)
      const isFollowUp = requestData?.failedReason === 'FOLLOW_UP_REQUEST';
      const draftGoodEnough = this._isDraftSufficientQuality(draftResult.hint);

      if (isFollowUp || draftGoodEnough) {
        const skipReason = isFollowUp ? 'follow-up request' : 'draft quality sufficient';
        console.log(`[HintGenerationService] Skipping refiner (${skipReason}), draft length=${String(draftResult.hint).length}`);

        return {
          hint: draftResult.hint,
          source: `${this.draftProvider.name}:draft-direct`,
          model: draftResult.model,
          errorType: null,
        };
      }

      // --- Refiner Stage ---
      let refinerResult;
      try {
        refinerResult = await this.refinerProvider.generateHint(requestData, {
          stage: 'refiner',
          draftHint: draftResult.hint,
        });
      } catch (refinerError) {
        console.warn('[HintGenerationService] refiner stage crashed, returning draft hint:', refinerError);
        refinerResult = {
          ok: false,
          hint: null,
          model: null,
          errorType: 'REFINER_FAILED_USING_DRAFT',
        };
      }

      const hasRefinedHint = Boolean(String(refinerResult?.hint || '').trim());
      if (refinerResult?.ok && hasRefinedHint) {
        return {
          hint: refinerResult.hint,
          source: `${this.refinerProvider.name}:refiner`,
          model: refinerResult.model,
          errorType: null,
        };
      }

      console.warn('[HintGenerationService] refiner failed, using draft hint', {
        refinerErrorType: refinerResult?.errorType || 'UNKNOWN',
        draftModel: draftResult?.model || null,
        refinerModel: refinerResult?.model || null,
      });

      return {
        hint: draftResult.hint,
        source: `${this.draftProvider.name}:draft-fallback`,
        model: draftResult?.model || null,
        errorType: null,
      };
    } catch (error) {
      console.error('[HintGenerationService] unexpected error:', error);

      return {
        hint: this.fallbackHintService.buildHint(requestData, {
          errorType: 'GENERATION_FAILED',
        }),
        source: 'fallback',
        model: null,
        errorType: 'GENERATION_FAILED',
      };
    }
  }
}
