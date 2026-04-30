import { Kafka } from 'kafkajs';
import { ConcurrencyLimiter } from '../core/ConcurrencyLimiter.js';

export class KafkaService {
  /**
   * @param {Object} options
   * @param {Object} options.kafkaClientConfig
   * @param {Object} options.kafkaConsumerConfig
   * @param {Object} options.topics
   * @param {number} [options.maxConcurrent] – Số request AI xử lý đồng thời (default: 3)
   */
  constructor({ kafkaClientConfig, kafkaConsumerConfig, topics, maxConcurrent = 3 }) {
    this.topics = topics;
    this.kafka = new Kafka(kafkaClientConfig);
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer(kafkaConsumerConfig);
    this.admin = this.kafka.admin();
    this.limiter = new ConcurrencyLimiter(maxConcurrent);
  }

  async ensureTopics() {
    await this.admin.connect();
    await this.admin.createTopics({
      topics: [
        { topic: this.topics.request, numPartitions: 1 },
        { topic: this.topics.response, numPartitions: 1 },
      ],
      waitForLeaders: true,
    });
    await this.admin.disconnect();

    console.log(`[KafkaService] Topics ready: ${this.topics.request}, ${this.topics.response}`);
  }

  async start(onRequest) {
    await this.ensureTopics();

    await this.producer.connect();
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topics.request });

    console.log(`[KafkaService] Producer and consumer connected (maxConcurrent=${this.limiter.maxConcurrent})`);

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (topic !== this.topics.request) {
          return;
        }

        try {
          const responsePayload = await this.limiter.run(() => onRequest(message.value));

          console.log(
            `[KafkaService] Sent ai_response for submission ${responsePayload.submissionId} source=${responsePayload.source}` +
            ` | active=${this.limiter.activeCount} pending=${this.limiter.pendingCount}`
          );

          await this.producer.send({
            topic: this.topics.response,
            messages: [{ value: JSON.stringify(responsePayload) }],
          });
        } catch (error) {
          console.error('[KafkaService] Failed to process request message:', error);
        }
      },
    });
  }
}
