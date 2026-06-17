import * as fs from 'fs';
import * as path from 'path';
import { executeInSandbox } from './vm_manager.js';

async function main() {
    const scriptPath = path.resolve(process.cwd(), '../scripts/test_gemini.js');
    const code = fs.readFileSync(scriptPath, 'utf-8');

    console.log("===================================");
    console.log("🚀 STARTING RUNNER (GEMINI PROXY TEST)");
    console.log("===================================");
    
    try {
        const result = await executeInSandbox(code, JSON.stringify({ prompt: "What is 2+2?" }));
        console.log("\n✅ Execution Result:", result);
    } catch (e: any) {
        console.error("\n❌ Execution Failed:", e.message);
    }
}

main();
