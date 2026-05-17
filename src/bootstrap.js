import { env, validateEnv } from './config/env.js';
import { kafkaClientConfig, kafkaConsumerConfig, kafkaTopics } from './config/kafka.js';
import { providerConfig } from './config/providers.js';
import { ProviderRegistry } from './providers/ProviderRegistry.js';
import { FallbackHintService } from './services/FallbackHintService.js';
import { HintGenerationService } from './services/HintGenerationService.js';
import { TestCasePlanService } from './services/TestCasePlanService.js';
import { RequestHandler } from './messaging/handlers/RequestHandler.js';
import { TestCasePlanHandler } from './messaging/handlers/TestCasePlanHandler.js';
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

  const kafkaService = new KafkaService({
    kafkaClientConfig,
    kafkaConsumerConfig,
    maxConcurrent: env.aiMaxConcurrent,
  });

  // ── Register topic handlers ────────────────────────────────────────────────
  // Hint generation
  kafkaService.register(kafkaTopics.request, {
    handler: (messageValue) => requestHandler.handleKafkaMessage(messageValue),
    responseTopic: kafkaTopics.response,
  });

  // Test case plan generation
  kafkaService.register(kafkaTopics.testCasePlanRequest, {
    handler: (messageValue) => testCasePlanHandler.handleKafkaMessage(messageValue),
    responseTopic: kafkaTopics.testCasePlanResponse,
  });

  return {
    provider: draftProvider,
    draftProvider,
    refinerProvider,
    kafkaService,
    requestHandler,
    testCasePlanHandler,
  };
};

export const startService = async () => {
  const runtime = createRuntime();

  console.log(`[AI Service] Draft provider  : ${runtime.draftProvider.name} | model=${runtime.draftProvider.config?.model || 'unknown'}`);
  console.log(`[AI Service] Refiner provider: ${runtime.refinerProvider.name} | model=${runtime.refinerProvider.config?.model || 'unknown'}`);
  console.log(`[AI Service] Max concurrent  : ${env.aiMaxConcurrent} | Skip refiner min length: ${env.aiSkipRefinerMinLength}`);

  await runtime.kafkaService.start();
};
