import { providerConfig } from './config/providers.js';
import { GeminiProvider } from './providers/gemini/GeminiProvider.js';

let geminiProvider = null;

const getGeminiProvider = () => {
  if (geminiProvider) {
    return geminiProvider;
  }

  geminiProvider = new GeminiProvider(providerConfig.gemini);
  geminiProvider.validateConfig();
  return geminiProvider;
};

// Backward-compatible adapter used by legacy imports.
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
  const provider = getGeminiProvider();

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
