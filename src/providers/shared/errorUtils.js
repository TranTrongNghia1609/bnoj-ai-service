/**
 * Shared error classification utilities.
 * Each provider re-exports these and can override individual functions.
 */
import { ERROR_TYPES } from '../../core/types.js';

const getErrorMessage = (error) => String(error?.message || error || 'Unknown error');

/**
 * Parse a retry delay from an error message or return the default.
 * Handles patterns like "retry in 12.3s" (Gemini) and "Please retry after 15 seconds" (OpenAI).
 */
export const parseRetryDelayMs = (error, defaultDelayMs = 5000) => {
  const message = getErrorMessage(error);

  // "retry in 12.3s" — Gemini style
  const geminiMatch = message.match(/retry in\s+([\d.]+)s/i);
  if (geminiMatch) {
    const seconds = Number(geminiMatch[1]);
    if (!Number.isNaN(seconds) && Number.isFinite(seconds)) {
      return Math.max(1000, Math.ceil(seconds * 1000));
    }
  }

  // "Please retry after 15 seconds" — OpenAI style
  const openaiMatch = message.match(/retry after\s+([\d.]+)\s*second/i);
  if (openaiMatch) {
    const seconds = Number(openaiMatch[1]);
    if (!Number.isNaN(seconds) && Number.isFinite(seconds)) {
      return Math.max(1000, Math.ceil(seconds * 1000));
    }
  }

  return Math.max(1000, defaultDelayMs || 5000);
};

/**
 * Determine whether the error is transient and worth retrying.
 */
export const isRetryableError = (error) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('resource exhausted') ||
    message.includes('retry') ||
    message.includes('unavailable') ||
    message.includes('timeout') ||
    message.includes('503') ||
    message.includes('529')
  );
};

/**
 * Map an error to one of the canonical ERROR_TYPES constants.
 */
export const classifyError = (error) => {
  const message = getErrorMessage(error).toLowerCase();
  if (message.includes('quota') || message.includes('resource exhausted') || message.includes('rate limit') || message.includes('429')) {
    return ERROR_TYPES.QUOTA_EXCEEDED;
  }
  if (message.includes('401') || message.includes('403') || message.includes('api key') || message.includes('invalid_api_key') || message.includes('authentication')) {
    return ERROR_TYPES.AUTH_ERROR;
  }
  return ERROR_TYPES.GENERATION_FAILED;
};

export const getSafeErrorMessage = getErrorMessage;
