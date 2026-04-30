import { startService } from './bootstrap.js';

// Backward-compatible adapter used by legacy imports.
export const startKafka = async () => {
  await startService();
};
