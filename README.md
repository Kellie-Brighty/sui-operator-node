# Sui-Operator Node (Runner)

This is the decentralized execution engine for Sui-Functions. Node operators can run this engine to listen for blockchain events, download scripts from Walrus, and securely execute them in a sandboxed V8 environment.

## 🚀 How to Run a Node

### Prerequisites
- Node.js (v20+)
- NPM
- PM2 (optional, for running in the background)
- A configured Sui Wallet & Operator JSON key

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Kellie-Brighty/sui-operator-node.git
cd sui-operator-node
npm install
```

### 2. Configuration
Create a `.env` file in the root directory:
```bash
touch .env
```

Add your specific configuration, such as your proxy port (if using the Trusted Seal Proxy feature):
```env
PROXY_PORT=3007
```

Make sure your node operator `.json` key file is placed correctly and your `ecosystem.config.cjs` points to it.

### 3. Compile the Engine
The engine is written in TypeScript. You must compile it before running:
```bash
npx tsc
```

### 4. Start the Node Operator
To run the operator locally in your terminal for testing:
```bash
npm start
```

**Production (PM2)**
To run the node operators in the background using PM2:
```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

## 🔒 Security
This engine executes untrusted JavaScript downloaded from the Walrus decentralized storage network. It uses `isolated-vm` to ensure a strict memory boundary and execution timeout to protect the host machine.
