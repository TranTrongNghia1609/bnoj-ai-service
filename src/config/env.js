import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const readString = (name, defaultValue = '') => {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === null) {
    return defaultValue;
  }
  return String(rawValue).trim();
};

const readNumber = (name, defaultValue) => {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

export const env = {
  nodeEnv: readString('NODE_ENV', 'development'),
  activeProvider: readString('ACTIVE_PROVIDER', 'gemini').toLowerCase(),
  aiDraftProvider: readString('AI_DRAFT_PROVIDER', readString('ACTIVE_PROVIDER', 'gemini')).toLowerCase(),
  aiRefinerProvider: readString('AI_REFINER_PROVIDER', readString('ACTIVE_PROVIDER', 'gemini')).toLowerCase(),
  kafkaBrokers: readString('KAFKA_BROKER', 'localhost:9092')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  kafkaUser: readString('KAFKA_USER', ''),
  kafkaPassword: readString('KAFKA_PASSWORD', ''),
  kafkaRequestTopic: readString('AI_REQUEST_TOPIC', 'ai_request'),
  kafkaResponseTopic: readString('AI_RESPONSE_TOPIC', 'ai_response'),
  geminiApiKey: readString('GEMINI_API_KEY', ''),
  geminiModel: readString('GEMINI_MODEL', 'gemini-1.5-flash'),
  geminiDraftModel: readString('GEMINI_DRAFT_MODEL', readString('GEMINI_MODEL', 'gemini-1.5-flash')),
  geminiRefinerModel: readString('GEMINI_REFINER_MODEL', readString('GEMINI_MODEL', 'gemini-1.5-flash')),
  geminiMaxRetries: readNumber('GEMINI_MAX_RETRIES', 1),
  geminiDraftMaxRetries: readNumber('GEMINI_DRAFT_MAX_RETRIES', readNumber('GEMINI_MAX_RETRIES', 1)),
  geminiRefinerMaxRetries: readNumber('GEMINI_REFINER_MAX_RETRIES', readNumber('GEMINI_MAX_RETRIES', 1)),
  geminiRetryDelayMs: readNumber('GEMINI_RETRY_DELAY_MS', 5000),
  geminiDraftRetryDelayMs: readNumber('GEMINI_DRAFT_RETRY_DELAY_MS', readNumber('GEMINI_RETRY_DELAY_MS', 5000)),
  geminiRefinerRetryDelayMs: readNumber('GEMINI_REFINER_RETRY_DELAY_MS', readNumber('GEMINI_RETRY_DELAY_MS', 5000)),
  aiMaxConcurrent: readNumber('AI_MAX_CONCURRENT', 3),
  aiSkipRefinerMinLength: readNumber('AI_SKIP_REFINER_MIN_LENGTH', 200),
};

export const validateEnv = () => {
  const errors = [];

  if (!Array.isArray(env.kafkaBrokers) || env.kafkaBrokers.length === 0) {
    errors.push('KAFKA_BROKER must include at least one broker');
  }

  const usedProviders = [env.activeProvider, env.aiDraftProvider, env.aiRefinerProvider]
    .map((value) => String(value || '').toLowerCase())
    .filter(Boolean);

  if (usedProviders.includes('gemini') && !env.geminiApiKey) {
    errors.push('GEMINI_API_KEY is required when ACTIVE_PROVIDER=gemini');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment: ${errors.join('; ')}`);
  }
};
