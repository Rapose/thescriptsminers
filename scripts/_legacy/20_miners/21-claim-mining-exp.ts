import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/claim_mining_exp.ts']);
}

main().catch((e) => {
  console.error("FATAL 21-claim-mining-exp:", e);
  process.exit(1);
});
