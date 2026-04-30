import { env } from './config/env.js';
import { providerConfig } from './config/providers.js';

// Backward-compatible adapter used by legacy imports.
export const config = {
    kafka_brokers: env.kafkaBrokers.join(','),
    kafka_user: env.kafkaUser,
    kafka_password: env.kafkaPassword,
    gemini_api_key: providerConfig.gemini.apiKey,
    gemini_model: providerConfig.gemini.model,
    gemini_max_retries: providerConfig.gemini.maxRetries,
    gemini_retry_delay_ms: providerConfig.gemini.retryDelayMs,
};
