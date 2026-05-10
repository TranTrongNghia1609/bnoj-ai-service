/**
 * Default topic name constants — kept for reference and backward compatibility.
 * Actual runtime values come from config/kafka.js (which reads from env).
 */
export const defaultTopics = {
  request: 'ai_request',
  response: 'ai_response',
};
