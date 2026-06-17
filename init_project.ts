import * as dotenv from 'dotenv';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';

dotenv.config();

const client = new SuiJsonRpcClient({ 
    url: getJsonRpcFullnodeUrl('testnet'),
    network: 'testnet'
});

const secretKey = process.env.ADMIN_SECRET_KEY;
if (!secretKey) {
    console.error("ADMIN_SECRET_KEY not set in .env");
    process.exit(1);
}
const keypair = Ed25519Keypair.fromSecretKey(secretKey);
const packageId = process.env.PACKAGE_ID || "";
const treasuryId = process.env.PROTOCOL_TREASURY_ID || "";
if (!packageId || !treasuryId) {
    console.error("PACKAGE_ID and PROTOCOL_TREASURY_ID required in .env");
    process.exit(1);
}

async function main() {
    console.log("Initializing Project on Sui Testnet...");
    const tx = new Transaction();
    
    const [projectFee] = tx.splitCoins(tx.gas, [tx.pure.u64(100_000_000)]);
    tx.moveCall({
        target: `${packageId}::trigger::create_project`,
        arguments: [
            tx.pure.string("E-Commerce Oracle Workspace"),
            tx.pure.string("Decentralized SUI/USD Price Feed & Order Verification Service"),
            tx.object(treasuryId),
            projectFee
        ]
    });

    const result = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: {
            showEffects: true,
            showObjectChanges: true
        }
    });

    console.log(`Transaction digest: ${result.digest}`);

    // Parse the Project Object ID from object changes
    const projectChange = result.objectChanges?.find(change => 
        change.type === 'created' && change.objectType.endsWith('::trigger::Project')
    );

    if (!projectChange || projectChange.type !== 'created') {
        console.error("Could not find created Project object in transaction changes");
        process.exit(1);
    }

    const projectId = projectChange.objectId;
    console.log(`\n🎉 SUCCESSFULLY MINTED PROJECT OBJECT!`);
    console.log(`Project ID: ${projectId}`);

    console.log("\nRegistering 'SUI USD Oracle' function inside the new project...");
    const regTx = new Transaction();
    const [deployFee] = regTx.splitCoins(regTx.gas, [regTx.pure.u64(50_000_000)]);
    regTx.moveCall({
        target: `${packageId}::trigger::register_function`,
        arguments: [
            regTx.object(projectId),
            regTx.pure.string("SUI USD Oracle"),
            regTx.pure.string("0geOO6RLle4NjptiPQ0ZHzaTAb0Ghi-VyW5tfHHETj8"),
            regTx.pure.u8(0),
            regTx.pure.string("{}"),
            regTx.object(treasuryId),
            deployFee
        ]
    });

    const regResult = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: regTx
    });

    console.log(`Oracle registered successfully! Tx Digest: ${regResult.digest}`);
    console.log(`\n👉 Please update your runner/.env with:`);
    console.log(`PROJECT_ID=${projectId}`);
}

main().catch(err => {
    console.error("Initialization failed:", err);
});
