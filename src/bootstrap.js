import { env, validateEnv } from './config/env.js';
import { kafkaClientConfig, kafkaConsumerConfig, kafkaTopics } from './config/kafka.js';
import { providerConfig } from './config/providers.js';
import { redisClient } from './config/redis.js';
import { ProviderRegistry } from './providers/ProviderRegistry.js';
import { RedisDeduplicator } from './core/RedisDeduplicator.js';
import { FallbackHintService } from './services/FallbackHintService.js';
import { HintGenerationService } from './services/HintGenerationService.js';
import { TestCasePlanService } from './services/TestCasePlanService.js';
import { TestCaseCodeService } from './services/TestCaseCodeService.js';
import { RequestHandler } from './messaging/handlers/RequestHandler.js';
import { TestCasePlanHandler } from './messaging/handlers/TestCasePlanHandler.js';
import { TestCaseCodeHandler } from './messaging/handlers/TestCaseCodeHandler.js';
import { KafkaService } from './messaging/KafkaService.js';

export const createRuntime = () => {
  validateEnv();

  const providerRegistry = new ProviderRegistry(providerConfig);

  const draftProvider = providerRegistry.getStageProvider(providerConfig.pipeline.draft);
  const refinerProvider = providerRegistry.getStageProvider(providerConfig.pipeline.refiner);

  const fallbackHintService = new FallbackHintService();
  const hintGenerationService = new HintGenerationService({
    draftProvider,
    refinerProvider,
    fallbackHintService,
    skipRefinerMinLength: env.aiSkipRefinerMinLength,
  });

  const requestHandler = new RequestHandler({ hintGenerationService });

  // ── Test Case Plan pipeline ────────────────────────────────────────────────
  // Uses the same draftProvider as the hint pipeline (configurable separately if needed)
  const testCasePlanService = new TestCasePlanService({ draftProvider });
  const testCasePlanHandler = new TestCasePlanHandler({ testCasePlanService });

  // ── Test Case Code pipeline ────────────────────────────────────────────────
  const testCaseCodeService = new TestCaseCodeService({ draftProvider });
  const testCaseCodeHandler = new TestCaseCodeHandler({ testCaseCodeService });

  // ── Redis deduplication ────────────────────────────────────────────────────
  const deduplicator = new RedisDeduplicator(redisClient);

  const kafkaService = new KafkaService({
    kafkaClientConfig,
    kafkaConsumerConfig,
    maxConcurrent: env.aiMaxConcurrent,
    deduplicator,
  });

  // ── Shared dedup key extractor ─────────────────────────────────────────────
  // The producer (infor-service) injects a unique `messageId` (UUID) into every
  // Kafka message. We use it as the universal dedup key across all topics.
  const extractMessageId = (messageValue) => {
    try {
      const parsed = JSON.parse(messageValue.toString());
      const data = parsed?.payload ?? parsed;
      console.log("MessageId: ", data?.messageId)
      return data?.messageId || null;
    } catch { return null; }
  };

  // ── Register topic handlers ────────────────────────────────────────────────
  // Hint generation
  kafkaService.register(kafkaTopics.request, {
    handler: (messageValue) => requestHandler.handleKafkaMessage(messageValue),
    responseTopic: kafkaTopics.response,
    dedupKeyExtractor: extractMessageId,
  });

  // Test case plan generation
  kafkaService.register(kafkaTopics.testCasePlanRequest, {
    handler: (messageValue) => testCasePlanHandler.handleKafkaMessage(messageValue),
    responseTopic: kafkaTopics.testCasePlanResponse,
    dedupKeyExtractor: extractMessageId,
  });

  // Test case code generation
  kafkaService.register(kafkaTopics.testCaseCodeRequest, {
    handler: (messageValue) => testCaseCodeHandler.handleKafkaMessage(messageValue),
    responseTopic: kafkaTopics.testCaseCodeResponse,
    dedupKeyExtractor: extractMessageId,
  });

  return {
    provider: draftProvider,
    draftProvider,
    refinerProvider,
    kafkaService,
    deduplicator,
    requestHandler,
    testCasePlanHandler,
    testCaseCodeHandler,
  };
};

export const startService = async () => {
  const runtime = createRuntime();

  console.log(`[AI Service] Draft provider  : ${runtime.draftProvider.name} | model=${runtime.draftProvider.config?.model || 'unknown'}`);
  console.log(`[AI Service] Refiner provider: ${runtime.refinerProvider.name} | model=${runtime.refinerProvider.config?.model || 'unknown'}`);
  console.log(`[AI Service] Max concurrent  : ${env.aiMaxConcurrent} | Skip refiner min length: ${env.aiSkipRefinerMinLength}`);

  // ── Connect Redis for deduplication ────────────────────────────────────────
  try {
    await redisClient.connect();
    console.log(`[AI Service] Redis dedup     : enabled (TTL=${env.dedupTtlSeconds}s, prefix="${env.dedupKeyPrefix}")`);
  } catch (err) {
    console.warn(`[AI Service] Redis dedup     : disabled (connection failed: ${err.message})`);
  }

  await runtime.kafkaService.start();
};
