import crypto from 'crypto';

export interface CanaryTraps {
    [key: string]: string;
}

/**
 * The Security Manager dynamically analyzes input data and generates 
 * Honey-Tokens (Canary Traps) that perfectly mimic the structure of real secrets.
 */
export class SecurityManager {
    
    // --- PATTERN RECOGNITION HEURISTICS ---
    static PATTERNS = [
        {
            name: "STRIPE",
            regex: /^sk_(live|test)_[a-zA-Z0-9]{16,}$/,
            generate: (operatorId: string, i: number, original: string) => {
                const prefix = original.startsWith('sk_live_') ? 'sk_live_' : 'sk_test_';
                const hash = crypto.createHash('sha256').update(`${operatorId}-stripe-${i}`).digest('hex').substring(0, original.length - prefix.length);
                return prefix + hash;
            }
        },
        {
            name: "OPENAI",
            regex: /^sk-(proj-)?[a-zA-Z0-9_-]{16,}$/,
            generate: (operatorId: string, i: number, original: string) => {
                const isProj = original.startsWith('sk-proj-');
                const prefix = isProj ? 'sk-proj-' : 'sk-';
                // OpenAI uses base64-like strings (alphanumeric + hyphen/underscore)
                let hash = crypto.createHash('sha256').update(`${operatorId}-openai-${i}`).digest('base64').replace(/[+/=]/g, 'x').substring(0, original.length - prefix.length);
                return prefix + hash;
            }
        },
        {
            name: "GENERIC_HEX",
            regex: /^[a-fA-F0-9]{16,}$/,
            generate: (operatorId: string, i: number, original: string) => {
                let hash = crypto.createHash('sha256').update(`${operatorId}-hex-${i}`).digest('hex');
                // Pad if necessary, then truncate to match original length exactly
                while (hash.length < original.length) {
                    hash += crypto.createHash('sha256').update(hash).digest('hex');
                }
                return hash.substring(0, original.length);
            }
        },
        {
            name: "GENERIC_ALPHANUMERIC",
            regex: /^[a-zA-Z0-9]{16,}$/,
            generate: (operatorId: string, i: number, original: string) => {
                let hash = crypto.createHash('sha256').update(`${operatorId}-alpha-${i}`).digest('base64').replace(/[^a-zA-Z0-9]/g, 'x');
                while (hash.length < original.length) {
                    hash += crypto.createHash('sha256').update(hash).digest('base64').replace(/[^a-zA-Z0-9]/g, 'x');
                }
                return hash.substring(0, original.length);
            }
        }
    ];

    /**
     * Recursively scans the input data object for strings that look like secrets.
     */
    static findSecrets(data: any): string[] {
        let secrets: string[] = [];
        
        if (typeof data === 'string') {
            for (const pattern of this.PATTERNS) {
                if (pattern.regex.test(data)) {
                    secrets.push(data);
                    break;
                }
            }
        } else if (Array.isArray(data)) {
            for (const item of data) {
                secrets.push(...this.findSecrets(item));
            }
        } else if (typeof data === 'object' && data !== null) {
            for (const key in data) {
                secrets.push(...this.findSecrets(data[key]));
            }
        }
        
        return secrets;
    }

    /**
     * Dynamically generates canaries based on the detected secrets.
     */
    static generateDynamicCanaries(inputData: any, operatorId: string, numTrapsPerSecret: number = 4): CanaryTraps {
        const canaries: CanaryTraps = {};
        const detectedSecrets = this.findSecrets(inputData);

        for (let s = 0; s < detectedSecrets.length; s++) {
            const secret = detectedSecrets[s];
            
            // Find which pattern matches
            for (const pattern of this.PATTERNS) {
                if (pattern.regex.test(secret)) {
                    for (let i = 0; i < numTrapsPerSecret; i++) {
                        // We salt the generator with the current time so multiple runs yield different traps
                        const trapKey = `${pattern.name}_CANARY_${s}_${i}`;
                        const fakeKey = pattern.generate(`${operatorId}-${Date.now()}`, i, secret);
                        canaries[trapKey] = fakeKey;
                    }
                    break; // Stop checking other patterns once matched
                }
            }
        }

        return canaries;
    }

    /**
     * Injects the dynamic canaries into the execution payload.
     */
    static injectCanaries(inputData: any, operatorId: string): any {
        const canaries = this.generateDynamicCanaries(inputData, operatorId);
        
        // Merge the honey-tokens into the environment/input data
        return {
            ...inputData,
            env_traps: canaries
        };
    }
}
