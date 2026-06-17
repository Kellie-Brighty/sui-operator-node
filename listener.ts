import * as dotenv from 'dotenv';
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { fetchFunctionCode } from './aggregator.js';
import { executeInSandbox } from './vm_manager.js';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import fs from 'fs';
import path from 'path';
import os from 'os';

dotenv.config({ path: '.env', override: false, quiet: true } as any);

// Initialize the client for Testnet
const client = new SuiJsonRpcClient({ 
    url: getJsonRpcFullnodeUrl('testnet'),
    network: 'testnet'
});

const FALLBACK_PACKAGE_ID = '0x41442ae1e170a68f3486ce0fd4fb03a2a48f4c69ee61cd5e8a563311aaaa3a95';
const FALLBACK_TREASURY_ID = '0x18bcfff30cc1dcdad91f4b3d3be4286251f339242e884989e52ff3017f15294f';
const FALLBACK_REGISTRY_ID = '0x48fc4208313f2fe1fce5df5a36af0cac209ca40db9855f7bb712cf2e95060ec1';

function getOrGenerateOperatorKey(): Ed25519Keypair | null {
    const configDir = path.join(os.homedir(), '.sui-functions');
    const defaultKeyPath = path.join(configDir, 'operator.json');
    const keyPath = process.env.OPERATOR_KEY_PATH || defaultKeyPath;

    if (process.env.ADMIN_SECRET_KEY) {
        return Ed25519Keypair.fromSecretKey(process.env.ADMIN_SECRET_KEY);
    }

    if (fs.existsSync(keyPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
            if (data.secretKey) {
                const kp = Ed25519Keypair.fromSecretKey(data.secretKey);
                console.log(`\x1b[32m✓ Loaded existing session key:\x1b[0m \x1b[90m${keyPath}\x1b[0m`);
                console.log(`\x1b[36m► Runner Address:\x1b[0m \x1b[1m${kp.toSuiAddress()}\x1b[0m\n`);
                return kp;
            }
        } catch (e: any) {
            console.warn("Failed to load existing key, generating a new one...");
        }
    }

    // Generate new key
    const newKeypair = new Ed25519Keypair();
    const targetDir = path.dirname(keyPath);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(keyPath, JSON.stringify({ secretKey: newKeypair.getSecretKey() }, null, 2));
    
    console.log(`\x1b[35m✦ Generated new session key:\x1b[0m \x1b[90m${keyPath}\x1b[0m`);
    console.log(`\x1b[36m► Runner Address:\x1b[0m \x1b[1m${newKeypair.toSuiAddress()}\x1b[0m`);
    console.log(`\x1b[33m⚠ PASTE THIS ADDRESS IN THE DASHBOARD TO AUTHORIZE YOUR NODE ⚠\x1b[0m\n`);
    return newKeypair;
}

// Load operator private key
const keypair = getOrGenerateOperatorKey();

