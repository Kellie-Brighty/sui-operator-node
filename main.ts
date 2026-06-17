import * as dotenv from 'dotenv';
import { fetchFunctionCode } from './aggregator.js';
import { executeInSandbox } from './vm_manager.js';

dotenv.config();

async function startRunner() {
    // The provided Blob ID for the hello_world.js function
    const BLOB_ID = "W7VwX2jrIHLoY6kve6zLKR9JvaF30k_2tql-g6qcNxQ";

    console.log("=== Sui-Functions Runner Starting ===");
    
    try {
        // 1. Fetch the code from Walrus
        const code = await fetchFunctionCode(BLOB_ID);
        
        // 2. Boot the sandbox and execute
        console.log("Booting sandbox and executing code...");
        const result = await executeInSandbox(code);
        
        console.log("=== Execution Complete ===");
        if (result) {
            console.log("Result:", result);
        }
    } catch (error: any) {
        console.error("!!! Runner Error !!!");
        console.error(error.message);
        process.exit(1)
    }
}

startRunner();
