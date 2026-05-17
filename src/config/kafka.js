import { env } from './env.js';

export const kafkaTopics = {
  request: env.kafkaRequestTopic,
  response: env.kafkaResponseTopic,
  testCasePlanRequest: env.kafkaTestCasePlanRequestTopic,
  testCasePlanResponse: env.kafkaTestCasePlanResponseTopic,
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
};
