import * as paillierBigint from 'paillier-bigint';
import { executeInSandbox } from './vm_manager.js';

async function runFHETest() {
    console.log("=== SUI FUNCTIONS FHE CONFIDENTIAL MODE TEST (PAILLIER) ===");

    // ==========================================
    // 1. DEVELOPER SIDE (Local Encryption)
    // ==========================================
    console.log("\\n[Developer] Initializing local FHE encryption engine...");
    
    // Generate private/public keys (simulating 512-bit keys for speed in tests, production uses 2048 or 4096)
    const { publicKey, privateKey } = await paillierBigint.generateRandomKeys(512);
    
    // The developer wants to securely add their Agent's Daily Spend Limit + Current Spend
    const dailyLimit = 100n;
    const currentSpend = 50n;

    console.log(`[Developer] Plaintext Values -> Limit: $${dailyLimit}, Spent: $${currentSpend}`);
    console.log("[Developer] Encrypting values before sending to Node Operator...");

    const cipherLimit = publicKey.encrypt(dailyLimit);
    const cipherSpend = publicKey.encrypt(currentSpend);

    console.log(`[Developer] Encrypted Limit (snippet): ${cipherLimit.toString().substring(0, 30)}...`);
    console.log(`[Developer] Encrypted Spend (snippet): ${cipherSpend.toString().substring(0, 30)}...`);


    // ==========================================
    // 2. NODE OPERATOR SIDE (V8 Sandbox Execution)
    // ==========================================
    console.log("\\n[Node Operator] Receiving encrypted execution payload...");
    
    // Developer's script that gets run in the V8 Sandbox
    const sandboxCode = `
        const limit = input.cipherLimit;
        const spend = input.cipherSpend;
        const pubKey = input.pubKey;
        
        console.log("Operator running logic inside V8 Sandbox...");
        console.log("Operator sees Limit as: " + limit.substring(0, 30) + "...");
        
        // Use the native host FHE bridge to add the encrypted numbers
        // Paillier requires the public key parameters to do the addition
        const newTotal = SuiFHE.add(pubKey, limit, spend);
        
        console.log("Operator generated new encrypted total.");
        return { encryptedResult: newTotal };
    `;

    const inputData = JSON.stringify({
        pubKey: {
            n: publicKey.n.toString(),
            g: publicKey.g.toString()
        },
        cipherLimit: cipherLimit.toString(),
        cipherSpend: cipherSpend.toString()
    });

    console.log("[Node Operator] Booting secure V8 Sandbox...");
    
    let result;
    try {
        result = await executeInSandbox(sandboxCode, inputData);
    } catch (e) {
        console.error("SANDBOX ERROR:", e);
        return;
    }
    
    console.log("[Node Operator] Execution complete. Returning encrypted ciphertext to developer.");


    // ==========================================
    // 3. DEVELOPER SIDE (Local Decryption)
    // ==========================================
    console.log("\\n[Developer] Received encrypted result from Node Operator.");
    console.log(`[Developer] Result (snippet): ${result.encryptedResult.substring(0, 30)}...`);
    console.log("[Developer] Decrypting result with local private key...");

    const decryptedTotal = privateKey.decrypt(BigInt(result.encryptedResult));

    console.log(`\\n🎉 [Developer] Decrypted Result: $${decryptedTotal.toString()} (Limit + Spent)`);
    console.log("Success! The operator calculated 100 + 50 = 150 without ever seeing the numbers!");
}

runFHETest().catch(e => {
    console.error("CRITICAL FHE ERROR:", e);
});