// Cache to store project -> runner_address association to limit Sui RPC load
const projectRunnerCache = new Map<string, { runnerAddress: string, executionMode: number, timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds cache

async function getGlobalComputeFee(): Promise<number> {
    const treasuryId = process.env.PROTOCOL_TREASURY_ID || FALLBACK_TREASURY_ID;
    if (!treasuryId) return 0.007; // Default 0.007 SUI
    try {
        const treasuryObj = await client.getObject({
            id: treasuryId,
            options: { showContent: true }
        });
        const fields = (treasuryObj.data?.content as any)?.fields;
        const baseComputeFeeMist = fields?.base_compute_fee;
        if (baseComputeFeeMist) {
            return Number(baseComputeFeeMist) / 1000000000;
        }
    } catch (e: any) {
        console.warn(`[Listener] Failed to fetch global compute fee:`, e.message);
    }
    return 0.007;
}

async function isRunnerAuthorized(projectId: string): Promise<boolean> {
    if (!keypair) return false;
    const runnerAddress = keypair.toSuiAddress();
    
    // Check cache
    const cached = projectRunnerCache.get(projectId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        if (cached.executionMode === 0) return true; // Public compute pool
        return cached.runnerAddress === runnerAddress;
    }

    try {
        const projectObj = await client.getObject({
            id: projectId,
            options: { showContent: true }
        });
        const fields = (projectObj.data?.content as any)?.fields;
        const configuredRunner = fields?.runner_address;
        const executionMode = fields?.execution_mode || 0;
        
        projectRunnerCache.set(projectId, {
            runnerAddress: configuredRunner || "",
            executionMode: executionMode,
            timestamp: Date.now()
        });

        if (executionMode === 0) return true; // Public compute pool
        if (configuredRunner) return configuredRunner === runnerAddress;
    } catch (e: any) {
        console.warn(`[Listener] Failed to verify runner authorization for project ${projectId}:`, e.message);
    }
    return false;
}

async function checkProjectVaultBalance(projectId: string): Promise<number> {
    try {
        const projectObj = await client.getObject({
            id: projectId,
            options: { showContent: true }
        });
        const fields = (projectObj.data?.content as any)?.fields;
        const vaultBalanceMist = fields?.vault || 0;
        return Number(vaultBalanceMist) / 1000000000;
    } catch (e: any) {
        console.warn(`[Listener] Failed to fetch vault balance for project ${projectId}:`, e.message);
        return 0;
    }
}


/**
 * Robust helper to fetch SUI/USD price from multiple sources (Coinbase, CryptoCompare, CoinGecko)
 */
async function fetchSuiPrice(): Promise<number> {
    try {
        const res = await fetch('https://api.coinbase.com/v2/prices/SUI-USD/spot');
        const data = await res.json() as any;
        const price = parseFloat(data.data.amount);
        if (!isNaN(price) && price > 0) return price;
    } catch (e) {
        console.warn("[Price Helper] Coinbase SUI/USD fetch failed, trying CryptoCompare...");
    }

    try {
        const res = await fetch('https://min-api.cryptocompare.com/data/price?fsym=SUI&tsyms=USD');
        const data = await res.json() as any;
        const price = parseFloat(data.USD);
        if (!isNaN(price) && price > 0) return price;
    } catch (e) {
        console.warn("[Price Helper] CryptoCompare SUI/USD fetch failed, trying CoinGecko...");
    }

    try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd');
        const data = await res.json() as any;
        const price = parseFloat(data.sui.usd);
        if (!isNaN(price) && price > 0) return price;
    } catch (e) {
        console.warn("[Price Helper] CoinGecko SUI/USD fetch failed.");
    }

    throw new Error("All SUI/USD price provider APIs failed");
}

interface DBFunction {
    name: string;
    blobId: string;
    version: number;
    status: number;
    triggerType: number;
    triggerConfig: string;
    lastExecutionTime: number;
}

const lastCronRunTimes = new Map<string, number>();
const lastTriggeredPrices = new Map<string, number>();
const lastProcessedEventTx = new Map<string, string>();

async function fetchProjectFunctions(projectId: string): Promise<DBFunction[]> {
    try {
        const projectObj = await client.getObject({
            id: projectId,
            options: { showContent: true }
        });
        
        const content = projectObj.data?.content as any;
        const tableId = content?.fields?.functions?.fields?.id?.id;
        
        if (!tableId) return [];

        const dynamicFields = await client.getDynamicFields({
            parentId: tableId
        });

        const functionsList: DBFunction[] = [];
        for (const field of dynamicFields.data) {
            const fieldObj = await client.getDynamicFieldObject({
                parentId: tableId,
                name: field.name
            });
            
            const metadata = fieldObj.data?.content as any;
            const fieldsVal = metadata?.fields?.value?.fields;
            if (fieldsVal) {
                functionsList.push({
                    name: field.name.value as string,
                    blobId: fieldsVal.walrus_blob_id,
                    version: Number(fieldsVal.version),
                    status: fieldsVal.status !== undefined ? Number(fieldsVal.status) : 1,
                    triggerType: fieldsVal.trigger_type !== undefined ? Number(fieldsVal.trigger_type) : 0,
                    triggerConfig: fieldsVal.trigger_config as string || "{}",
                    lastExecutionTime: fieldsVal.last_execution_time !== undefined ? Number(fieldsVal.last_execution_time) : 0
                });
            }
        }
        return functionsList;
    } catch (e: any) {
        console.warn(`[Automation Engine] Error fetching project functions:`, e.message);
        return [];
    }
}

