import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
try {
    const proto = SuiJsonRpcClient.prototype;
    const methods = Object.getOwnPropertyNames(proto).filter(name => typeof proto[name] === 'function');
    console.log("SuiJsonRpcClient methods:", methods);
}
catch (e) {
    console.error("Error inspecting:", e);
}
