import fs from 'fs';
import path from 'path';
import os from 'os';

const LOG_DIR = path.join(os.homedir(), '.pm2', 'logs');
const MAX_LINES = 50;

function truncateLogs() {
    if (!fs.existsSync(LOG_DIR)) return;
    try {
        const files = fs.readdirSync(LOG_DIR);
        for (const file of files) {
            if (file.endsWith('.log')) {
                const filePath = path.join(LOG_DIR, file);
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const lines = content.split('\n');
                    if (lines.length > MAX_LINES) {
                        const truncated = lines.slice(-MAX_LINES).join('\n');
                        fs.writeFileSync(filePath, truncated, 'utf8');
                    }
                } catch (e) {
                    // Ignore locked/busy file write errors
                }
            }
        }
    } catch (err) {
        // Fail silently
    }
}

// Run every 10 seconds to cap logs at 50 lines
setInterval(truncateLogs, 10000);
console.log("PM2 Log Truncator initialized. Capping all PM2 logs at maximum 50 lines.");
