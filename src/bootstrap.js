import { env, validateEnv } from './config/env.js';
import { kafkaClientConfig, kafkaConsumerConfig, kafkaTopics } from './config/kafka.js';
import { providerConfig } from './config/providers.js';
import { ProviderRegistry } from './providers/ProviderRegistry.js';
import { FallbackHintService } from './services/FallbackHintService.js';
import { HintGenerationService } from './services/HintGenerationService.js';
import { RequestHandler } from './messaging/handlers/RequestHandler.js';
import { KafkaService } from './messaging/KafkaService.js';

export const createRuntime = () => {
  validateEnv();

  const providerRegistry = new ProviderRegistry(providerConfig);
  const draftStage = providerConfig?.pipeline?.draft || {};
  const refinerStage = providerConfig?.pipeline?.refiner || {};

  const draftProvider = providerRegistry.getProvider(
    draftStage.provider || providerConfig.activeProvider,
    draftStage.options || {}
  );
  const refinerProvider = providerRegistry.getProvider(
    refinerStage.provider || providerConfig.activeProvider,
    refinerStage.options || {}
  );

  const fallbackHintService = new FallbackHintService();
  const hintGenerationService = new HintGenerationService({
    draftProvider,
    refinerProvider,
    fallbackHintService,
    skipRefinerMinLength: env.aiSkipRefinerMinLength,
  });

  const requestHandler = new RequestHandler({ hintGenerationService });

  const kafkaService = new KafkaService({
    kafkaClientConfig,
    kafkaConsumerConfig,
    topics: kafkaTopics,
    maxConcurrent: env.aiMaxConcurrent,
  });

  return {
    provider: draftProvider,
    draftProvider,
    refinerProvider,
    kafkaService,
    requestHandler,
  };
};

export const startService = async () => {
  const runtime = createRuntime();

  console.log(`[AI Service] Draft provider: ${runtime.draftProvider.name} | model=${runtime.draftProvider.config?.model || 'unknown'}`);
  console.log(`[AI Service] Refiner provider: ${runtime.refinerProvider.name} | model=${runtime.refinerProvider.config?.model || 'unknown'}`);
  console.log(`[AI Service] Max concurrent: ${env.aiMaxConcurrent} | Skip refiner min length: ${env.aiSkipRefinerMinLength}`);
  await runtime.kafkaService.start((messageValue) => runtime.requestHandler.handleKafkaMessage(messageValue));
};
