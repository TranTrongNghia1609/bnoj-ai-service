import { env } from './env.js';

export const kafkaTopics = {
  request: env.kafkaRequestTopic,
  response: env.kafkaResponseTopic,
  testCasePlanRequest: env.kafkaTestCasePlanRequestTopic,
  testCasePlanResponse: env.kafkaTestCasePlanResponseTopic,
  testCaseCodeRequest: env.kafkaTestCaseCodeRequestTopic,
  testCaseCodeResponse: env.kafkaTestCaseCodeResponseTopic,
};

export const kafkaClientConfig = {
  clientId: 'ai-recommender-service',
  brokers: env.kafkaBrokers,
  sasl: env.kafkaUser && env.kafkaPassword
    ? {
      mechanism: 'PLAIN',
      username: env.kafkaUser,
      password: env.kafkaPassword,
    }
    : undefined,
};

const isLocal = process.env.NODE_ENV !== 'production';
console.log("Is local ", isLocal)
export const kafkaConsumerConfig = {
  groupId: 'ai-recommender-group',

  // Ở local, dùng mặc định (30s) để rebalance nhanh hơn khi restart app.
  // Ở production, dùng 120s để tránh bị kick khi AI đang tính toán nặng.
  sessionTimeout: 60000,

  // Heartbeat nên bằng 1/3 session timeout
  heartbeatInterval: 3000,
};