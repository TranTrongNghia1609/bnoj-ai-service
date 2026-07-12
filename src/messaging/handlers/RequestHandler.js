import { MESSAGE_SCHEMA_VERSION } from '../../core/types.js';

const toArray = (value) => (Array.isArray(value) ? value : []);

export class RequestHandler {
  constructor({ hintGenerationService }) {
    this.hintGenerationService = hintGenerationService;
  }

  normalizeRequest(payload) {
    const request = payload?.payload && typeof payload.payload === 'object'
      ? payload.payload
      : payload;

    return {
      userId: request?.userId || null,
      submissionId: request?.submissionId || null,
      problemId: request?.problemId || null,
      problemShortId: request?.problemShortId || null,
      sourceCode: request?.sourceCode || '',
      problemTitle: request?.problemTitle || 'Unknown problem',
      problemStatement: request?.problemStatement || '',
      problemInput: request?.problemInput || '',
      problemOutput: request?.problemOutput || '',
      examplesInput: toArray(request?.examplesInput),
      examplesOutput: toArray(request?.examplesOutput),
      failedReason: request?.failedReason || 'Unknown',
      language: request?.language || 'txt',
      userQuestion: request?.userQuestion || '',
      conversationContext: toArray(request?.conversationContext),
      locale: request?.locale || request?.responseLanguage || request?.userLanguage || null || "vi",
    };
  }

  async handleKafkaMessage(messageValue) {
    const parsed = JSON.parse(messageValue.toString());
    const requestData = this.normalizeRequest(parsed);

    if (!requestData.userId || !requestData.problemId) {
      throw new Error('Invalid ai_request payload: missing required id fields');
    }

    const generated = await this.hintGenerationService.generate(requestData);

    return {
      schemaVersion: MESSAGE_SCHEMA_VERSION,
      userId: requestData.userId,
      submissionId: requestData.submissionId,
      problemId: requestData.problemId,
      problemShortId: requestData.problemShortId,
      hint: generated.hint,
      source: generated.source,
      model: generated.model,
      errorType: generated.errorType,
      generatedAt: new Date().toISOString(),
    };
  }
}
