console.log("Bundling runner engine...");
const result = await Bun.build({
    entrypoints: ['./listener.ts'],
    outdir: './dist',
    target: 'node',
    external: ['isolated-vm', '@mysten/sui', 'axios', 'dotenv'],
    minify: true,
});
if (!result.success) {
    console.error("Build failed:", result.logs);
    process.exit(1);
}
console.log("Build succeeded! Bundle saved to dist/listener.js");
export {};
