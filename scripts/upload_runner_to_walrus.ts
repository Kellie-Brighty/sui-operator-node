import fs from 'fs';

const AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';
const PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space';

async function upload() {
  const filePath = './dist/listener.js';
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File ${filePath} not found. Run the bundle script first.`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath);
  console.log(`Uploading ${filePath} (${fileContent.length} bytes) to Walrus...`);

  try {
    const response = await fetch(`${PUBLISHER_URL}/v1/blobs?epochs=1`, {
      method: 'PUT',
      body: fileContent,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let blobId = '';
    
    if (data.newlyCreated) {
      blobId = data.newlyCreated.blobObject.blobId;
    } else if (data.alreadyCertified) {
      blobId = data.alreadyCertified.blobId;
    }

    console.log(`\n✅ Upload Successful!`);
    console.log(`WALRUS_BLOB_ID: ${blobId}`);
    console.log(`You can now pass this BLOB_ID to the bootloader.`);
    
    // Save it to a file so other scripts can read it if needed
    fs.writeFileSync('.latest_runner_blob_id', blobId);
  } catch (err) {
    console.error("Error during upload:", err);
  }
}

upload();
