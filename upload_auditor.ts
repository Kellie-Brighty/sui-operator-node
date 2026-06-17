// runner/upload_auditor.ts
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

async function upload() {
    const filePath = path.resolve('/Users/pc/Documents/sui-functions/functions/walrus_auditor.js');
    const content = fs.readFileSync(filePath, 'utf8');

    console.log("Uploading updated auditor script to Walrus Testnet...");
    const url = "https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=1";
    const response = await axios.put(url, content, {
        headers: { "Content-Type": "text/plain" }
    });
    
    const data = response.data;
    const blobId = data.newlyCreated?.blobObject?.blobId || data.alreadyCertified?.blobObject?.blobId;
    if (!blobId) {
        throw new Error("Could not extract blob ID: " + JSON.stringify(data));
    }
    console.log(`\n🎉 Success! New Auditor Blob ID: ${blobId}\n`);
}

upload().catch(console.error);
