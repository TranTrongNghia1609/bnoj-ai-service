/**
 * Legacy adapter — kept for backward compatibility.
 * Delegates to the ProviderRegistry so callers always get the active provider.
 *
 * Prefer importing from ProviderRegistry directly in new code.
 */
import { providerConfig } from './config/providers.js';
import { ProviderRegistry } from './providers/ProviderRegistry.js';

let _registry = null;

const getRegistry = () => {
  if (!_registry) {
    _registry = new ProviderRegistry(providerConfig);
  }
  return _registry;
};

// Backward-compatible function used by any legacy direct imports.
export const generateHint = async (
  sourceCode,
  problemTitle,
  problemStatement,
  problemInput,
  problemOutput,
  examplesInput,
  examplesOutput,
  failedReason,
  language,
  userQuestion,
  conversationContext,
) => {
  const provider = getRegistry().getActiveProvider();

  return provider.generateHint({
    sourceCode,
    problemTitle,
    problemStatement,
    problemInput,
    problemOutput,
    examplesInput,
    examplesOutput,
    failedReason,
    language,
    userQuestion,
    conversationContext,
  });
};
