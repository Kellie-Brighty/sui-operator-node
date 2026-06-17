// runner/test_flow.ts
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const client = new SuiJsonRpcClient({ 
    url: getJsonRpcFullnodeUrl('testnet'),
    network: 'testnet'
});

// Setup keypair
const secret = process.env.ADMIN_SECRET_KEY || "";
if (!secret) {
    console.error("ADMIN_SECRET_KEY is required in runner/.env");
    process.exit(1);
}
const keypair = Ed25519Keypair.fromSecretKey(secret);

const packageId = process.env.PACKAGE_ID || "";
const treasuryId = process.env.PROTOCOL_TREASURY_ID || "";
if (!packageId || !treasuryId) {
    console.error("PACKAGE_ID and PROTOCOL_TREASURY_ID required in runner/.env");
    process.exit(1);
}

// Walrus Upload Helper
async function uploadToWalrus(content: string): Promise<string> {
    console.log("Uploading file content to Walrus Testnet...");
    const url = "https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=5";
    const response = await axios.put(url, content, {
        headers: { "Content-Type": "text/plain" }
    });
    
    const data = response.data;
    const blobId = data.newlyCreated?.blobObject?.blobId || data.alreadyCertified?.blobObject?.blobId;
    if (!blobId) {
        throw new Error("Could not extract blob ID from Walrus response: " + JSON.stringify(data));
    }
    console.log(`Uploaded! Blob ID: ${blobId}`);
    return blobId;
}

