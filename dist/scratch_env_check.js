import * as dotenv from 'dotenv';
dotenv.config();
console.log("PACKAGE_ID:", JSON.stringify(process.env.PACKAGE_ID));
console.log("REGISTRY_ID:", JSON.stringify(process.env.REGISTRY_ID));
console.log("ADMIN_SECRET_KEY Length:", process.env.ADMIN_SECRET_KEY?.length);
