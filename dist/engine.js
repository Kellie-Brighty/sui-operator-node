// listener.ts
import * as dotenv from "dotenv";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

// aggregator.ts
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
var CACHE_DIR = path.resolve(process.cwd(), ".cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}
async function fetchFunctionCode(blobId) {
  const cachePath = path.join(CACHE_DIR, blobId);
  if (fs.existsSync(cachePath)) {
    console.log(`[Cache] Found blob ${blobId} in local cache. Loading...`);
    try {
      return fs.readFileSync(cachePath, "utf8");
    } catch (err) {
      console.warn(`[Cache] Failed to read from cache for ${blobId}:`, err.message);
    }
  }
  const aggregatorUrl = `https://walrus-testnet-aggregator.nodes.guru/v1/blobs/${blobId}`;
  try {
    console.log(`Fetching code from Walrus: ${blobId}...`);
    const response = await axios.get(aggregatorUrl, {
      responseType: "text",
      timeout: 8e3
      // 8 second timeout to fail fast and fallback
    });
    const content = response.data;
    try {
      fs.writeFileSync(cachePath, content, "utf8");
      console.log(`[Cache] Successfully cached blob ${blobId} locally.`);
    } catch (err) {
      console.warn(`[Cache] Failed to write cache for ${blobId}:`, err.message);
    }
    return content;
  } catch (error) {
    console.warn(`[Aggregator] Failed to fetch ${blobId} from Walrus: ${error.message}`);
    const isAuditorBlob = blobId === "TJgeWW4t-MOv1K2klEsC0eDTDZbmcUu610eHptXD9mA" || blobId === "IOZ6RiUYqqkGVoxkjA29xe1o51j_t053-r6CjmejrNE";
    if (isAuditorBlob) {
      console.log(`[Fallback] Walrus download failed. Loading local auditor backup from functions/walrus_auditor.js...`);
      const paths = [
        path.resolve(process.cwd(), "../functions/walrus_auditor.js"),
        path.resolve(process.cwd(), "./functions/walrus_auditor.js"),
        "/Users/pc/Documents/sui-functions/functions/walrus_auditor.js"
      ];
      for (const fallbackPath of paths) {
        if (fs.existsSync(fallbackPath)) {
          try {
            return fs.readFileSync(fallbackPath, "utf8");
          } catch (readErr) {
            console.warn(`[Fallback] Failed to read fallback path ${fallbackPath}:`, readErr.message);
          }
        }
      }
      console.error(`[Fallback] Local auditor backup not found at any search location.`);
    }
    throw new Error(`Failed to fetch code from Walrus: ${error.message}`);
  }
}

// vm_manager.ts
import ivm from "isolated-vm";
import * as inspector from "inspector";

// node_modules/bigint-crypto-utils/dist/index.node.esm.js
function t(n2) {
  return n2 >= 0 ? n2 : -n2;
}
function e(n2) {
  if ("number" == typeof n2 && (n2 = BigInt(n2)), 1n === n2) return 1;
  let t2 = 1;
  do {
    t2++;
  } while ((n2 >>= 1n) > 1n);
  return t2;
}
function r(n2, t2) {
  if ("number" == typeof n2 && (n2 = BigInt(n2)), "number" == typeof t2 && (t2 = BigInt(t2)), n2 <= 0n || t2 <= 0n) throw new RangeError("a and b MUST be > 0");
  let e2 = 0n, r2 = 1n, o2 = 1n, i2 = 0n;
  for (; 0n !== n2; ) {
    const u2 = t2 / n2, s2 = t2 % n2, a2 = e2 - o2 * u2, c = r2 - i2 * u2;
    t2 = n2, n2 = s2, e2 = o2, r2 = i2, o2 = a2, i2 = c;
  }
  return { g: t2, x: e2, y: r2 };
}
function o(n2, t2) {
  if ("number" == typeof n2 && (n2 = BigInt(n2)), "number" == typeof t2 && (t2 = BigInt(t2)), t2 <= 0n) throw new RangeError("n must be > 0");
  const e2 = n2 % t2;
  return e2 < 0n ? e2 + t2 : e2;
}
function i(n2, t2) {
  const e2 = r(o(n2, t2), t2);
  if (1n !== e2.g) throw new RangeError(`${n2.toString()} does not have inverse modulo ${t2.toString()}`);
  return o(e2.x, t2);
}
function u(n2, t2, e2) {
  if (n2.length !== t2.length) throw new RangeError("The remainders and modulos arrays should have the same length");
  const r2 = e2 ?? t2.reduce(((n3, t3) => n3 * t3), 1n);
  return t2.reduce(((t3, e3, u2) => {
    const s2 = r2 / e3;
    return o(t3 + s2 * i(s2, e3) % r2 * n2[u2] % r2, r2);
  }), 0n);
}
function s(n2, e2) {
  let r2 = "number" == typeof n2 ? BigInt(t(n2)) : t(n2), o2 = "number" == typeof e2 ? BigInt(t(e2)) : t(e2);
  if (0n === r2) return o2;
  if (0n === o2) return r2;
  let i2 = 0n;
  for (; 0n === (1n & (r2 | o2)); ) r2 >>= 1n, o2 >>= 1n, i2++;
  for (; 0n === (1n & r2); ) r2 >>= 1n;
  do {
    for (; 0n === (1n & o2); ) o2 >>= 1n;
    if (r2 > o2) {
      const n3 = r2;
      r2 = o2, o2 = n3;
    }
    o2 -= r2;
  } while (0n !== o2);
  return r2 << i2;
}
function h(n2) {
  return n2.map(((n3) => n3[0] ** (n3[1] - 1n) * (n3[0] - 1n))).reduce(((n3, t2) => t2 * n3), 1n);
}
function d(n2, e2, r2, s2) {
  if ("number" == typeof n2 && (n2 = BigInt(n2)), "number" == typeof e2 && (e2 = BigInt(e2)), "number" == typeof r2 && (r2 = BigInt(r2)), r2 <= 0n) throw new RangeError("n must be > 0");
  if (1n === r2) return 0n;
  if (n2 = o(n2, r2), e2 < 0n) return i(d(n2, t(e2), r2, s2), r2);
  if (void 0 !== s2) return (function(n3, t2, e3, r3) {
    const o2 = r3.map(((n4) => n4[0] ** n4[1])), i2 = r3.map(((n4) => h([n4]))), s3 = i2.map(((e4, r4) => d(n3, t2 % e4, o2[r4])));
    return u(s3, o2, e3);
  })(n2, e2, r2, (function(n3) {
    const t2 = {};
    return n3.forEach(((n4) => {
      if ("bigint" == typeof n4 || "number" == typeof n4) {
        const e3 = String(n4);
        void 0 === t2[e3] ? t2[e3] = { p: BigInt(n4), k: 1n } : t2[e3].k += 1n;
      } else {
        const e3 = String(n4[0]);
        void 0 === t2[e3] ? t2[e3] = { p: BigInt(n4[0]), k: BigInt(n4[1]) } : t2[e3].k += BigInt(n4[1]);
      }
    })), Object.values(t2).map(((n4) => [n4.p, n4.k]));
  })(s2));
  let a2 = 1n;
  for (; e2 > 0; ) e2 % 2n === 1n && (a2 = a2 * n2 % r2), e2 /= 2n, n2 = n2 ** 2n % r2;
  return a2;
}
function l(n2) {
  let t2 = 0n;
  for (const e2 of n2.values()) {
    t2 = (t2 << 8n) + BigInt(e2);
  }
  return t2;
}
var b = await import("crypto");
function w(n2, t2 = false) {
  if (n2 < 1) throw new RangeError("byteLength MUST be > 0");
  {
    const e2 = b.randomBytes(n2);
    return t2 && (e2[0] = 128 | e2[0]), e2;
  }
}
function B(n2, t2 = false) {
  if (n2 < 1) throw new RangeError("bitLength MUST be > 0");
  const e2 = w(Math.ceil(n2 / 8), false), r2 = n2 % 8;
  if (0 !== r2 && (e2[0] = e2[0] & 2 ** r2 - 1), t2) {
    const n3 = 0 !== r2 ? 2 ** (r2 - 1) : 128;
    e2[0] = e2[0] | n3;
  }
  return e2;
}
function I(n2, t2 = 1n) {
  if (n2 <= t2) throw new RangeError("Arguments MUST be: max > min");
  const r2 = n2 - t2, o2 = e(r2);
  let i2;
  do {
    i2 = l(B(o2));
  } while (i2 > r2);
  return i2 + t2;
}
var _ = false;
try {
  await import("worker_threads"), _ = true;
} catch (o2) {
  console.log("[bigint-crypto-utils] WARNING:\nThis node version doesn't support worker_threads. You should enable them in order to greatly speedup the generation of big prime numbers.\n  \xB7 With Node >=11 it is enabled by default (consider upgrading).\n  \xB7 With Node 10, starting with 10.5.0, you can enable worker_threads at runtime executing node --experimental-worker ");
}
function M(n2, t2) {
  if (2n === n2) return true;
  if (0n === (1n & n2) || 1n === n2) return false;
  const e2 = [3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n, 59n, 61n, 67n, 71n, 73n, 79n, 83n, 89n, 97n, 101n, 103n, 107n, 109n, 113n, 127n, 131n, 137n, 139n, 149n, 151n, 157n, 163n, 167n, 173n, 179n, 181n, 191n, 193n, 197n, 199n, 211n, 223n, 227n, 229n, 233n, 239n, 241n, 251n, 257n, 263n, 269n, 271n, 277n, 281n, 283n, 293n, 307n, 311n, 313n, 317n, 331n, 337n, 347n, 349n, 353n, 359n, 367n, 373n, 379n, 383n, 389n, 397n, 401n, 409n, 419n, 421n, 431n, 433n, 439n, 443n, 449n, 457n, 461n, 463n, 467n, 479n, 487n, 491n, 499n, 503n, 509n, 521n, 523n, 541n, 547n, 557n, 563n, 569n, 571n, 577n, 587n, 593n, 599n, 601n, 607n, 613n, 617n, 619n, 631n, 641n, 643n, 647n, 653n, 659n, 661n, 673n, 677n, 683n, 691n, 701n, 709n, 719n, 727n, 733n, 739n, 743n, 751n, 757n, 761n, 769n, 773n, 787n, 797n, 809n, 811n, 821n, 823n, 827n, 829n, 839n, 853n, 857n, 859n, 863n, 877n, 881n, 883n, 887n, 907n, 911n, 919n, 929n, 937n, 941n, 947n, 953n, 967n, 971n, 977n, 983n, 991n, 997n, 1009n, 1013n, 1019n, 1021n, 1031n, 1033n, 1039n, 1049n, 1051n, 1061n, 1063n, 1069n, 1087n, 1091n, 1093n, 1097n, 1103n, 1109n, 1117n, 1123n, 1129n, 1151n, 1153n, 1163n, 1171n, 1181n, 1187n, 1193n, 1201n, 1213n, 1217n, 1223n, 1229n, 1231n, 1237n, 1249n, 1259n, 1277n, 1279n, 1283n, 1289n, 1291n, 1297n, 1301n, 1303n, 1307n, 1319n, 1321n, 1327n, 1361n, 1367n, 1373n, 1381n, 1399n, 1409n, 1423n, 1427n, 1429n, 1433n, 1439n, 1447n, 1451n, 1453n, 1459n, 1471n, 1481n, 1483n, 1487n, 1489n, 1493n, 1499n, 1511n, 1523n, 1531n, 1543n, 1549n, 1553n, 1559n, 1567n, 1571n, 1579n, 1583n, 1597n];
  for (let t3 = 0; t3 < e2.length && e2[t3] <= n2; t3++) {
    const r3 = e2[t3];
    if (n2 === r3) return true;
    if (n2 % r3 === 0n) return false;
  }
  let r2 = 0n;
  const o2 = n2 - 1n;
  let i2 = o2;
  for (; i2 % 2n === 0n; ) i2 /= 2n, ++r2;
  const u2 = o2 / 2n ** r2;
  do {
    let t3 = d(I(o2, 2n), u2, n2);
    if (1n === t3 || t3 === o2) continue;
    let e3 = 1;
    for (; e3 < r2 && (t3 = d(t3, 2n, n2), t3 !== o2); ) {
      if (1n === t3) return false;
      e3++;
    }
    if (t3 !== o2) return false;
  } while (0 != --t2);
  return true;
}
if (_) try {
  E = await import("worker_threads");
  if (!E.isMainThread && null !== E.parentPort) {
    const n2 = E.parentPort;
    n2.on("message", (function(t2) {
      if (void 0 !== t2?._bcu?.iterations && void 0 !== t2?._bcu?.rnd) {
        const e2 = { _bcu: { isPrime: M(t2._bcu.rnd, t2._bcu.iterations), value: t2._bcu.rnd, id: t2._bcu.id } };
        n2.postMessage(e2);
      }
    }));
  }
} catch (n2) {
}
var E;
var R = await import("os");
try {
  k = await import("worker_threads");
} catch {
}
var k;

// node_modules/paillier-bigint/dist/index.node.esm.js
var n = class {
  constructor(t2, n2) {
    this.n = t2, this._n2 = this.n ** 2n, this.g = n2;
  }
  get bitLength() {
    return e(this.n);
  }
  encrypt(n2, i2) {
    if (void 0 === i2) do {
      i2 = I(this.n);
    } while (1n !== s(i2, this.n));
    return d(this.g, n2, this._n2) * d(i2, this.n, this._n2) % this._n2;
  }
  addition(...t2) {
    return t2.reduce(((t3, n2) => t3 * n2 % this._n2), 1n);
  }
  plaintextAddition(n2, ...i2) {
    return i2.reduce(((n3, i3) => n3 * d(this.g, i3, this._n2) % this._n2), n2);
  }
  multiply(n2, i2) {
    return d(n2, i2, this._n2);
  }
};

// fhe_manager.ts
async function initFHE() {
  console.log("\u26A1 FHE Engine Initialized (Paillier Native JS)");
}
function addCiphertexts(nString, gString, cipherAStr, cipherBStr) {
  const publicKey = new n(BigInt(nString), BigInt(gString));
  console.log(`\x1B[36m[FHE ENGINE] \x1B[90mPerforming Homomorphic Addition on two blinded ciphertexts (Length: ${cipherAStr.length} chars)\x1B[0m`);
  const result = publicKey.addition(BigInt(cipherAStr), BigInt(cipherBStr));
  return result.toString();
}
function multiplyCiphertextByScalar(nString, gString, cipherStr, scalarStr) {
  const publicKey = new n(BigInt(nString), BigInt(gString));
  console.log(`\x1B[36m[FHE ENGINE] \x1B[90mPerforming Homomorphic Scalar Multiplication on blinded ciphertext (Length: ${cipherStr.length} chars)\x1B[0m`);
  const result = publicKey.multiply(BigInt(cipherStr), BigInt(scalarStr));
  return result.toString();
}

// security_manager.ts
import crypto from "crypto";
var SecurityManager = class {
  // --- PATTERN RECOGNITION HEURISTICS ---
  static PATTERNS = [
    {
      name: "STRIPE",
      regex: /^sk_(live|test)_[a-zA-Z0-9]{16,}$/,
      generate: (operatorId, i2, original) => {
        const prefix = original.startsWith("sk_live_") ? "sk_live_" : "sk_test_";
        const hash = crypto.createHash("sha256").update(`${operatorId}-stripe-${i2}`).digest("hex").substring(0, original.length - prefix.length);
        return prefix + hash;
      }
    },
    {
      name: "OPENAI",
      regex: /^sk-(proj-)?[a-zA-Z0-9_-]{16,}$/,
      generate: (operatorId, i2, original) => {
        const isProj = original.startsWith("sk-proj-");
        const prefix = isProj ? "sk-proj-" : "sk-";
        let hash = crypto.createHash("sha256").update(`${operatorId}-openai-${i2}`).digest("base64").replace(/[+/=]/g, "x").substring(0, original.length - prefix.length);
        return prefix + hash;
      }
    },
    {
      name: "GENERIC_HEX",
      regex: /^[a-fA-F0-9]{16,}$/,
      generate: (operatorId, i2, original) => {
        let hash = crypto.createHash("sha256").update(`${operatorId}-hex-${i2}`).digest("hex");
        while (hash.length < original.length) {
          hash += crypto.createHash("sha256").update(hash).digest("hex");
        }
        return hash.substring(0, original.length);
      }
    },
    {
      name: "GENERIC_ALPHANUMERIC",
      regex: /^[a-zA-Z0-9]{16,}$/,
      generate: (operatorId, i2, original) => {
        let hash = crypto.createHash("sha256").update(`${operatorId}-alpha-${i2}`).digest("base64").replace(/[^a-zA-Z0-9]/g, "x");
        while (hash.length < original.length) {
          hash += crypto.createHash("sha256").update(hash).digest("base64").replace(/[^a-zA-Z0-9]/g, "x");
        }
        return hash.substring(0, original.length);
      }
    }
  ];
  /**
   * Recursively scans the input data object for strings that look like secrets.
   */
  static findSecrets(data) {
    let secrets = [];
    if (typeof data === "string") {
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
    } else if (typeof data === "object" && data !== null) {
      for (const key in data) {
        secrets.push(...this.findSecrets(data[key]));
      }
    }
    return secrets;
  }
  /**
   * Dynamically generates canaries based on the detected secrets.
   */
  static generateDynamicCanaries(inputData, operatorId, numTrapsPerSecret = 4) {
    const canaries = {};
    const detectedSecrets = this.findSecrets(inputData);
    for (let s2 = 0; s2 < detectedSecrets.length; s2++) {
      const secret = detectedSecrets[s2];
      for (const pattern of this.PATTERNS) {
        if (pattern.regex.test(secret)) {
          for (let i2 = 0; i2 < numTrapsPerSecret; i2++) {
            const trapKey = `${pattern.name}_CANARY_${s2}_${i2}`;
            const fakeKey = pattern.generate(`${operatorId}-${Date.now()}`, i2, secret);
            canaries[trapKey] = fakeKey;
          }
          break;
        }
      }
    }
    return canaries;
  }
  /**
   * Injects the dynamic canaries into the execution payload.
   */
  static injectCanaries(inputData, operatorId) {
    const canaries = this.generateDynamicCanaries(inputData, operatorId);
    return {
      ...inputData,
      env_traps: canaries
    };
  }
};

// vm_manager.ts
async function executeInSandbox(code, inputData = "{}") {
  await initFHE();
  if (inspector.url() !== void 0) {
    throw new Error("CRITICAL SECURITY ALERT: Unauthorized debugger attached. Execution blocked. Slashing operator stake.");
  }
  const isolate = new ivm.Isolate({ memoryLimit: 128 });
  const context = await isolate.createContext();
  const jail = context.global;
  const operatorId = "0xNodeOperatorWalletAddress";
  let parsedInput = {};
  try {
    parsedInput = JSON.parse(inputData);
  } catch (e2) {
  }
  const securedInputData = SecurityManager.injectCanaries(parsedInput, operatorId);
  console.log(`\x1B[35m[SECURITY MANAGER] \x1B[90mInjected ${Object.keys(securedInputData).length - Object.keys(parsedInput).length} Honey-Token Canary Traps into RAM.\x1B[0m`);
  await jail.set("rawInputData", JSON.stringify(securedInputData));
  await jail.set("log", new ivm.Reference(function(...args) {
    console.log("[VM]", ...args);
  }));
  await jail.set("fetchShim", new ivm.Reference(async function(url2) {
    try {
      const response = await fetch(url2);
      const text = await response.text();
      return text;
    } catch (e2) {
      return JSON.stringify({ error: e2.message });
    }
  }));
  await jail.set("fheAddShim", new ivm.Reference(function(n2, g, cipherA, cipherB) {
    return addCiphertexts(n2, g, cipherA, cipherB);
  }));
  await jail.set("fheMultiplyScalarShim", new ivm.Reference(function(n2, g, cipher, scalar) {
    return multiplyCiphertextByScalar(n2, g, cipher, scalar);
  }));
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
    const script = await isolate.compileScript(shimmedCode);
    const startTime = performance.now();
    let result;
    try {
      result = await script.run(context, { timeout: 1e3, copy: true, promise: true });
    } catch (e2) {
      isolate.dispose();
      throw e2;
    }
    const executionTimeMs = performance.now() - startTime;
    if (executionTimeMs > 250) {
      console.warn(`[SECURITY WARNING] Timing anomaly detected. Execution took ${executionTimeMs.toFixed(2)}ms. Possible memory tracing attempt.`);
    }
    isolate.dispose();
    return result;
  } catch (error) {
    throw new Error(`Execution failed: ${error.message}`);
  } finally {
    context.release();
  }
}

