/**
 * CircuitBreaker – Bảo vệ hệ thống khi Gemini API lỗi liên tục.
 *
 * States:
 *   CLOSED   – hoạt động bình thường, cho phép mọi request
 *   OPEN     – ngắt mạch, reject ngay lập tức (trả fallback)
 *   HALF_OPEN – cho phép 1 request thử, nếu OK → CLOSED, nếu fail → OPEN
 */

const STATE = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

export class CircuitBreaker {
  /**
   * @param {Object} options
   * @param {number} options.failureThreshold – Số lỗi liên tiếp trước khi mở circuit (default: 5)
   * @param {number} options.resetTimeoutMs   – Thời gian circuit OPEN trước khi thử lại (default: 60000ms)
   * @param {number} options.monitorWindowMs  – Cửa sổ thời gian đếm lỗi (default: 120000ms)
   */
  constructor({
    failureThreshold = 5,
    resetTimeoutMs = 60000,
    monitorWindowMs = 120000,
  } = {}) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.monitorWindowMs = monitorWindowMs;

    this.state = STATE.CLOSED;
    this.failures = [];          // timestamps of recent failures
    this.lastOpenedAt = null;
    this.halfOpenInFlight = false;
  }

  /**
   * Thực thi `fn` thông qua circuit breaker.
   *
   * @param {() => Promise<T>} fn – async function gọi API
   * @returns {Promise<{ result: T|null, circuitOpen: boolean }>}
   */
  async execute(fn) {
    // Prune old failures ngoài monitoring window
    const now = Date.now();
    this.failures = this.failures.filter((t) => now - t < this.monitorWindowMs);

    // STATE: OPEN
    if (this.state === STATE.OPEN) {
      if (now - this.lastOpenedAt >= this.resetTimeoutMs) {
        this.state = STATE.HALF_OPEN;
        console.log('[CircuitBreaker] Transitioning OPEN → HALF_OPEN');
      } else {
        return { result: null, circuitOpen: true };
      }
    }

    // STATE: HALF_OPEN – chỉ cho 1 request thử
    if (this.state === STATE.HALF_OPEN) {
      if (this.halfOpenInFlight) {
        return { result: null, circuitOpen: true };
      }
      this.halfOpenInFlight = true;
    }

    try {
      const result = await fn();
      this._onSuccess();
      return { result, circuitOpen: false };
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  /** @private */
  _onSuccess() {
    if (this.state === STATE.HALF_OPEN) {
      console.log('[CircuitBreaker] HALF_OPEN request succeeded → CLOSED');
    }
    this.state = STATE.CLOSED;
    this.failures = [];
    this.halfOpenInFlight = false;
  }

  /** @private */
  _onFailure() {
    this.halfOpenInFlight = false;
    this.failures.push(Date.now());

    if (this.state === STATE.HALF_OPEN) {
      this.state = STATE.OPEN;
      this.lastOpenedAt = Date.now();
      console.warn('[CircuitBreaker] HALF_OPEN request failed → OPEN');
      return;
    }

    // Prune + check threshold
    const now = Date.now();
    this.failures = this.failures.filter((t) => now - t < this.monitorWindowMs);

    if (this.failures.length >= this.failureThreshold) {
      this.state = STATE.OPEN;
      this.lastOpenedAt = now;
      console.warn(
        `[CircuitBreaker] ${this.failures.length} failures in ${this.monitorWindowMs}ms → OPEN (reset after ${this.resetTimeoutMs}ms)`
      );
    }
  }

  get currentState() {
    return this.state;
  }

  get recentFailureCount() {
    const now = Date.now();
    return this.failures.filter((t) => now - t < this.monitorWindowMs).length;
  }
}
