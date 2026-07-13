import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const readString = (name, defaultValue = '') => {
  const rawValue = process.env[name];
  console.log(`${name}: ${JSON.stringify(rawValue, null, 2)}`);
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

  // Active provider selection
  activeProvider: readString('ACTIVE_PROVIDER', 'gemini').toLowerCase(),
  aiDraftProvider: readString('AI_DRAFT_PROVIDER', readString('ACTIVE_PROVIDER', 'gemini')).toLowerCase(),
  aiRefinerProvider: readString('AI_REFINER_PROVIDER', readString('ACTIVE_PROVIDER', 'gemini')).toLowerCase(),

  // Kafka
  kafkaBrokers: readString('KAFKA_BROKER', 'localhost:9092')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  kafkaUser: readString('KAFKA_USER', ''),
  kafkaPassword: readString('KAFKA_PASSWORD', ''),
  kafkaRequestTopic: readString('KAFKA_AI_HINT_REQUEST', 'ai.hint.request'),
  kafkaResponseTopic: readString('KAFKA_AI_HINT_RESPONSE', 'ai.hint.response'),
  kafkaTestCasePlanRequestTopic: readString('KAFKA_AI_TEST_CASE_PLAN_REQUEST', 'ai.test-case-plan.request'),
  kafkaTestCasePlanResponseTopic: readString('KAFKA_AI_TEST_CASE_PLAN_RESPONSE', 'ai.test-case-plan.response'),
  kafkaTestCaseCodeRequestTopic: readString('KAFKA_AI_TEST_CASE_CODE_REQUEST', 'ai.test-case-code.request'),
  kafkaTestCaseCodeResponseTopic: readString('KAFKA_AI_TEST_CASE_CODE_RESPONSE', 'ai.test-case-code.response'),

  // ---------------------------------------------------------------------------
  // Gemini
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // OpenAI
  // ---------------------------------------------------------------------------
  openaiApiKey: readString('OPENAI_API_KEY', ''),
  openaiModel: readString('OPENAI_MODEL', 'gpt-4o-mini'),
  openaiDraftModel: readString('OPENAI_DRAFT_MODEL', readString('OPENAI_MODEL', 'gpt-4o-mini')),
  openaiRefinerModel: readString('OPENAI_REFINER_MODEL', readString('OPENAI_MODEL', 'gpt-4o-mini')),
  openaiMaxRetries: readNumber('OPENAI_MAX_RETRIES', 1),
  openaiDraftMaxRetries: readNumber('OPENAI_DRAFT_MAX_RETRIES', readNumber('OPENAI_MAX_RETRIES', 1)),
  openaiRefinerMaxRetries: readNumber('OPENAI_REFINER_MAX_RETRIES', readNumber('OPENAI_MAX_RETRIES', 1)),
  openaiRetryDelayMs: readNumber('OPENAI_RETRY_DELAY_MS', 5000),
  openaiDraftRetryDelayMs: readNumber('OPENAI_DRAFT_RETRY_DELAY_MS', readNumber('OPENAI_RETRY_DELAY_MS', 5000)),
  openaiRefinerRetryDelayMs: readNumber('OPENAI_REFINER_RETRY_DELAY_MS', readNumber('OPENAI_RETRY_DELAY_MS', 5000)),
  openaiBaseURL: readString('OPENAI_BASE_URL', ''),            // optional: custom endpoint / Azure
  openaiTemperature: readNumber('OPENAI_TEMPERATURE', 0.7),
  openaiMaxTokens: readNumber('OPENAI_MAX_TOKENS', 2048),


  // ---------------------------------------------------------------------------
  // Anthropic
  // ---------------------------------------------------------------------------
  anthropicApiKey: readString('ANTHROPIC_API_KEY', readString('OPENAI_API_KEY', '')),
  anthropicModel: readString('ANTHROPIC_MODEL', readString('OPENAI_MODEL', 'claude-3-5-sonnet-20241022')),
  anthropicDraftModel: readString('ANTHROPIC_DRAFT_MODEL', readString('ANTHROPIC_MODEL', readString('OPENAI_DRAFT_MODEL', readString('OPENAI_MODEL', 'claude-3-5-sonnet-20241022')))),
  anthropicRefinerModel: readString('ANTHROPIC_REFINER_MODEL', readString('ANTHROPIC_MODEL', readString('OPENAI_REFINER_MODEL', readString('OPENAI_MODEL', 'claude-3-5-sonnet-20241022')))),
  anthropicMaxRetries: readNumber('ANTHROPIC_MAX_RETRIES', readNumber('OPENAI_MAX_RETRIES', 1)),
  anthropicDraftMaxRetries: readNumber('ANTHROPIC_DRAFT_MAX_RETRIES', readNumber('ANTHROPIC_MAX_RETRIES', readNumber('OPENAI_DRAFT_MAX_RETRIES', 1))),
  anthropicRefinerMaxRetries: readNumber('ANTHROPIC_REFINER_MAX_RETRIES', readNumber('ANTHROPIC_MAX_RETRIES', readNumber('OPENAI_REFINER_MAX_RETRIES', 1))),
  anthropicRetryDelayMs: readNumber('ANTHROPIC_RETRY_DELAY_MS', readNumber('OPENAI_RETRY_DELAY_MS', 5000)),
  anthropicDraftRetryDelayMs: readNumber('ANTHROPIC_DRAFT_RETRY_DELAY_MS', readNumber('ANTHROPIC_RETRY_DELAY_MS', 5000)),
  anthropicRefinerRetryDelayMs: readNumber('ANTHROPIC_REFINER_RETRY_DELAY_MS', readNumber('ANTHROPIC_RETRY_DELAY_MS', 5000)),
  anthropicBaseURL: readString('ANTHROPIC_BASE_URL', readString('OPENAI_BASE_URL', '')),
  anthropicTemperature: readNumber('ANTHROPIC_TEMPERATURE', readNumber('OPENAI_TEMPERATURE', 0.7)),
  anthropicMaxTokens: readNumber('ANTHROPIC_MAX_TOKENS', readNumber('OPENAI_MAX_TOKENS', 4096)),

  // ---------------------------------------------------------------------------
  // Concurrency & optimization
  // ---------------------------------------------------------------------------
  aiMaxConcurrent: readNumber('AI_MAX_CONCURRENT', 3),
  aiSkipRefinerMinLength: readNumber('AI_SKIP_REFINER_MIN_LENGTH', 200),

  // ---------------------------------------------------------------------------
  // Redis (deduplication)
  // ---------------------------------------------------------------------------
  redisUrl: readString('REDIS_URL', ''),
  dedupTtlSeconds: readNumber('DEDUP_TTL_SECONDS', 300),
  dedupKeyPrefix: readString('DEDUP_KEY_PREFIX', 'dedup:'),
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
    errors.push('GEMINI_API_KEY is required when using provider=gemini');
  }

  if (usedProviders.includes('openai') && !env.openaiApiKey) {
    errors.push('OPENAI_API_KEY is required when using provider=openai');
  }

  if (usedProviders.includes('anthropic') && !env.anthropicApiKey) {
    errors.push('ANTHROPIC_API_KEY is required when using provider=anthropic');
  }

  const supportedProviders = ['gemini', 'openai', 'anthropic'];
  for (const p of usedProviders) {
    if (!supportedProviders.includes(p)) {
      errors.push(`Unsupported provider "${p}". Supported: ${supportedProviders.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment: ${errors.join('; ')}`);
  }
};
