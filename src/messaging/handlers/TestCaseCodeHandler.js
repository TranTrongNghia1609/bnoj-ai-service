import { MESSAGE_SCHEMA_VERSION } from '../../core/types.js';

/**
 * TestCaseCodeHandler
 *
 * Consumes messages from the `test-case-code-request` Kafka topic,
 * delegates to TestCaseCodeService, and returns a response payload
 * that the KafkaService will publish to `test-case-code-response`.
 */
export class TestCaseCodeHandler {
  /**
   * @param {Object} options
   * @param {import('../../services/TestCaseCodeService.js').TestCaseCodeService} options.testCaseCodeService
   */
  constructor({ testCaseCodeService }) {
    this.testCaseCodeService = testCaseCodeService;
  }

  /**
   * Normalize the raw Kafka message payload into the shape the service expects.
   */
  normalizeRequest(payload) {
    const request = payload?.payload && typeof payload.payload === 'object'
      ? payload.payload
      : payload;

    return {
      workflowId: request?.workflowId || null,
      userId: request?.userId || null,
      statement: request?.statement || '',
      inputConstraint: request?.inputConstraint || '',
      outputConstraint: request?.outputConstraint || '',
      language: request?.language || 'python',
      categories: Array.isArray(request?.categories) ? request.categories : [],
      feedback: request?.feedback || null,
      previousInputCode: request?.previousInputCode || null,
      previousOutputCode: request?.previousOutputCode || null,
      inputExample: request?.inputExample || '',
      outputExample: request?.outputExample || '',
      planVersionNumber: request?.planVersionNumber || null,
    };
  }

  /**
   * Main Kafka message handler.
   * Called by KafkaService with the raw message Buffer.
   *
   * @param {Buffer} messageValue
   * @returns {Promise<Object>} — response payload for `test-case-code-response` topic
   */
  async handleKafkaMessage(messageValue) {
    const parsed = JSON.parse(messageValue.toString());
    const requestData = this.normalizeRequest(parsed);

    if (!requestData.workflowId || !requestData.userId) {
      throw new Error(
        'Invalid test-case-code-request payload: missing required fields (workflowId, userId)'
      );
    }

    if (!requestData.statement) {
      throw new Error(
        'Invalid test-case-code-request payload: statement is required'
      );
    }

    const generated = await this.testCaseCodeService.generate(requestData);

    return {
      schemaVersion: MESSAGE_SCHEMA_VERSION,
      workflowId: requestData.workflowId,
      userId: requestData.userId,
      inputCode: generated.inputCode,
      outputCode: generated.outputCode,
      feedback: requestData.feedback,
      source: generated.source,
      model: generated.model,
      generatedAt: new Date().toISOString(),
      planVersionNumber: requestData.planVersionNumber,
    };
  }
}
