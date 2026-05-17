import { MESSAGE_SCHEMA_VERSION } from '../../core/types.js';

/**
 * TestCasePlanHandler
 *
 * Consumes messages from the `test-case-plan-request` Kafka topic,
 * delegates to TestCasePlanService, and returns a response payload
 * that the KafkaService will publish to `test-case-plan-response`.
 */
export class TestCasePlanHandler {
  /**
   * @param {Object} options
   * @param {import('../../services/TestCasePlanService.js').TestCasePlanService} options.testCasePlanService
   */
  constructor({ testCasePlanService }) {
    this.testCasePlanService = testCasePlanService;
  }

  /**
   * Normalize the raw Kafka message payload into the shape the service expects.
   */
  normalizeRequest(payload) {
    const request = payload?.payload && typeof payload.payload === 'object'
      ? payload.payload
      : payload;

    const n = Number(request?.numberOfTestCases);
    const numberOfTestCases = Number.isFinite(n) && n >= 1 && n <= 50 ? n : 5;

    return {
      workflowId: request?.workflowId || null,
      userId: request?.userId || null,
      statement: request?.statement || '',
      inputConstraint: request?.inputConstraint || '',
      outputConstraint: request?.outputConstraint || '',
      numberOfTestCases,
    };
  }

  /**
   * Main Kafka message handler.
   * Called by KafkaService with the raw message Buffer.
   *
   * @param {Buffer} messageValue
   * @returns {Promise<Object>} — response payload for `test-case-plan-response` topic
   */
  async handleKafkaMessage(messageValue) {
    const parsed = JSON.parse(messageValue.toString());
    const requestData = this.normalizeRequest(parsed);

    if (!requestData.workflowId || !requestData.userId) {
      throw new Error(
        'Invalid test-case-plan-request payload: missing required fields (workflowId, userId)'
      );
    }

    if (!requestData.statement) {
      throw new Error(
        'Invalid test-case-plan-request payload: statement is required'
      );
    }

    const generated = await this.testCasePlanService.generate(requestData);

    return {
      schemaVersion: MESSAGE_SCHEMA_VERSION,
      workflowId: requestData.workflowId,
      userId: requestData.userId,
      categories: generated.categories,
      source: generated.source,
      model: generated.model,
      generatedAt: new Date().toISOString(),
    };
  }
}