// listener.ts
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import fs2 from "fs";
import path2 from "path";
import os from "os";
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});
dotenv.config({ path: ".env", override: false, quiet: true });
var client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet"
});
var FALLBACK_PACKAGE_ID = "0x41442ae1e170a68f3486ce0fd4fb03a2a48f4c69ee61cd5e8a563311aaaa3a95";
var FALLBACK_TREASURY_ID = "0x18bcfff30cc1dcdad91f4b3d3be4286251f339242e884989e52ff3017f15294f";
var FALLBACK_REGISTRY_ID = "0x48fc4208313f2fe1fce5df5a36af0cac209ca40db9855f7bb712cf2e95060ec1";
function getOrGenerateOperatorKey() {
  const configDir = path2.join(os.homedir(), ".sui-functions");
  const defaultKeyPath = path2.join(configDir, "operator.json");
  const keyPath = process.env.OPERATOR_KEY_PATH || defaultKeyPath;
  if (process.env.ADMIN_SECRET_KEY) {
    return Ed25519Keypair.fromSecretKey(process.env.ADMIN_SECRET_KEY);
  }
  if (fs2.existsSync(keyPath)) {
    try {
      const data = JSON.parse(fs2.readFileSync(keyPath, "utf8"));
      if (data.secretKey) {
        const kp = Ed25519Keypair.fromSecretKey(data.secretKey);
        console.log(`\x1B[32m\u2713 Loaded existing session key:\x1B[0m \x1B[90m${keyPath}\x1B[0m`);
        console.log(`\x1B[36m\u25BA Runner Address:\x1B[0m \x1B[1m${kp.toSuiAddress()}\x1B[0m
`);
        return kp;
      }
    } catch (e2) {
      console.warn("Failed to load existing key, generating a new one...");
    }
  }
  const newKeypair = new Ed25519Keypair();
  const targetDir = path2.dirname(keyPath);
  if (!fs2.existsSync(targetDir)) {
    fs2.mkdirSync(targetDir, { recursive: true });
  }
  fs2.writeFileSync(keyPath, JSON.stringify({ secretKey: newKeypair.getSecretKey() }, null, 2));
  console.log(`\x1B[35m\u2726 Generated new session key:\x1B[0m \x1B[90m${keyPath}\x1B[0m`);
  console.log(`\x1B[36m\u25BA Runner Address:\x1B[0m \x1B[1m${newKeypair.toSuiAddress()}\x1B[0m`);
  console.log(`\x1B[33m\u26A0 PASTE THIS ADDRESS IN THE DASHBOARD TO AUTHORIZE YOUR NODE \u26A0\x1B[0m
`);
  return newKeypair;
}
var keypair = getOrGenerateOperatorKey();
var projectRunnerCache = /* @__PURE__ */ new Map();
var CACHE_TTL = 30 * 1e3;
async function getGlobalComputeFee() {
  const treasuryId = process.env.PROTOCOL_TREASURY_ID || FALLBACK_TREASURY_ID;
  if (!treasuryId) return 7e-3;
  try {
    const treasuryObj = await client.getObject({
      id: treasuryId,
      options: { showContent: true }
    });
    const fields = treasuryObj.data?.content?.fields;
    const baseComputeFeeMist = fields?.base_compute_fee;
    if (baseComputeFeeMist) {
      return Number(baseComputeFeeMist) / 1e9;
    }
  } catch (e2) {
    console.warn(`[Listener] Failed to fetch global compute fee:`, e2.message);
  }
  return 7e-3;
}
async function isRunnerAuthorized(projectId) {
  if (!keypair) return false;
  const runnerAddress = keypair.toSuiAddress();
  const cached = projectRunnerCache.get(projectId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    if (cached.executionMode === 0) return true;
    return cached.runnerAddress === runnerAddress;
  }
  try {
    const projectObj = await client.getObject({
      id: projectId,
      options: { showContent: true }
    });
    const fields = projectObj.data?.content?.fields;
    const configuredRunner = fields?.runner_address;
    const executionMode = fields?.execution_mode || 0;
    projectRunnerCache.set(projectId, {
      runnerAddress: configuredRunner || "",
      executionMode,
      timestamp: Date.now()
    });
    if (executionMode === 0) return true;
    if (configuredRunner) return configuredRunner === runnerAddress;
  } catch (e2) {
    console.warn(`[Listener] Failed to verify runner authorization for project ${projectId}:`, e2.message);
  }
  return false;
}
async function checkProjectVaultBalance(projectId) {
  try {
    const projectObj = await client.getObject({
      id: projectId,
      options: { showContent: true }
    });
    const fields = projectObj.data?.content?.fields;
    const vaultBalanceMist = fields?.vault || 0;
    return Number(vaultBalanceMist) / 1e9;
  } catch (e2) {
    console.warn(`[Listener] Failed to fetch vault balance for project ${projectId}:`, e2.message);
    return 0;
  }
}
async function fetchSuiPrice() {
  try {
    const res = await fetch("https://api.coinbase.com/v2/prices/SUI-USD/spot");
    const data = await res.json();
    const price = parseFloat(data.data.amount);
    if (!isNaN(price) && price > 0) return price;
  } catch (e2) {
    console.warn("[Price Helper] Coinbase SUI/USD fetch failed, trying CryptoCompare...");
  }
  try {
    const res = await fetch("https://min-api.cryptocompare.com/data/price?fsym=SUI&tsyms=USD");
    const data = await res.json();
    const price = parseFloat(data.USD);
    if (!isNaN(price) && price > 0) return price;
  } catch (e2) {
    console.warn("[Price Helper] CryptoCompare SUI/USD fetch failed, trying CoinGecko...");
  }
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd");
    const data = await res.json();
    const price = parseFloat(data.sui.usd);
    if (!isNaN(price) && price > 0) return price;
  } catch (e2) {
    console.warn("[Price Helper] CoinGecko SUI/USD fetch failed.");
  }
  throw new Error("All SUI/USD price provider APIs failed");
}
var lastCronRunTimes = /* @__PURE__ */ new Map();
var lastTriggeredPrices = /* @__PURE__ */ new Map();
var lastProcessedEventTx = /* @__PURE__ */ new Map();
async function fetchProjectFunctions(projectId) {
  try {
    const projectObj = await client.getObject({
      id: projectId,
      options: { showContent: true }
    });
    const content = projectObj.data?.content;
    const tableId = content?.fields?.functions?.fields?.id?.id;
    if (!tableId) return [];
    const dynamicFields = await client.getDynamicFields({
      parentId: tableId
    });
    const functionsList = [];
    for (const field of dynamicFields.data) {
      const fieldObj = await client.getDynamicFieldObject({
        parentId: tableId,
        name: field.name
      });
      const metadata = fieldObj.data?.content;
      const fieldsVal = metadata?.fields?.value?.fields;
      if (fieldsVal) {
        functionsList.push({
          name: field.name.value,
          blobId: fieldsVal.walrus_blob_id,
          version: Number(fieldsVal.version),
          status: fieldsVal.status !== void 0 ? Number(fieldsVal.status) : 1,
          triggerType: fieldsVal.trigger_type !== void 0 ? Number(fieldsVal.trigger_type) : 0,
          triggerConfig: fieldsVal.trigger_config || "{}",
          lastExecutionTime: fieldsVal.last_execution_time !== void 0 ? Number(fieldsVal.last_execution_time) : 0
        });
      }
    }
    return functionsList;
  } catch (e2) {
    console.warn(`[Automation Engine] Error fetching project functions:`, e2.message);
    return [];
  }
}
async function triggerFunctionExecution(projectId, functionName, inputData) {
  if (!keypair) {
    console.warn(`[Automation Engine] Cannot trigger "${functionName}": ADMIN_SECRET_KEY is not set.`);
    return;
  }
  try {
    const packageId2 = process.env.PACKAGE_ID || FALLBACK_PACKAGE_ID;
    const registryId = process.env.REGISTRY_ID || FALLBACK_REGISTRY_ID;
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId2}::trigger::call_function`,
      arguments: [
        tx.object(projectId),
        tx.pure.string(functionName),
        tx.pure.string(inputData),
        tx.object(registryId),
        tx.object("0x6")
      ]
    });
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx
    });
    console.log(`[Automation Engine] Trigger transaction submitted for "${functionName}". Digest: ${result.digest}`);
  } catch (e2) {
    console.error(`[Automation Engine] Failed to trigger function "${functionName}":`, e2.message);
  }
}
async function startDynamicAutomationEngine() {
  const packageId2 = process.env.PACKAGE_ID || FALLBACK_PACKAGE_ID;
  if (packageId2 === "0x0") {
    console.warn("[Automation Engine] Dynamic Automation Engine disabled (PACKAGE_ID is not configured).");
    return;
  }
  if (!keypair) {
    console.warn("[Automation Engine] Dynamic Automation Engine disabled (ADMIN_SECRET_KEY is not configured).");
    return;
  }
  const runnerAddress = keypair.toSuiAddress();
  console.log(`[Automation Engine] Starting dynamic engine for runner: ${runnerAddress}`);
  const CHECK_INTERVAL = 15 * 1e3;
  async function discoverProjects() {
    try {
      const createdEvents = await client.queryEvents({
        query: { MoveEventType: `${packageId2}::trigger::ProjectCreated` },
        limit: 100
      });
      const deletedEvents = await client.queryEvents({
        query: { MoveEventType: `${packageId2}::trigger::ProjectDeleted` },
        limit: 100
      });
      const deletedIds = new Set(deletedEvents.data.map((ev) => {
        const fields = ev.parsedJson;
        return fields?.project_id;
      }).filter(Boolean));
      const activeIds = createdEvents.data.map((ev) => {
        const fields = ev.parsedJson;
        return fields?.project_id;
      }).filter((id) => id && !deletedIds.has(id));
      return Array.from(new Set(activeIds));
    } catch (e2) {
      console.error("[Automation Engine] Failed to discover projects via events:", e2.message);
      return [];
    }
  }
  async function checkTriggers() {
    try {
      const activeIds = await discoverProjects();
      for (const projectId of activeIds) {
        let isAuthorized = false;
        try {
          isAuthorized = await isRunnerAuthorized(projectId);
        } catch (err) {
        }
        if (!isAuthorized) {
          continue;
        }
        const functions = await fetchProjectFunctions(projectId);
        const verifiedFunctions = functions.filter((fn) => fn.status === 1);
        const automatedFunctions = verifiedFunctions.filter((fn) => fn.triggerType === 1 || fn.triggerType === 2 || fn.triggerType === 3);
        if (automatedFunctions.length === 0) {
          continue;
        }
        const vaultBalance = await checkProjectVaultBalance(projectId);
        const computeFee = await getGlobalComputeFee();
        if (vaultBalance < computeFee) {
          console.log(`[Automation Engine] Skipping automated triggers for project ${projectId}: Insufficient Vault Balance (${vaultBalance} SUI)`);
          continue;
        }
        for (const fn of automatedFunctions) {
          const { name, triggerType, triggerConfig, lastExecutionTime } = fn;
          if (Date.now() - lastExecutionTime < 15e3) {
            continue;
          }
          const trackerKey = `${projectId}::${name}`;
          const now = Date.now();
          if (triggerType === 1) {
            try {
              const config2 = JSON.parse(triggerConfig);
              const interval = config2.interval || 60;
              const lastRun = lastCronRunTimes.get(trackerKey) || 0;
              if (now - lastRun >= interval * 1e3) {
                console.log(`[Automation Engine] Cron trigger fired for "${name}" under project ${projectId} (interval: ${interval}s)`);
                lastCronRunTimes.set(trackerKey, now);
                await triggerFunctionExecution(projectId, name, "{}");
              }
            } catch (e2) {
              console.warn(`[Automation Engine] Invalid Cron config for "${name}":`, e2.message);
            }
          } else if (triggerType === 2) {
            try {
              const config2 = JSON.parse(triggerConfig);
              const eventPackageId = config2.packageId;
              const eventModuleName = config2.moduleName || "trigger";
              const eventName = config2.eventName;
              if (eventPackageId && eventName) {
                const eventsResult = await client.queryEvents({
                  query: {
                    MoveModule: {
                      package: eventPackageId,
                      module: eventModuleName
                    }
                  },
                  order: "descending",
                  limit: 5
                });
                const matchingEvents = eventsResult.data.filter((ev) => ev.type.includes(eventName));
                if (matchingEvents.length > 0) {
                  const latestEvent = matchingEvents[0];
                  const lastDigest = lastProcessedEventTx.get(trackerKey);
                  if (lastDigest !== latestEvent.id.txDigest) {
                    if (lastDigest !== void 0) {
                      console.log(`[Automation Engine] Event trigger matched for "${name}" on event "${latestEvent.type}"`);
                      await triggerFunctionExecution(projectId, name, JSON.stringify(latestEvent.parsedJson || {}));
                    }
                    lastProcessedEventTx.set(trackerKey, latestEvent.id.txDigest);
                  }
                }
              }
            } catch (e2) {
              console.warn(`[Automation Engine] Invalid Event config for "${name}":`, e2.message);
            }
          } else if (triggerType === 3) {
            try {
              const config2 = JSON.parse(triggerConfig);
              const drift_threshold = config2.drift_threshold || 1e-3;
              const lastPrice = lastTriggeredPrices.get(trackerKey);
              const lastRun = lastCronRunTimes.get(trackerKey) || 0;
              const livePrice = await fetchSuiPrice();
              let shouldTrigger = false;
              if (lastPrice === void 0) {
                console.log(`[Automation Engine] Initializing price tracker for "${name}" (Project: ${projectId}). Live price: $${livePrice}`);
                lastTriggeredPrices.set(trackerKey, livePrice);
                lastCronRunTimes.set(trackerKey, now);
                shouldTrigger = true;
              } else {
                const diff = Math.abs(livePrice - lastPrice);
                const drift = diff / lastPrice;
                if (drift > 5e-5) {
                  console.log(`[Automation Engine] Price check for "${name}" (Project: ${projectId}): Live=$${livePrice.toFixed(4)}, Last=$${lastPrice.toFixed(4)}, Drift=${(drift * 100).toFixed(3)}%`);
                }
                if (drift >= drift_threshold) {
                  console.log(`[Automation Engine] Drift threshold exceeded for "${name}" (Project: ${projectId}): ${(drift * 100).toFixed(3)}% >= ${(drift_threshold * 100).toFixed(3)}%`);
                  shouldTrigger = true;
                } else if (now - lastRun >= 5 * 60 * 1e3) {
                  console.log(`[Automation Engine] Heartbeat limit reached for "${name}" (Project: ${projectId})`);
                  shouldTrigger = true;
                }
              }
              if (shouldTrigger) {
                lastTriggeredPrices.set(trackerKey, livePrice);
                lastCronRunTimes.set(trackerKey, now);
                await triggerFunctionExecution(projectId, name, JSON.stringify({ price: livePrice, timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
              }
            } catch (e2) {
              console.warn(`[Automation Engine] Invalid Drift config for "${name}":`, e2.message);
            }
          }
        }
      }
    } catch (error) {
      console.error("[Automation Engine] Error during check:", error.message);
    } finally {
      setTimeout(checkTriggers, CHECK_INTERVAL);
    }
  }
  checkTriggers();
}
async function startSuiListener(packageId2) {
  console.log(`\x1B[90m[Network] Listening for workloads on package:\x1B[0m ${packageId2}...`);
  let cursor = null;
  let isPolling = false;
  try {
    const latestEvent = await client.queryEvents({
      query: {
        MoveModule: {
          package: packageId2,
          module: "trigger"
        }
      },
      order: "descending",
      limit: 1
    });
    if (latestEvent && latestEvent.data && latestEvent.data.length > 0) {
      cursor = latestEvent.data[0].id;
      console.log(`\x1B[90m[Listener] Starting poll from the latest event cursor...\x1B[0m`);
    } else {
      console.log(`\x1B[90m[Listener] No historical events found. Starting poll from the beginning.\x1B[0m`);
    }
  } catch (e2) {
    console.warn(`[Listener] Failed to fetch latest event cursor on startup (will poll from beginning):`, e2.message);
  }
  console.log(`\x1B[32m\u25CF Node is online and actively polling...\x1B[0m \x1B[90m(Press Ctrl+C to stop)\x1B[0m
`);
  async function poll() {
    if (isPolling) return;
    isPolling = true;
    try {
      const result = await client.queryEvents({
        query: {
          MoveModule: {
            package: packageId2,
            module: "trigger"
          }
        },
        cursor,
        order: "ascending"
      });
      if (result.data.length > 0) {
        const nextCursor = result.nextCursor;
        for (const event of result.data) {
          if (event.type.includes("ExecutionTriggered")) {
            console.log("\n--- New Execution Triggered ---");
            const { project_id, walrus_blob_id, function_name, caller, input_data, execution_mode, assigned_runner, nonce } = event.parsedJson;
            if (walrus_blob_id) {
              try {
                let delayMs = 0;
                if (execution_mode === 1) {
                  if (assigned_runner !== keypair?.toSuiAddress()) {
                    console.log(`\x1B[90m[Network] Skipping execution for project: ${project_id} (Assigned to dedicated runner: ${assigned_runner})\x1B[0m`);
                    continue;
                  }
                } else {
                  if (assigned_runner !== keypair?.toSuiAddress()) {
                    console.log(`\x1B[90m[Network] Not assigned runner for Execution. Waiting 10 seconds as fallback...\x1B[0m`);
                    delayMs = 10500;
                  } else {
                    console.log(`\x1B[90m[Network] Processing Public Compute Pool Execution task (Assigned Runner!)...\x1B[0m`);
                  }
                }
                const processTask = async () => {
                  const vaultBalance = await checkProjectVaultBalance(project_id);
                  const computeFee = await getGlobalComputeFee();
                  if (vaultBalance < computeFee) {
                    console.log(`[Listener] Skipping execution for project ${project_id}: Insufficient Vault Balance (${vaultBalance} SUI)`);
                    return;
                  }
                  if (delayMs > 0) {
                    try {
                      const projectObj = await client.getObject({ id: project_id, options: { showContent: true } });
                      if (projectObj.data?.content && "fields" in projectObj.data.content) {
                        const fields = projectObj.data.content.fields;
                        const tableId = fields.executions?.fields?.id?.id;
                        if (tableId) {
                          const record = await client.getDynamicFieldObject({
                            parentId: tableId,
                            name: { type: "u64", value: nonce.toString() }
                          });
                          const recordFields = record.data?.content?.fields?.value?.fields;
                          if (recordFields && recordFields.completed) {
                            console.log(`\x1B[90m[Network] Execution already processed by another node. Skipping sandbox.\x1B[0m`);
                            return;
                          }
                        }
                      }
                    } catch (e2) {
                    }
                  }
                  console.log(`Triggering function: ${function_name} (Blob: ${walrus_blob_id}) for project: ${project_id}`);
                  console.log(`Caller: ${caller}`);
                  const code = await fetchFunctionCode(walrus_blob_id);
                  console.log("Executing in sandbox with input:", input_data);
                  let executionResult;
                  try {
                    executionResult = await executeInSandbox(code, input_data);
                    console.log("Execution Result:", executionResult);
                  } catch (sandboxErr) {
                    console.error("Sandbox Execution Error:", sandboxErr.message);
                    executionResult = { status: "error", error: sandboxErr.message };
                  }
                  if (keypair) {
                    console.log(`Submitting result back to Sui...`);
                    const tx = new Transaction();
                    const packageId3 = process.env.PACKAGE_ID || FALLBACK_PACKAGE_ID;
                    const treasuryId = process.env.PROTOCOL_TREASURY_ID || FALLBACK_TREASURY_ID;
                    tx.moveCall({
                      target: `${packageId3}::trigger::submit_result`,
                      arguments: [
                        tx.object(project_id),
                        tx.object(treasuryId),
                        tx.pure.string(function_name),
                        tx.pure.string(JSON.stringify(executionResult) ?? "null"),
                        tx.pure.u64(nonce),
                        tx.object("0x6")
                        // SUI Clock
                      ]
                    });
                    try {
                      const writeResult = await client.signAndExecuteTransaction({
                        signer: keypair,
                        transaction: tx
                      });
                      console.log(`Result submitted successfully! Tx Digest: ${writeResult.digest}`);
                    } catch (e2) {
                      if (e2.message.includes("888")) {
                        console.log(`\x1B[90m[Network] Execution already processed by another node. Skipping.\x1B[0m`);
                      } else {
                        console.error("Error submitting execution result:", e2.message);
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
              } catch (error) {
                console.error("Error processing execution:", error.message);
              }
            }
          } else if (event.type.includes("VerificationRequested")) {
            console.log("\n--- New Verification Requested ---");
            const { project_id, function_name, walrus_blob_id, auditor_blob_id, assigned_runner, nonce } = event.parsedJson;
            if (walrus_blob_id) {
              try {
                let delayMs = 0;
                if (assigned_runner !== keypair?.toSuiAddress()) {
                  console.log(`\x1B[90m[Network] Not assigned runner for Verification. Waiting 10 seconds as fallback...\x1B[0m`);
                  delayMs = 10500;
                } else {
                  console.log(`\x1B[90m[Network] Processing Verification task (Assigned Runner!)...\x1B[0m`);
                }
                const processVerification = async () => {
                  const DEFAULT_PLATFORM_AUDITOR = "TJgeWW4t-MOv1K2klEsC0eDTDZbmcUu610eHptXD9mA";
                  console.log(`[Security Policy] Overriding with Global Platform Auditor: ${DEFAULT_PLATFORM_AUDITOR} (Requested: ${auditor_blob_id})`);
                  console.log(`Auditing function: ${function_name} (Blob: ${walrus_blob_id})`);
                  if (delayMs > 0) {
                    try {
                      const projectObj = await client.getObject({ id: project_id, options: { showContent: true } });
                      if (projectObj.data?.content && "fields" in projectObj.data.content) {
                        const fields = projectObj.data.content.fields;
                        const tableId = fields.verifications?.fields?.id?.id;
                        if (tableId) {
                          const record = await client.getDynamicFieldObject({
                            parentId: tableId,
                            name: { type: "u64", value: nonce.toString() }
                          });
                          const recordFields = record.data?.content?.fields?.value?.fields;
                          if (recordFields && recordFields.completed) {
                            console.log(`\x1B[90m[Network] Verification already processed by another node. Skipping sandbox.\x1B[0m`);
                            return;
                          }
                        }
                      }
                    } catch (e2) {
                    }
                  }
                  const auditorCode = await fetchFunctionCode(DEFAULT_PLATFORM_AUDITOR);
                  const inputObj = { blobId: walrus_blob_id };
                  console.log(`Booting sandbox with auditor code...`);
                  const auditResult = await executeInSandbox(auditorCode, JSON.stringify(inputObj));
                  console.log("Audit Result:", auditResult);
                  const approved = auditResult && auditResult.approved === true;
                  if (keypair) {
                    console.log(`Submitting audit verification response (Approved: ${approved}) to Move contract...`);
                    const tx = new Transaction();
                    const packageId3 = process.env.PACKAGE_ID || FALLBACK_PACKAGE_ID;
                    tx.moveCall({
                      target: `${packageId3}::trigger::confirm_verification`,
                      arguments: [
                        tx.object(project_id),
                        tx.pure.string(function_name),
                        tx.pure.bool(approved),
                        tx.pure.u64(nonce),
                        tx.object("0x6")
                        // SUI Clock
                      ]
                    });
                    try {
                      const writeResult = await client.signAndExecuteTransaction({
                        signer: keypair,
                        transaction: tx
                      });
                      console.log(`Verification confirmed on-chain! Tx Digest: ${writeResult.digest}`);
                    } catch (e2) {
                      if (e2.message.includes("888")) {
                        console.log(`\x1B[90m[Network] Verification already processed by another node. Skipping.\x1B[0m`);
                      } else {
                        console.error("Error submitting verification:", e2.message);
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
              } catch (error) {
                console.error("Error processing verification:", error.message);
              }
            }
          }
        }
        cursor = nextCursor;
      }
    } catch (error) {
      console.error("Polling error:", error.message);
    } finally {
      isPolling = false;
      setTimeout(poll, 3e3);
    }
  }
  setTimeout(poll, 1e3);
  process.on("SIGINT", () => {
    console.log("\nStopping listener...");
    process.exit(0);
  });
}
var packageId = process.env.PACKAGE_ID || FALLBACK_PACKAGE_ID;
if (packageId === "0x0") {
  console.warn("\x1B[33m[Warning] PACKAGE_ID is not set.\x1B[0m");
}
startSuiListener(packageId);
startDynamicAutomationEngine().catch((e2) => console.error(`\x1B[31m[Automation Engine Error]\x1B[0m`, e2));
export {
  startDynamicAutomationEngine,
  startSuiListener
};
