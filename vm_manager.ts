import ivm from 'isolated-vm';
import * as inspector from 'inspector';
import { initFHE, addCiphertexts, multiplyCiphertextByScalar } from './fhe_manager.js';
import { SecurityManager } from './security_manager.js';

/**
 * Executes the provided code in a secure sandbox.
 * @param code The JS code string to execute.
 */
export async function executeInSandbox(code: string, inputData: string = '{}'): Promise<any> {
    // Initialize FHE engine lazily
    await initFHE();

    // --- INTRUSION DETECTION: DEBUGGER TRAP ---
    // If an operator runs this with `node --inspect` to read memory, instantly crash and slash.
    if (inspector.url() !== undefined) {
        throw new Error("CRITICAL SECURITY ALERT: Unauthorized debugger attached. Execution blocked. Slashing operator stake.");
    }

    // Create a new isolate with 128MB memory limit
    const isolate = new ivm.Isolate({ memoryLimit: 128 });

    // Create a new context
    const context = await isolate.createContext();

    // Get a Reference{} to the global object within the context
    const jail = context.global;

    // --- INTRUSION DETECTION: CANARY TRAP INJECTION ---
    // Inject Honey-Tokens (fake API keys) into the input data.
    // If the operator dumps RAM, they steal the fake keys.
    const operatorId = "0xNodeOperatorWalletAddress"; // In production, this is the signed operator's address
    let parsedInput = {};
    try {
        parsedInput = JSON.parse(inputData);
    } catch(e) {}
    
    const securedInputData = SecurityManager.injectCanaries(parsedInput, operatorId);
    
    console.log(`\x1b[35m[SECURITY MANAGER] \x1b[90mInjected ${Object.keys(securedInputData).length - Object.keys(parsedInput).length} Honey-Token Canary Traps into RAM.\x1b[0m`);

    // Inject inputData variable
    await jail.set('rawInputData', JSON.stringify(securedInputData));

    // 1. Inject console.log mapping
    await jail.set('log', new ivm.Reference(function(...args: any[]) {
        console.log('[VM]', ...args);
    }));

    // 2. Inject async fetch shim mapping
    await jail.set('fetchShim', new ivm.Reference(async function(url: string) {
        try {
            const response = await fetch(url);
            const text = await response.text();
            return text;
        } catch (e: any) {
            return JSON.stringify({ error: e.message });
        }
    }));

    // 3. Inject FHE bindings
    await jail.set('fheAddShim', new ivm.Reference(function(n: string, g: string, cipherA: string, cipherB: string) {
        return addCiphertexts(n, g, cipherA, cipherB);
    }));
    await jail.set('fheMultiplyScalarShim', new ivm.Reference(function(n: string, g: string, cipher: string, scalar: string) {
        return multiplyCiphertextByScalar(n, g, cipher, scalar);
    }));

    // 4. Inject SuiProxy secure fetch shim
    await jail.set('proxyFetchShim', new ivm.Reference(async function(url: string, optionsJson: string) {
        try {
            const parsedOptions = JSON.parse(optionsJson || '{}');
            const projectId = "sui-func-test-project"; // Mock project ID for testing
            
            const proxyPayload = {
                targetUrl: url,
                method: parsedOptions.method || 'GET',
                headers: parsedOptions.headers || {},
                body: parsedOptions.body,
                projectId: projectId
            };

            const proxyPort = process.env.PROXY_PORT || 3000;
            const response = await fetch(`http://localhost:${proxyPort}/proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(proxyPayload)
            });

            const text = await response.text();
            return {
                status: response.status,
                text: text
            };
        } catch (e: any) {
            return { status: 500, text: JSON.stringify({ error: e.message }) };
        }
    }));

    // Prepend shims for console.log, async fetch, TextEncoder and TextDecoder
    const shimmedCode = `
        globalThis.console = {
            log: (...args) => log.applySync(undefined, args, { arguments: { copy: true } })
        };
        globalThis.fetch = async (url) => {
            const text = await fetchShim.apply(undefined, [url], { result: { promise: true, copy: true } });
            return {
                text: async () => text,
                json: async () => JSON.parse(text)
            };
        };
        globalThis.SuiFHE = {
            add: (pubKey, cipherA, cipherB) => fheAddShim.applySync(undefined, [pubKey.n, pubKey.g, cipherA, cipherB], { arguments: { copy: true } }),
            multiplyByScalar: (pubKey, cipher, scalar) => fheMultiplyScalarShim.applySync(undefined, [pubKey.n, pubKey.g, cipher, scalar], { arguments: { copy: true } })
        };
        globalThis.SuiProxy = {
            fetch: async (url, options = {}) => {
                const optionsJson = JSON.stringify(options);
                const res = await proxyFetchShim.apply(undefined, [url, optionsJson], { result: { promise: true, copy: true } });
                return {
                    status: res.status,
                    text: async () => res.text,
                    json: async () => JSON.parse(res.text)
                };
            }
        };
        globalThis.TextEncoder = class TextEncoder {
            encode(str) {
                const arr = new Uint8Array(str.length);
                for (let i = 0; i < str.length; i++) {
                    arr[i] = str.charCodeAt(i) & 0xff;
                }
                return arr;
            }
        };
        globalThis.TextDecoder = class TextDecoder {
            decode(arr) {
                let str = "";
                for (let i = 0; i < arr.length; i++) {
                    str += String.fromCharCode(arr[i]);
                }
                return str;
            }
        };
        globalThis.inputData = rawInputData;
        try {
            globalThis.input = JSON.parse(rawInputData);
        } catch (e) {
            globalThis.input = {};
        }
        (async function() {
            ${code}
        })()
    `;

    try {
        // Compile the code
        const script = await isolate.compileScript(shimmedCode);

        // --- INTRUSION DETECTION: TIMING ANOMALY ---
        // If an operator uses process tracing or advanced breakpoints, execution time will balloon.
        const startTime = performance.now();
        
        let result;
        try {
            result = await script.run(context, { timeout: 1000, copy: true, promise: true });
        } catch (e) {
            isolate.dispose();
            throw e;
        }

        const executionTimeMs = performance.now() - startTime;
        if (executionTimeMs > 250) { // Typical execution takes < 10ms. Anything over 250ms is highly suspicious.
            console.warn(`[SECURITY WARNING] Timing anomaly detected. Execution took ${executionTimeMs.toFixed(2)}ms. Possible memory tracing attempt.`);
        }

        isolate.dispose();
        return result;
    } catch (error: any) {
        throw new Error(`Execution failed: ${error.message}`);
    } finally {
        // Clean up
        context.release();
    }
}
