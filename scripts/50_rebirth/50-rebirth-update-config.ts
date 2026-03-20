import { PublicKey } from "@solana/web3.js";
import { rebirthCtx, pdas, fetchers, resolveEssMint, bn, assertEq, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = rebirthCtx("50-rebirth-update-config");
  const admin = env.wallet.publicKey;
  const rebirthConfig = pdas.rebirthConfig(env.programId);
  const essMint = resolveEssMint(args);
  const recipientWallet = args.recipient ? new PublicKey(args.recipient) : admin;
  const burnBps = Number(args.burnBps ?? "7000");
  const treasuryBps = Number(args.treasuryBps ?? "3000");
  const enabled = (args.enabled ?? "true") === "true";
  const minParent = [0, 0, 0, 0, 0];
  const essCost = [100, 200, 300, 400, 500];

  const before: any = await fetchers.fetchRebirthConfig(env.program, rebirthConfig);
  const tx = await env.program.methods.rebirthUpdateConfig(burnBps, treasuryBps, enabled, minParent, essCost).accounts({
    admin,
    essMint,
    recipientWallet,
    rebirthConfig,
  }).rpc();

  const after: any = await fetchers.fetchRebirthConfig(env.program, rebirthConfig);
  assertEq("burnBps", Number(after.burnBps), burnBps);
  assertEq("treasuryBps", Number(after.treasuryBps), treasuryBps);
  assertTrue("enabled", after.enabled === enabled);
  assertEq("minParentLevelByRarity[0]", Number(after.minParentLevelByRarity[0]), minParent[0]);
  assertEq("essCostByRarity[0]", Number(after.essCostByRarity[0]), essCost[0]);
  assertPubkeyEq("essMint", after.essMint, essMint);

  printJson("accounts", { admin: admin.toBase58(), rebirthConfig: rebirthConfig.toBase58() });
  printTx("rebirthUpdateConfig", tx);
  printJson("before", { burnBps: before?.burnBps, enabled: before?.enabled });
  printJson("after", { burnBps: Number(after.burnBps), treasuryBps: Number(after.treasuryBps), enabled: after.enabled, minParentLevelByRarity: after.minParentLevelByRarity, essCostByRarity: after.essCostByRarity });
  printSuccess("rebirth_update_config validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
