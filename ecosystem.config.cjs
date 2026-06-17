module.exports = {
  apps: [
    {
      name: "sui-operator-1",
      script: "dist/listener.js",
      interpreter: "/usr/bin/node",
      env: {
        PACKAGE_ID: "0x41442ae1e170a68f3486ce0fd4fb03a2a48f4c69ee61cd5e8a563311aaaa3a95",
        PROTOCOL_TREASURY_ID: "0x18bcfff30cc1dcdad91f4b3d3be4286251f339242e884989e52ff3017f15294f",
        REGISTRY_ID: "0x48fc4208313f2fe1fce5df5a36af0cac209ca40db9855f7bb712cf2e95060ec1",
        OPERATOR_KEY_PATH: "/root/.sui-functions/node1.json"
      }
    },
    {
      name: "sui-operator-2",
      script: "dist/listener.js",
      interpreter: "/usr/bin/node",
      env: {
        PACKAGE_ID: "0x41442ae1e170a68f3486ce0fd4fb03a2a48f4c69ee61cd5e8a563311aaaa3a95",
        PROTOCOL_TREASURY_ID: "0x18bcfff30cc1dcdad91f4b3d3be4286251f339242e884989e52ff3017f15294f",
        REGISTRY_ID: "0x48fc4208313f2fe1fce5df5a36af0cac209ca40db9855f7bb712cf2e95060ec1",
        OPERATOR_KEY_PATH: "/root/.sui-functions/node2.json"
      }
    },
    {
      name: "sui-operator-3",
      script: "dist/listener.js",
      interpreter: "/usr/bin/node",
      env: {
        PACKAGE_ID: "0x41442ae1e170a68f3486ce0fd4fb03a2a48f4c69ee61cd5e8a563311aaaa3a95",
        PROTOCOL_TREASURY_ID: "0x18bcfff30cc1dcdad91f4b3d3be4286251f339242e884989e52ff3017f15294f",
        REGISTRY_ID: "0x48fc4208313f2fe1fce5df5a36af0cac209ca40db9855f7bb712cf2e95060ec1",
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