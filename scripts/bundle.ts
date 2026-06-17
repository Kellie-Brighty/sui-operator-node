console.log("Bundling runner engine...");

import { $ } from "bun";

console.log("Bundling runner engine using esbuild...");

try {
  await $`npx esbuild ./listener.ts --bundle --platform=node --outfile=./dist/listener.js --external:isolated-vm --external:@mysten/sui --external:axios --external:dotenv --external:node-seal --minify`;
  console.log("Build succeeded! Bundle saved to dist/listener.js");
} catch (err) {
  console.error("Build failed:", err);
  process.exit(1);
}
