module.exports = {
  apps: [
    {
      name: "sui-operator-1",
      script: "dist/listener.js",
      interpreter: "/usr/bin/node",
      env: {
        PACKAGE_ID: "0xfe9cd1bef9db795e548992b00eab6c0f1c5aec675dce7874a4ac85912b5fa480",
        PROTOCOL_TREASURY_ID: "0xb7f995072f2fe53246c79942b840463297fdc234dde3eb03c5384c342c75cf52",
        REGISTRY_ID: "0xd7a6c23d49c4af09e378be6778f6df60b3ba29d0b7c4ab055cab311a722c5e2b",
        OPERATOR_KEY_PATH: "/root/.sui-functions/node1.json"
      }
    },
    {
      name: "sui-operator-2",
      script: "dist/listener.js",
      interpreter: "/usr/bin/node",
      env: {
        PACKAGE_ID: "0xfe9cd1bef9db795e548992b00eab6c0f1c5aec675dce7874a4ac85912b5fa480",
        PROTOCOL_TREASURY_ID: "0xb7f995072f2fe53246c79942b840463297fdc234dde3eb03c5384c342c75cf52",
        REGISTRY_ID: "0xd7a6c23d49c4af09e378be6778f6df60b3ba29d0b7c4ab055cab311a722c5e2b",
        OPERATOR_KEY_PATH: "/root/.sui-functions/node2.json"
      }
    },
    {
      name: "sui-operator-3",
      script: "dist/listener.js",
      interpreter: "/usr/bin/node",
      env: {
        PACKAGE_ID: "0xfe9cd1bef9db795e548992b00eab6c0f1c5aec675dce7874a4ac85912b5fa480",
        PROTOCOL_TREASURY_ID: "0xb7f995072f2fe53246c79942b840463297fdc234dde3eb03c5384c342c75cf52",
        REGISTRY_ID: "0xd7a6c23d49c4af09e378be6778f6df60b3ba29d0b7c4ab055cab311a722c5e2b",
        OPERATOR_KEY_PATH: "/root/.sui-functions/node3.json"
      }
    },
    {
      name: "log-truncator",
      script: "dist/log_truncator.js",
      interpreter: "/usr/bin/node",
      out_file: "/dev/null",
      error_file: "/dev/null"
    }
  ]
};