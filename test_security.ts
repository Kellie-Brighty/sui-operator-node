import { executeInSandbox } from './vm_manager.js';

async function runSecurityTest() {
    console.log("=== SUI FUNCTIONS INTRUSION DETECTION SYSTEM TEST ===\\n");

    const inputData = JSON.stringify({
        payment_service: {
            stripe_key: "sk_live_51M0xABCDEF1234567890"
        },
        ai_service: {
            openai_key: "sk-proj-xyz123abc456def789"
        },
        database_password: "supersecrethexstring1234"
    });

    // 1. Simulate a Normal Execution
    console.log("--- TEST 1: Normal Execution ---");
    const normalCode = `
        console.log("Executing normal developer logic...");
        // Log the environment traps to show what the attacker would see if they dumped RAM
        console.log("The Developer's script has access to these keys in memory: ", Object.keys(input.env_traps));
        return { status: "Success" };
    `;

    console.log("[Node Operator] Booting Sandbox...");
    try {
        await executeInSandbox(normalCode, inputData);
        console.log("[Node Operator] Execution completed safely.\\n");
    } catch (e: any) {
        console.error("FAILED:", e.message);
    }


    // 2. Simulate a Timing Anomaly Attack
    console.log("--- TEST 2: Timing Anomaly Attack ---");
    console.log("[Attacker] Attempting to pause execution with a breakpoint to dump memory...");
    
    // We simulate an attacker freezing the process by putting a giant blocking loop in the code
    const attackCode = `
        console.log("Attacker paused execution to read memory...");
        // Simulate waiting for 500ms while reading RAM
        const start = Date.now();
        while(Date.now() - start < 500) {} 
        
        console.log("Attacker finished reading. Resuming execution to avoid suspicion...");
        return { status: "Success" };
    `;

    try {
        await executeInSandbox(attackCode, inputData);
    } catch (e: any) {
        console.error("FAILED:", e.message);
    }
}

runSecurityTest().catch(console.error);
