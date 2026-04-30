import { ERROR_TYPES } from '../../core/types.js';

const getErrorMessage = (error) => String(error?.message || error || 'Unknown Gemini error');

export const parseRetryDelayMs = (error, defaultDelayMs = 5000) => {
  const message = getErrorMessage(error);
  const retryInMatch = message.match(/retry in\s+([\d.]+)s/i);
  if (retryInMatch) {
    const seconds = Number(retryInMatch[1]);
    if (!Number.isNaN(seconds) && Number.isFinite(seconds)) {
      return Math.max(1000, Math.ceil(seconds * 1000));
    }
  }
  return Math.max(1000, defaultDelayMs || 5000);
};

export const isRetryableError = (error) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('resource exhausted') ||
    message.includes('retry') ||
    message.includes('unavailable')
  );
};

export const classifyError = (error) => {
  const message = getErrorMessage(error).toLowerCase();
  if (message.includes('quota') || message.includes('resource exhausted')) {
    return ERROR_TYPES.QUOTA_EXCEEDED;
  }
  if (message.includes('401') || message.includes('403') || message.includes('api key')) {
    return ERROR_TYPES.AUTH_ERROR;
  }
  return ERROR_TYPES.GENERATION_FAILED;
};

export const getSafeErrorMessage = getErrorMessage;
