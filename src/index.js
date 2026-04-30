import { startService } from './bootstrap.js';

const start = async () => {
    try {
        console.log("Starting AI Recommendation Service...");
        await startService();
    } catch (err) {
        console.error("AI Service failed to start:", err);
        process.exit(1);
    }
};

start();
