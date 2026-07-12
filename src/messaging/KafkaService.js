import { Kafka } from 'kafkajs';
import { ConcurrencyLimiter } from '../core/ConcurrencyLimiter.js';

/**
 * KafkaService — multi-topic consumer / single producer.
 *
 * Usage:
 *   const service = new KafkaService({ kafkaClientConfig, kafkaConsumerConfig, maxConcurrent: 3 });
 *
 *   // Register one handler per consumed topic.
 *   // A handler receives (messageValue: Buffer) and returns a response payload
 *   // (or null/undefined to suppress producing a response).
 *   service.register('ai_request', {
 *     handler: async (messageValue) => ({ ...responsePayload }),
 *     responseTopic: 'ai_response',          // optional – omit for fire-and-forget topics
 *     topicConfig: { numPartitions: 1 },     // optional – passed to admin.createTopics
 *   });
 *
 *   await service.start();
 */
export class KafkaService {
  /**
   * @param {Object} options
   * @param {Object} options.kafkaClientConfig
   * @param {Object} options.kafkaConsumerConfig
   * @param {number} [options.maxConcurrent=3]
   */
  constructor({ kafkaClientConfig, kafkaConsumerConfig, maxConcurrent = 3 }) {
    this.kafka = new Kafka(kafkaClientConfig);
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer(kafkaConsumerConfig);
    this.admin = this.kafka.admin();
    this.limiter = new ConcurrencyLimiter(maxConcurrent);

    /** @type {Map<string, { handler: Function, responseTopic?: string, topicConfig?: Object }>} */
    this._topicHandlers = new Map();
  }

  // ---------------------------------------------------------------------------
  // Handler registration
  // ---------------------------------------------------------------------------

  /**
   * Register a handler for an incoming topic.
   *
   * @param {string}   incomingTopic         – Kafka topic to consume
   * @param {Object}   registration
   * @param {Function} registration.handler  – async (messageValue: Buffer) => responsePayload | null
   * @param {string}   [registration.responseTopic]  – topic to produce the response to (omit for fire-and-forget)
   * @param {Object}   [registration.topicConfig]    – admin createTopics config overrides
   */
  register(incomingTopic, { handler, responseTopic, topicConfig = {} }) {
    if (typeof handler !== 'function') {
      throw new TypeError(`KafkaService.register: handler for "${incomingTopic}" must be a function`);
    }
    this._topicHandlers.set(String(incomingTopic), { handler, responseTopic, topicConfig });
  }

  // ---------------------------------------------------------------------------
  // Topic provisioning
  // ---------------------------------------------------------------------------

  async _ensureTopics() {
    const topicsToCreate = [];

    for (const [incomingTopic, { responseTopic, topicConfig }] of this._topicHandlers) {
      topicsToCreate.push({ topic: incomingTopic, numPartitions: 1, ...topicConfig });

      if (responseTopic) {
        topicsToCreate.push({ topic: responseTopic, numPartitions: 1 });
      }
    }

    if (topicsToCreate.length === 0) {
      return;
    }

    await this.admin.connect();
    await this.admin.createTopics({ topics: topicsToCreate, waitForLeaders: true });
    await this.admin.disconnect();

    const names = topicsToCreate.map((t) => t.topic).join(', ');
    console.log(`[KafkaService] Topics ready: ${names}`);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  async start() {
    if (this._topicHandlers.size === 0) {
      throw new Error('[KafkaService] No topic handlers registered. Call register() before start().');
    }

    await this._ensureTopics();
    await this.producer.connect();
    await this.consumer.connect();

    for (const incomingTopic of this._topicHandlers.keys()) {
      await this.consumer.subscribe({ topic: incomingTopic });
    }

    const topicList = [...this._topicHandlers.keys()].join(', ');
    console.log(`[KafkaService] Subscribed to: ${topicList} (maxConcurrent=${this.limiter.maxConcurrent})`);

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const registration = this._topicHandlers.get(topic);
        if (!registration) {
          console.warn(`[KafkaService] Received message on unregistered topic "${topic}" — ignoring`);
          return;
        }

        const { handler, responseTopic } = registration;
        console.log(`[KafkaService] Received message on topic "${topic}"`);
        try {
          const responsePayload = await this.limiter.run(() => handler(message.value));

          if (responseTopic && responsePayload != null) {
            await this.producer.send({
              topic: responseTopic,
              messages: [{ value: JSON.stringify(responsePayload) }],
            });

            console.log(
              `[KafkaService] [${topic}] → [${responseTopic}]` +
              ` submissionId=${responsePayload.submissionId ?? 'n/a'}` +
              ` source=${responsePayload.source ?? 'n/a'}` +
              ` | active=${this.limiter.activeCount} pending=${this.limiter.pendingCount}`
            );
          }
        } catch (error) {
          console.error(`[KafkaService] Error processing message from "${topic}":`, error);
        }
      },
    });
  }
}
