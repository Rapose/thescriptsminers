import { execSync } from "child_process";

export function runScript(path: string) {
  console.log("\n==============================");
  console.log("Running:", path);
  console.log("==============================\n");

  execSync(`npx ts-node ${path}`, {
    stdio: "inherit",
    env: {
      ...process.env,
      ANCHOR_PROVIDER_URL:
        process.env.ANCHOR_PROVIDER_URL || "http://127.0.0.1:8899",
      ANCHOR_WALLET:
        process.env.ANCHOR_WALLET ||
        "/mnt/c/Users/Rapose/miners-of-essence/miners/minha-wallet.json",
    },
  });
}