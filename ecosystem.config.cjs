module.exports = {
  apps: [
    {
      name: "sui-operator-1",
      script: "dist/listener.js",
      interpreter: "/usr/bin/node",
      env: {
        PACKAGE_ID: "0x902178dc8aba7dbdfb7a8350ec39bf78fd6ebd6c1a16c1dc142ce1cf5c89bd63",
        PROTOCOL_TREASURY_ID: "0x9119b43e1b179342300ae61b8065cec58d543c6aedf675143fd0224bfc45a2fa",
        REGISTRY_ID: "0x0dd6ad0500f3765684acadd5a8ca8338c29669ff34efe78b3cd52d143e8708ed",
        OPERATOR_KEY_PATH: "/root/.sui-functions/node1.json"
      }
    },
    {
      name: "sui-operator-2",
      script: "dist/listener.js",
      interpreter: "/usr/bin/node",
      env: {
        PACKAGE_ID: "0x902178dc8aba7dbdfb7a8350ec39bf78fd6ebd6c1a16c1dc142ce1cf5c89bd63",
        PROTOCOL_TREASURY_ID: "0x9119b43e1b179342300ae61b8065cec58d543c6aedf675143fd0224bfc45a2fa",
        REGISTRY_ID: "0x0dd6ad0500f3765684acadd5a8ca8338c29669ff34efe78b3cd52d143e8708ed",
        OPERATOR_KEY_PATH: "/root/.sui-functions/node2.json"
      }
    },
    {
      name: "sui-operator-3",
      script: "dist/listener.js",
      interpreter: "/usr/bin/node",
      env: {
        PACKAGE_ID: "0x902178dc8aba7dbdfb7a8350ec39bf78fd6ebd6c1a16c1dc142ce1cf5c89bd63",
        PROTOCOL_TREASURY_ID: "0x9119b43e1b179342300ae61b8065cec58d543c6aedf675143fd0224bfc45a2fa",
        REGISTRY_ID: "0x0dd6ad0500f3765684acadd5a8ca8338c29669ff34efe78b3cd52d143e8708ed",
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