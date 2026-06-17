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
const keypair = Ed25519Keypair.fromSecretKey(secretKey);
const packageId = process.env.PACKAGE_ID;
const registryId = process.env.REGISTRY_ID;
async function main() {
    console.log("Using Package:", packageId);
    console.log("Using Registry:", registryId);
    console.log("Using Address:", keypair.toSuiAddress());
    const tx = new Transaction();
    tx.moveCall({
        target: `${packageId}::trigger::update_function`,
        arguments: [
            tx.object(registryId),
            tx.pure.string("SUI USD Oracle"),
            tx.pure.string("0geOO6RLle4NjptiPQ0ZHzaTAb0Ghi-VyW5tfHHETj8")
        ]
    });
    try {
        console.log("Executing transaction...");
        const result = await client.signAndExecuteTransaction({
            signer: keypair,
            transaction: tx
        });
        console.log("SUCCESS! Digest:", result.digest);
    }
    catch (e) {
        console.error("FAILED with error:", e.message);
        if (e.message.includes('MoveAbort')) {
            console.error("It was a MoveAbort!");
        }
    }
}
main();
