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

export const kafkaConsumerConfig = {
    groupId: 'ai-recommender-group',
    sessionTimeout: 120000, // Increased to 60 seconds (Default is 30000ms)
    heartbeatInterval: 20000, // Increased to 20 seconds (Default is 3000ms)
};
