import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = path.resolve(process.cwd(), '.cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Fetches the raw JS code from the Walrus testnet aggregator.
 * Implements a local disk cache to survive blob expiration on Walrus.
 * Includes a hardcoded fallback for the Walrus Auditor script.
 * @param blobId The Walrus Blob ID of the function code.
 * @returns The raw string content of the function.
 */
export async function fetchFunctionCode(blobId: string): Promise<string> {
    const cachePath = path.join(CACHE_DIR, blobId);

    // 1. Check local cache first
    if (fs.existsSync(cachePath)) {
        console.log(`[Cache] Found blob ${blobId} in local cache. Loading...`);
        try {
            return fs.readFileSync(cachePath, 'utf8');
        } catch (err: any) {
            console.warn(`[Cache] Failed to read from cache for ${blobId}:`, err.message);
        }
    }

    const aggregatorUrl = `https://walrus-testnet-aggregator.nodes.guru/v1/blobs/${blobId}`;
    
    try {
        console.log(`Fetching code from Walrus: ${blobId}...`);
        const response = await axios.get(aggregatorUrl, {
            responseType: 'text',
            timeout: 8000 // 8 second timeout to fail fast and fallback
        });
        const content = response.data;

        // Save to cache
        try {
            fs.writeFileSync(cachePath, content, 'utf8');
            console.log(`[Cache] Successfully cached blob ${blobId} locally.`);
        } catch (err: any) {
            console.warn(`[Cache] Failed to write cache for ${blobId}:`, err.message);
        }

        return content;
    } catch (error: any) {
        console.warn(`[Aggregator] Failed to fetch ${blobId} from Walrus: ${error.message}`);
        
        // 2. Local Fallback for the Auditor Script
        // Known auditor blob IDs
        const isAuditorBlob = blobId === 'TJgeWW4t-MOv1K2klEsC0eDTDZbmcUu610eHptXD9mA' || 
                              blobId === 'IOZ6RiUYqqkGVoxkjA29xe1o51j_t053-r6CjmejrNE';
        if (isAuditorBlob) {
            console.log(`[Fallback] Walrus download failed. Loading local auditor backup from functions/walrus_auditor.js...`);
            
            // Search in multiple possible relative paths
            const paths = [
                path.resolve(process.cwd(), '../functions/walrus_auditor.js'),
                path.resolve(process.cwd(), './functions/walrus_auditor.js'),
                '/Users/pc/Documents/sui-functions/functions/walrus_auditor.js'
            ];
            
            for (const fallbackPath of paths) {
                if (fs.existsSync(fallbackPath)) {
                    try {
                        return fs.readFileSync(fallbackPath, 'utf8');
                    } catch (readErr: any) {
                        console.warn(`[Fallback] Failed to read fallback path ${fallbackPath}:`, readErr.message);
                    }
                }
            }
            console.error(`[Fallback] Local auditor backup not found at any search location.`);
        }
        
        throw new Error(`Failed to fetch code from Walrus: ${error.message}`);
    }
}
