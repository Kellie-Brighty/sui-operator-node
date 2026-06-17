// functions/walrus_auditor.js
// Production-grade Multi-Language Walrus Storage Auditor

console.log("=========================================");
console.log("🛡️ WALRUS PRODUCTION MULTI-LANGUAGE AUDITOR");
console.log("=========================================");

const input = globalThis.input || {};
const targetBlobId = input.blobId || "0geOO6RLle4NjptiPQ0ZHzaTAb0Ghi-VyW5tfHHETj8";
const requestedLanguage = input.language || "auto"; // "auto" | "js" | "ts" | "python" | "wasm" | "rust" | "go"
const aggregatorUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${targetBlobId}`;

console.log(`Target Blob ID: ${targetBlobId}`);
console.log(`Fetch URL: ${aggregatorUrl}`);
console.log(`Language Mode: ${requestedLanguage}`);

try {
    const res = await fetch(aggregatorUrl);
    if (res.ok !== undefined && !res.ok) {
        throw new Error(`Failed to download blob from Walrus aggregator. Status: ${res.status}`);
    }

    // Determine content format (text or binary array buffer)
    let bytes;
    let codeText = "";
    if (res.arrayBuffer) {
        const arrayBuffer = await res.arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
    } else {
        codeText = await res.text();
        bytes = new TextEncoder().encode(codeText);
    }
    
    // Auto-detect language / file type
    let detectedLanguage = "unknown";
    let isBinary = false;
    
    // Check WASM Magic Bytes: \0asm (0x00, 0x61, 0x73, 0x6D)
    if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6D) {
        detectedLanguage = "wasm";
        isBinary = true;
    } else {
        // Parse as text for script checks if not already parsed
        if (!codeText) {
            const decoder = new TextDecoder("utf-8");
            codeText = decoder.decode(bytes);
        }
        
        if (requestedLanguage !== "auto") {
            detectedLanguage = requestedLanguage;
        } else {
            // Simple heuristics
            if (codeText.includes("import ") && (codeText.includes("def ") || codeText.includes("print(")) && !codeText.includes("function") && !codeText.includes("const ")) {
                detectedLanguage = "python";
            } else if (codeText.includes("fn main()") || codeText.includes("pub struct") || codeText.includes("use std::")) {
                detectedLanguage = "rust";
            } else if (codeText.includes("package main") && codeText.includes("func ")) {
                detectedLanguage = "go";
            } else if (codeText.includes("interface ") || codeText.includes("type ") || codeText.includes("as string")) {
                detectedLanguage = "typescript";
            } else {
                detectedLanguage = "javascript"; // Default fallback
            }
        }

        console.log(`Detected Language: ${detectedLanguage.toUpperCase()}`);

        const violations = [];
        let score = 100;

        if (detectedLanguage === "javascript" || detectedLanguage === "typescript") {
            const rules = [
                { pattern: /eval\s*\(/, weight: 40, desc: "Dynamic eval execution code block" },
                { pattern: /child_process|spawnSync|execSync/, weight: 50, desc: "Process spawning capabilities" },
                { pattern: /fs\.|require\s*\(\s*['"]fs['"]\)/, weight: 35, desc: "Direct file system access" },
                { pattern: /process\.exit|process\.kill/, weight: 30, desc: "Direct worker lifecycle manipulation" },
                { pattern: /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/, weight: 25, desc: "Potential CPU exhaustion infinite loop" }
            ];
            for (const rule of rules) {
                if (rule.pattern.test(codeText)) {
                    violations.push(rule.desc);
                    score -= rule.weight;
                }
            }
        } else if (detectedLanguage === "python") {
            const rules = [
                { pattern: /eval\s*\(|exec\s*\(/, weight: 45, desc: "Python eval/exec execution block" },
                { pattern: /subprocess|os\.system|os\.spawn|os\.popen/, weight: 50, desc: "System command execution modules" },
                { pattern: /open\s*\(|os\.remove|os\.rmdir|shutil/, weight: 30, desc: "Disk / File mutation operations" },
                { pattern: /while\s+True\s*:/, weight: 25, desc: "Python infinite loop pattern" }
            ];
            for (const rule of rules) {
                if (rule.pattern.test(codeText)) {
                    violations.push(rule.desc);
                    score -= rule.weight;
                }
            }
        } else if (detectedLanguage === "rust" || detectedLanguage === "go") {
            const rules = [
                { pattern: /unsafe\s*\{/, weight: 30, desc: "Rust unsafe memory access blocks" },
                { pattern: /std::process|syscall|os\/exec/, weight: 50, desc: "System execution libraries" },
                { pattern: /std::fs|os\.OpenFile|os\.Remove/, weight: 35, desc: "Disk write operations" }
            ];
            for (const rule of rules) {
                if (rule.pattern.test(codeText)) {
                    violations.push(rule.desc);
                    score -= rule.weight;
                }
            }
        }

        const finalScore = Math.max(0, score);
        const approved = finalScore >= 70;

        console.log(`Audit Complete. Violations: ${violations.length}. Final Safety Score: ${finalScore}/100.`);
        console.log(`Recommendation Status: ${approved ? "APPROVED" : "REJECTED"}`);

        return {
            status: "success",
            targetBlobId,
            detectedLanguage,
            isBinary: false,
            safetyScore: finalScore,
            violations,
            approved
        };
    }

    if (detectedLanguage === "wasm") {
        console.log("Analyzing compiled WebAssembly binary...");
        
        // Custom WASM binary headers verification
        const violations = [];
        let score = 100;

        // Extract imported functions module strings if present in WASM binary payload
        const rawStringData = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        
        // Simple WASM imports analyzer checking if the module imports system bindings
        if (rawStringData.includes("wasi_snapshot_preview1")) {
            violations.push("Uses WASI preview1 host system interface");
            score -= 20;
        }
        if (rawStringData.includes("env") && (rawStringData.includes("system") || rawStringData.includes("popen"))) {
            violations.push("Imports custom host system call executions");
            score -= 40;
        }

        const finalScore = Math.max(0, score);
        const approved = finalScore >= 70;

        console.log(`WASM Binary Audit Complete. Violations: ${violations.length}. Score: ${finalScore}/100.`);
        console.log(`Recommendation Status: ${approved ? "APPROVED" : "REJECTED"}`);

        return {
            status: "success",
            targetBlobId,
            detectedLanguage: "wasm",
            isBinary: true,
            sizeBytes: bytes.length,
            safetyScore: finalScore,
            violations,
            approved
        };
    }

} catch (error) {
    console.log(`Audit failed: ${error.message}`);
    return {
        status: "error",
        targetBlobId,
        message: error.message
    };
}
