/**
 * ConcurrencyLimiter – Semaphore pattern
 *
 * Giới hạn số task async chạy đồng thời.
 * Các task vượt quá giới hạn sẽ chờ trong hàng đợi FIFO.
 */
export class ConcurrencyLimiter {
  /**
   * @param {number} maxConcurrent – Số task tối đa chạy cùng lúc (default: 3)
   */
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
    this.running = 0;
    this.queue = [];
  }

  /**
   * Thực thi `fn` với giới hạn concurrency.
   * Nếu đã đạt giới hạn, request sẽ chờ đến khi có slot trống.
   *
   * @param {() => Promise<T>} fn – async function cần thực thi
   * @returns {Promise<T>}
   */
  async run(fn) {
    if (this.running >= this.maxConcurrent) {
      await new Promise((resolve) => this.queue.push(resolve));
    }

    this.running += 1;

    try {
      return await fn();
    } finally {
      this.running -= 1;
      this._dequeue();
    }
  }

  /** @private */
  _dequeue() {
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const next = this.queue.shift();
      next();
    }
  }

  /** Số task đang chạy */
  get activeCount() {
    return this.running;
  }

  /** Số task đang chờ trong queue */
  get pendingCount() {
    return this.queue.length;
  }
}