async function triggerFunctionExecution(projectId: string, functionName: string, inputData: string) {
    if (!keypair) {
        console.warn(`[Automation Engine] Cannot trigger "${functionName}": ADMIN_SECRET_KEY is not set.`);
        return;
    }
    try {
        const packageId = process.env.PACKAGE_ID || FALLBACK_PACKAGE_ID;
        const registryId = process.env.REGISTRY_ID || FALLBACK_REGISTRY_ID;
        const tx = new Transaction();
        tx.moveCall({
            target: `${packageId}::trigger::call_function`,
            arguments: [
                tx.object(projectId),
                tx.pure.string(functionName),
                tx.pure.string(inputData),
                tx.object(registryId),
                tx.object('0x6')
            ]
        });

        const result = await client.signAndExecuteTransaction({
            signer: keypair,
            transaction: tx
        });
        console.log(`[Automation Engine] Trigger transaction submitted for "${functionName}". Digest: ${result.digest}`);
    } catch (e: any) {
        console.error(`[Automation Engine] Failed to trigger function "${functionName}":`, e.message);
    }
}

export async function startDynamicAutomationEngine() {
    const packageId = process.env.PACKAGE_ID || FALLBACK_PACKAGE_ID;
    if (packageId === "0x0") {
        console.warn("[Automation Engine] Dynamic Automation Engine disabled (PACKAGE_ID is not configured).");
        return;
    }

    if (!keypair) {
        console.warn("[Automation Engine] Dynamic Automation Engine disabled (ADMIN_SECRET_KEY is not configured).");
        return;
    }

    const runnerAddress = keypair.toSuiAddress();
    console.log(`[Automation Engine] Starting dynamic engine for runner: ${runnerAddress}`);
    const CHECK_INTERVAL = 15 * 1000; // Check rules every 15 seconds

    async function discoverProjects(): Promise<string[]> {
        try {
            const createdEvents = await client.queryEvents({
                query: { MoveEventType: `${packageId}::trigger::ProjectCreated` },
                limit: 100
            });
            const deletedEvents = await client.queryEvents({
                query: { MoveEventType: `${packageId}::trigger::ProjectDeleted` },
                limit: 100
            });

            const deletedIds = new Set(deletedEvents.data.map(ev => {
                const fields = ev.parsedJson as any;
                return fields?.project_id;
            }).filter(Boolean));

            const activeIds = createdEvents.data
                .map(ev => {
                    const fields = ev.parsedJson as any;
                    return fields?.project_id;
                })
                .filter(id => id && !deletedIds.has(id));

            return Array.from(new Set(activeIds));
        } catch (e: any) {
            console.error("[Automation Engine] Failed to discover projects via events:", e.message);
            return [];
        }
    }

    async function checkTriggers() {
        try {
            const activeIds = await discoverProjects();
            
            for (const projectId of activeIds) {
                // Verify if this runner is authorized for this project
                let isAuthorized = false;
                try {
                    isAuthorized = await isRunnerAuthorized(projectId);
                } catch (err: any) {
                    // Fail silently or log check warning
                }

                if (!isAuthorized) {
                    continue;
                }

                const functions = await fetchProjectFunctions(projectId);
                const verifiedFunctions = functions.filter(fn => fn.status === 1);
                
                // Only process automated triggers in the polling engine
                const automatedFunctions = verifiedFunctions.filter(fn => fn.triggerType === 1 || fn.triggerType === 2 || fn.triggerType === 3);
                
                if (automatedFunctions.length === 0) {
                    continue; // Nothing to poll for this project
                }

                // Check Vault Balance before attempting automated triggers
                const vaultBalance = await checkProjectVaultBalance(projectId);
                const computeFee = await getGlobalComputeFee();
                if (vaultBalance < computeFee) {
                    console.log(`[Automation Engine] Skipping automated triggers for project ${projectId}: Insufficient Vault Balance (${vaultBalance} SUI)`);
                    continue;
                }

                for (const fn of automatedFunctions) {
                    const { name, triggerType, triggerConfig, lastExecutionTime } = fn;

                    // Off-chain pre-check: if triggered recently on-chain (within 15 seconds), skip to avoid duplicate fee/revert
                    if (Date.now() - lastExecutionTime < 15000) {
                        continue;
                    }
                    const trackerKey = `${projectId}::${name}`;
                    const now = Date.now();

                    // 1. Cron Trigger
                    if (triggerType === 1) {
                        try {
                            const config = JSON.parse(triggerConfig);
                            const interval = config.interval || 60; // in seconds
                            const lastRun = lastCronRunTimes.get(trackerKey) || 0;

                            if (now - lastRun >= interval * 1000) {
                                console.log(`[Automation Engine] Cron trigger fired for "${name}" under project ${projectId} (interval: ${interval}s)`);
                                lastCronRunTimes.set(trackerKey, now);
                                await triggerFunctionExecution(projectId, name, "{}");
                            }
                        } catch (e: any) {
                            console.warn(`[Automation Engine] Invalid Cron config for "${name}":`, e.message);
                        }
                    }

                    // 2. Sui Event Trigger
                    else if (triggerType === 2) {
                        try {
                            const config = JSON.parse(triggerConfig);
                            const eventPackageId = config.packageId;
                            const eventModuleName = config.moduleName || "trigger";
                            const eventName = config.eventName;

                            if (eventPackageId && eventName) {
                                const eventsResult = await client.queryEvents({
                                    query: { 
                                        MoveModule: {
                                            package: eventPackageId,
                                            module: eventModuleName
                                        }
                                    },
                                    order: 'descending',
                                    limit: 5
                                });

                                const matchingEvents = eventsResult.data.filter(ev => ev.type.includes(eventName));
                                if (matchingEvents.length > 0) {
                                    const latestEvent = matchingEvents[0];
                                    const lastDigest = lastProcessedEventTx.get(trackerKey);

                                    if (lastDigest !== latestEvent.id.txDigest) {
                                        // Make sure we don't trigger on stale events on startup
                                        if (lastDigest !== undefined) {
                                            console.log(`[Automation Engine] Event trigger matched for "${name}" on event "${latestEvent.type}"`);
                                            await triggerFunctionExecution(projectId, name, JSON.stringify(latestEvent.parsedJson || {}));
                                        }
                                        lastProcessedEventTx.set(trackerKey, latestEvent.id.txDigest);
                                    }
                                }
                            }
                        } catch (e: any) {
                            console.warn(`[Automation Engine] Invalid Event config for "${name}":`, e.message);
                        }
                    }

                    // 3. Price Drift Trigger
                    else if (triggerType === 3) {
                        try {
                            const config = JSON.parse(triggerConfig);
                            const drift_threshold = config.drift_threshold || 0.001; // 0.1% default
                            const lastPrice = lastTriggeredPrices.get(trackerKey);
                            const lastRun = lastCronRunTimes.get(trackerKey) || 0;
                            const livePrice = await fetchSuiPrice();

                            let shouldTrigger = false;
                            if (lastPrice === undefined) {
                                console.log(`[Automation Engine] Initializing price tracker for "${name}" (Project: ${projectId}). Live price: $${livePrice}`);
                                lastTriggeredPrices.set(trackerKey, livePrice);
                                lastCronRunTimes.set(trackerKey, now);
                                shouldTrigger = true; // trigger initially
                            } else {
                                const diff = Math.abs(livePrice - lastPrice);
                                const drift = diff / lastPrice;
                                
                                // Only log if the drift is non-trivial (greater than 0.005%)
                                if (drift > 0.00005) {
                                    console.log(`[Automation Engine] Price check for "${name}" (Project: ${projectId}): Live=$${livePrice.toFixed(4)}, Last=$${lastPrice.toFixed(4)}, Drift=${(drift * 100).toFixed(3)}%`);
                                }

                                if (drift >= drift_threshold) {
                                    console.log(`[Automation Engine] Drift threshold exceeded for "${name}" (Project: ${projectId}): ${(drift * 100).toFixed(3)}% >= ${(drift_threshold * 100).toFixed(3)}%`);
                                    shouldTrigger = true;
                                } else if (now - lastRun >= 5 * 60 * 1000) {
                                    // 5 minute heartbeat
                                    console.log(`[Automation Engine] Heartbeat limit reached for "${name}" (Project: ${projectId})`);
                                    shouldTrigger = true;
                                }
                            }

                            if (shouldTrigger) {
                                lastTriggeredPrices.set(trackerKey, livePrice);
                                lastCronRunTimes.set(trackerKey, now);
                                await triggerFunctionExecution(projectId, name, JSON.stringify({ price: livePrice, timestamp: new Date().toISOString() }));
                            }
                        } catch (e: any) {
                            console.warn(`[Automation Engine] Invalid Drift config for "${name}":`, e.message);
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error("[Automation Engine] Error during check:", error.message);
        } finally {
            setTimeout(checkTriggers, CHECK_INTERVAL);
        }
    }

    checkTriggers();
}

/**
 * Polls for ExecutionTriggered events from the specified package.
 * @param packageId The ID of the deployed Move package.
 */
export async function startSuiListener(packageId: string) {
    console.log(`\x1b[90m[Network] Listening for workloads on package:\x1b[0m ${packageId}...`);
    
    let cursor: any = null;
    let isPolling = false;

    // Fetch the latest event to use as the starting cursor, avoiding replaying past history on startup
    try {
        const latestEvent = await client.queryEvents({
            query: { 
                MoveModule: { 
                    package: packageId, 
                    module: 'trigger' 
                } 
            },
            order: 'descending',
            limit: 1
        });
        if (latestEvent && latestEvent.data && latestEvent.data.length > 0) {
            cursor = latestEvent.data[0].id;
            console.log(`\x1b[90m[Listener] Starting poll from the latest event cursor...\x1b[0m`);
        } else {
            console.log(`\x1b[90m[Listener] No historical events found. Starting poll from the beginning.\x1b[0m`);
        }
    } catch (e: any) {
        console.warn(`[Listener] Failed to fetch latest event cursor on startup (will poll from beginning):`, e.message);
    }

    console.log(`\x1b[32m● Node is online and actively polling...\x1b[0m \x1b[90m(Press Ctrl+C to stop)\x1b[0m\n`);

    // Recursive timeout polling to prevent race conditions
    async function poll() {
        if (isPolling) return;
        isPolling = true;
        
        try {
            // Query for events from the package
            const result = await client.queryEvents({
                query: { 
                    MoveModule: { 
                        package: packageId, 
                        module: 'trigger' 
                    } 
                },
                cursor: cursor,
                order: 'ascending',
            });

            if (result.data.length > 0) {
                // Capture nextCursor immediately to advance polling state
                const nextCursor = result.nextCursor;

                for (const event of result.data) {
                    if (event.type.includes('ExecutionTriggered')) {
                        console.log("\n--- New Execution Triggered ---");
                        const { project_id, walrus_blob_id, function_name, caller, input_data, execution_mode, assigned_runner, nonce } = event.parsedJson as any;

                        if (walrus_blob_id) {
                            try {
                                let delayMs = 0;
                                if (execution_mode === 1) { // Dedicated Runner Mode
                                    if (assigned_runner !== keypair?.toSuiAddress()) {
                                        console.log(`\x1b[90m[Network] Skipping execution for project: ${project_id} (Assigned to dedicated runner: ${assigned_runner})\x1b[0m`);
                                        continue;
                                    }
                                } else {
                                    if (assigned_runner !== keypair?.toSuiAddress()) {
                                        console.log(`\x1b[90m[Network] Not assigned runner for Execution. Waiting 10 seconds as fallback...\x1b[0m`);
                                        delayMs = 10500; // 10.5 second fallback
                                    } else {
                                        console.log(`\x1b[90m[Network] Processing Public Compute Pool Execution task (Assigned Runner!)...\x1b[0m`);
                                    }
                                }

                                const processTask = async () => {
                                    const vaultBalance = await checkProjectVaultBalance(project_id);
                                    const computeFee = await getGlobalComputeFee();
                                    if (vaultBalance < computeFee) {
                                        console.log(`[Listener] Skipping execution for project ${project_id}: Insufficient Vault Balance (${vaultBalance} SUI)`);
                                        return;
                                    }

                                    // Fallback optimization: Check if already completed
                                    if (delayMs > 0) {
                                        try {
                                            const projectObj = await client.getObject({ id: project_id, options: { showContent: true } });
                                            if (projectObj.data?.content && 'fields' in projectObj.data.content) {
                                                const fields = projectObj.data.content.fields as any;
                                                const tableId = fields.executions?.fields?.id?.id;
                                                if (tableId) {
                                                    const record = await client.getDynamicFieldObject({ 
                                                        parentId: tableId, 
                                                        name: { type: 'u64', value: nonce.toString() } 
                                                    });
                                                    const recordFields = (record.data?.content as any)?.fields?.value?.fields;
                                                    if (recordFields && recordFields.completed) {
                                                        console.log(`\x1b[90m[Network] Execution already processed by another node. Skipping sandbox.\x1b[0m`);
                                                        return;
                                                    }
                                                }
                                            }
                                        } catch (e: any) {
                                            // Ignore check failures and proceed
                                        }
                                    }

                                    console.log(`Triggering function: ${function_name} (Blob: ${walrus_blob_id}) for project: ${project_id}`);
                                    console.log(`Caller: ${caller}`);
                                    
                                    // 1. Fetch code from Walrus
                                    const code = await fetchFunctionCode(walrus_blob_id);
                                    
                                    // 2. Execute in Sandbox
                                    console.log("Executing in sandbox with input:", input_data);
                                    let executionResult: any;
                                    try {
                                        executionResult = await executeInSandbox(code, input_data);
                                        console.log("Execution Result:", executionResult);
                                    } catch (sandboxErr: any) {
                                        console.error("Sandbox Execution Error:", sandboxErr.message);
                                        executionResult = { status: "error", error: sandboxErr.message };
                                    }

                                    // 3. Submit result back to Sui
                                    if (keypair) {
                                        console.log(`Submitting result back to Sui...`);
                                        const tx = new Transaction();
                                        const packageId = process.env.PACKAGE_ID || FALLBACK_PACKAGE_ID;
                                        const treasuryId = process.env.PROTOCOL_TREASURY_ID || FALLBACK_TREASURY_ID;
                                        
                                        tx.moveCall({
                                            target: `${packageId}::trigger::submit_result`,
                                            arguments: [
                                                tx.object(project_id),
                                                tx.object(treasuryId),
                                                tx.pure.string(function_name),
                                                tx.pure.string(JSON.stringify(executionResult) ?? "null"),
                                                tx.pure.u64(nonce),
                                                tx.object("0x6") // SUI Clock
                                            ]
                                        });

                                        try {
                                            const writeResult = await client.signAndExecuteTransaction({
                                                signer: keypair,
                                                transaction: tx
                                            });
                                            console.log(`Result submitted successfully! Tx Digest: ${writeResult.digest}`);
                                        } catch(e: any) {
                                            if (e.message.includes('888')) {
                                                console.log(`\x1b[90m[Network] Execution already processed by another node. Skipping.\x1b[0m`);
                                            } else {
                                                console.error("Error submitting execution result:", e.message);
                                            }
                                        }
                                    } else {
                                        console.warn("WARNING: ADMIN_SECRET_KEY is not set. Skipping on-chain submission.");
                                    }
                                };
                                
                                if (delayMs > 0) {
                                    setTimeout(processTask, delayMs);
                                } else {
                                    processTask();
                                }
                            } catch (error: any) {
                                console.error("Error processing execution:", error.message);
                            }
                        }
                    } else if (event.type.includes('VerificationRequested')) {
                        console.log("\n--- New Verification Requested ---");
                        const { project_id, function_name, walrus_blob_id, auditor_blob_id, assigned_runner, nonce } = event.parsedJson as any;

                        if (walrus_blob_id) {
                            try {
                                let delayMs = 0;
                                if (assigned_runner !== keypair?.toSuiAddress()) {
                                    console.log(`\x1b[90m[Network] Not assigned runner for Verification. Waiting 10 seconds as fallback...\x1b[0m`);
                                    delayMs = 10500;
                                } else {
                                    console.log(`\x1b[90m[Network] Processing Verification task (Assigned Runner!)...\x1b[0m`);
                                }
                                
                                const processVerification = async () => {
                                    // Security Rule: Enforce the global secure platform auditor for the shared runner fleet
                                    const DEFAULT_PLATFORM_AUDITOR = 'TJgeWW4t-MOv1K2klEsC0eDTDZbmcUu610eHptXD9mA';
                                    console.log(`[Security Policy] Overriding with Global Platform Auditor: ${DEFAULT_PLATFORM_AUDITOR} (Requested: ${auditor_blob_id})`);
                                    console.log(`Auditing function: ${function_name} (Blob: ${walrus_blob_id})`);
                                    
                                    // Fallback optimization: Check if already completed
                                    if (delayMs > 0) {
                                        try {
                                            const projectObj = await client.getObject({ id: project_id, options: { showContent: true } });
                                            if (projectObj.data?.content && 'fields' in projectObj.data.content) {
                                                const fields = projectObj.data.content.fields as any;
                                                const tableId = fields.verifications?.fields?.id?.id;
                                                if (tableId) {
                                                    const record = await client.getDynamicFieldObject({ 
                                                        parentId: tableId, 
                                                        name: { type: 'u64', value: nonce.toString() } 
                                                    });
                                                    const recordFields = (record.data?.content as any)?.fields?.value?.fields;
                                                    if (recordFields && recordFields.completed) {
                                                        console.log(`\x1b[90m[Network] Verification already processed by another node. Skipping sandbox.\x1b[0m`);
                                                        return;
                                                    }
                                                }
                                            }
                                        } catch (e: any) {
                                            // Ignore check failures and proceed
                                        }
                                    }
                                    
                                    // 1. Fetch the platform-wide secure auditor script code
                                    const auditorCode = await fetchFunctionCode(DEFAULT_PLATFORM_AUDITOR);
                                    
                                    // 2. Run the auditor script inside sandbox with target function blobId as input
                                    const inputObj = { blobId: walrus_blob_id };
                                    console.log(`Booting sandbox with auditor code...`);
                                    const auditResult = await executeInSandbox(auditorCode, JSON.stringify(inputObj));
                                    
                                    console.log("Audit Result:", auditResult);
                                    const approved = auditResult && auditResult.approved === true;
                                    
                                    // 3. Submit verification result back to Sui
                                    if (keypair) {
                                        console.log(`Submitting audit verification response (Approved: ${approved}) to Move contract...`);
                                        const tx = new Transaction();
                                        const packageId = process.env.PACKAGE_ID || FALLBACK_PACKAGE_ID;
                                        
                                        tx.moveCall({
                                            target: `${packageId}::trigger::confirm_verification`,
                                            arguments: [
                                                tx.object(project_id),
                                                tx.pure.string(function_name),
                                                tx.pure.bool(approved),
                                                tx.pure.u64(nonce),
                                                tx.object("0x6") // SUI Clock
                                            ]
                                        });

                                        try {
                                            const writeResult = await client.signAndExecuteTransaction({
                                                signer: keypair,
                                                transaction: tx
                                            });
                                            console.log(`Verification confirmed on-chain! Tx Digest: ${writeResult.digest}`);
                                        } catch (e: any) {
                                            if (e.message.includes('888')) {
                                                console.log(`\x1b[90m[Network] Verification already processed by another node. Skipping.\x1b[0m`);
                                            } else {
                                                console.error("Error submitting verification:", e.message);
                                            }
                                        }
                                    } else {
                                        console.warn("WARNING: ADMIN_SECRET_KEY is not set. Skipping on-chain verification confirmation.");
                                    }
                                };
                                
                                if (delayMs > 0) {
                                    setTimeout(processVerification, delayMs);
                                } else {
                                    processVerification();
                                }
                            } catch (error: any) {
                                console.error("Error processing verification:", error.message);
                            }
                        }
                    }
                }

                // Update cursor
                cursor = nextCursor;
            }
        } catch (error: any) {
            console.error("Polling error:", error.message);
        } finally {
            isPolling = false;
            // Schedule the next poll tick 3 seconds AFTER the current one completely finishes
            setTimeout(poll, 3000);
        }
    }

    // Start first poll tick
    setTimeout(poll, 1000);
    
    // Handle process termination
    process.on('SIGINT', () => {
        console.log("\nStopping listener...");
        process.exit(0);
    });
}

// Start the execution listener and dynamic automation engine
const packageId = process.env.PACKAGE_ID || FALLBACK_PACKAGE_ID;
if (packageId === "0x0") {
    console.warn("\x1b[33m[Warning] PACKAGE_ID is not set.\x1b[0m");
}

startSuiListener(packageId);

// Also start the dynamic automation engine
startDynamicAutomationEngine().catch(e => console.error(`\x1b[31m[Automation Engine Error]\x1b[0m`, e));
