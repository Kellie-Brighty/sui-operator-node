import * as paillierBigint from 'paillier-bigint';

export async function initFHE() {
    console.log("⚡ FHE Engine Initialized (Paillier Native JS)");
}

// Homomorphic addition using Paillier
export function addCiphertexts(nString: string, gString: string, cipherAStr: string, cipherBStr: string): string {
    const publicKey = new paillierBigint.PublicKey(BigInt(nString), BigInt(gString));
    
    // Perform Homomorphic Addition
    console.log(`\x1b[36m[FHE ENGINE] \x1b[90mPerforming Homomorphic Addition on two blinded ciphertexts (Length: ${cipherAStr.length} chars)\x1b[0m`);
    const result = publicKey.addition(BigInt(cipherAStr), BigInt(cipherBStr));
    
    return result.toString();
}

// Paillier only supports scalar multiplication (not multiplying two ciphertexts together)
export function multiplyCiphertextByScalar(nString: string, gString: string, cipherStr: string, scalarStr: string): string {
    const publicKey = new paillierBigint.PublicKey(BigInt(nString), BigInt(gString));
    
    console.log(`\x1b[36m[FHE ENGINE] \x1b[90mPerforming Homomorphic Scalar Multiplication on blinded ciphertext (Length: ${cipherStr.length} chars)\x1b[0m`);
    const result = publicKey.multiply(BigInt(cipherStr), BigInt(scalarStr));
    
    return result.toString();
}