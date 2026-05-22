import { loadConfig } from "./config.js";
import { getNodeReadiness } from "./node/health.js";
import { BchnRpcClient } from "./node/rpc.js";

const command = process.argv[2] ?? "node-health";

if (command !== "node-health") {
  throw new Error(`Unknown command: ${command}`);
}

const config = loadConfig();
const rpc = new BchnRpcClient(config);
const report = await getNodeReadiness(config, rpc);

console.log(JSON.stringify(report, null, 2));
if (!report.ready) {
  process.exitCode = 1;
}