async function runTest() {
    console.log("====================================================");
    console.log("🚀 Starting On-Chain Auditor End-to-End Test Suite");
    console.log("====================================================");
    console.log(`Package ID: ${packageId}`);
    console.log(`User Address: ${keypair.getPublicKey().toSuiAddress()}`);

    // 1. Create a workspace project on-chain
    console.log("\n1. Creating workspace project on-chain...");
    const tx1 = new Transaction();
    const [projectFee] = tx1.splitCoins(tx1.gas, [tx1.pure.u64(100_000_000)]);
    tx1.moveCall({
        target: `${packageId}::trigger::create_project`,
        arguments: [
            tx1.pure.string("E2E Integration Test Suite Workspace"),
            tx1.pure.string("Testing suite for safe and unsafe auditor check validation"),
            tx1.object(treasuryId),
            projectFee
        ]
    });
    const result1 = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx1,
        options: { showObjectChanges: true }
    });
    console.log(`Project Minted! Tx Digest: ${result1.digest}`);
    
    // Extract Project ID
    let projectId = "";
    if (result1.objectChanges) {
        for (const change of result1.objectChanges) {
            if (change.type === 'created' && change.objectType.endsWith('::trigger::Project')) {
                projectId = change.objectId;
                break;
            }
        }
    }
    if (!projectId) {
        throw new Error("Could not extract Project object ID from transaction changes");
    }
    console.log(`Created Project Object ID: ${projectId}`);

    // 2. Configure project settings: runner address
    console.log("\n2. Configuring Workspace Project Settings...");
    const runnerAddress = keypair.getPublicKey().toSuiAddress();
    
    const tx2 = new Transaction();
    tx2.moveCall({
        target: `${packageId}::trigger::set_runner_address`,
        arguments: [
            tx2.object(projectId),
            tx2.pure.address(runnerAddress)
        ]
    });
    const result2 = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx2
    });
    console.log(`Settings Saved! Tx Digest: ${result2.digest}`);

    // 3. Prepare test scripts to register
    console.log("\n3. Preparing test scripts...");
    
    // A. Safe Script (Safe JavaScript)
    const safeScriptContent = `
        // Safe JavaScript Function
        console.log("Executing standard verification operation.");
        const computeData = { key: "verified_payload", sum: 10 + 20 };
        return JSON.stringify(computeData);
    `;
    const safeBlobId = await uploadToWalrus(safeScriptContent);

    // B. Unsafe Script (eval injection)
    const unsafeScriptContent = `
        // Unsafe JavaScript Function
        console.log("Attempting malicious evaluation...");
        const payload = eval("1 + 1"); // Evaluation injection triggers security violation
        process.exit(1); // Lifecycle manipulation triggers security violation
    `;
    const unsafeBlobId = await uploadToWalrus(unsafeScriptContent);

    // 4. Register Safe Function on-chain
    console.log(`\n4. Registering Safe Function: "SafeJS" (Blob: ${safeBlobId})...`);
    const tx3 = new Transaction();
    const [safeFee] = tx3.splitCoins(tx3.gas, [tx3.pure.u64(50_000_000)]);
    tx3.moveCall({
        target: `${packageId}::trigger::register_function`,
        arguments: [
            tx3.object(projectId),
            tx3.pure.string("SafeJS"),
            tx3.pure.string(safeBlobId),
            tx3.pure.u8(0),
            tx3.pure.string("{}"),
            tx3.object(treasuryId),
            safeFee
        ]
    });
    const result3 = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx3
    });
    console.log(`Registered! Tx Digest: ${result3.digest}`);

    // Wait for the gas and project objects to update and settle in RPC nodes
    console.log("Sleeping 6 seconds for transaction to settle and indexing to complete...");
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Force RPC call to fetch the updated project object to bust any local client cache
    await client.getObject({ id: projectId });

    // 5. Register Unsafe Function on-chain
    console.log(`\n5. Registering Unsafe Function: "UnsafeJS" (Blob: ${unsafeBlobId})...`);
    const tx4 = new Transaction();
    const [unsafeFee] = tx4.splitCoins(tx4.gas, [tx4.pure.u64(50_000_000)]);
    tx4.moveCall({
        target: `${packageId}::trigger::register_function`,
        arguments: [
            tx4.object(projectId),
            tx4.pure.string("UnsafeJS"),
            tx4.pure.string(unsafeBlobId),
            tx4.pure.u8(0),
            tx4.pure.string("{}"),
            tx4.object(treasuryId),
            unsafeFee
        ]
    });
    const result4 = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx4
    });
    console.log(`Registered! Tx Digest: ${result4.digest}`);

    // 6. Polling verification status on-chain
    console.log("\n6. Awaiting background auditing and verification...");
    
    // We poll for up to 20 seconds
    for (let attempt = 1; attempt <= 10; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`Checking function statuses on-chain (Attempt ${attempt}/10)...`);
        
        const projectObj = await client.getObject({
            id: projectId,
            options: { showContent: true }
        });
        
        const fields = (projectObj.data?.content as any)?.fields;
        const functionsTableId = fields?.functions?.fields?.id?.id;
        
        if (functionsTableId) {
            // Retrieve SafeJS status
            const safeJsObj = await client.getDynamicFieldObject({
                parentId: functionsTableId,
                name: { type: '0x1::string::String', value: 'SafeJS' }
            });
            const safeStatus = (safeJsObj.data?.content as any)?.fields?.value?.fields?.status;

            // Retrieve UnsafeJS status
            const unsafeJsObj = await client.getDynamicFieldObject({
                parentId: functionsTableId,
                name: { type: '0x1::string::String', value: 'UnsafeJS' }
            });
            const unsafeStatus = (unsafeJsObj.data?.content as any)?.fields?.value?.fields?.status;

            console.log(`   - "SafeJS" Status: ${getStatusLabel(safeStatus)}`);
            console.log(`   - "UnsafeJS" Status: ${getStatusLabel(unsafeStatus)}`);

            if (safeStatus !== 0 && unsafeStatus !== 0) {
                console.log("\n🎉 Both functions completed auditing successfully!");
                if (safeStatus === 1 && unsafeStatus === 2) {
                    console.log("✅ Verification Verification: Success! Safe function was verified (1) and Unsafe function was rejected (2).");
                } else {
                    console.error("❌ Verification Validation Failed: Expected Safe to be verified (1) and Unsafe to be rejected (2).");
                }
                break;
            }
        }
    }

    console.log("\nTest run finished.");
}

function getStatusLabel(status: any): string {
    if (status === undefined || status === null) return "Unknown";
    const num = Number(status);
    if (num === 0) return "0 (Pending Audit)";
    if (num === 1) return "1 (Verified & Active)";
    if (num === 2) return "2 (Audit Rejected)";
    return `${num} (Invalid State)`;
}

runTest().catch(console.error);
