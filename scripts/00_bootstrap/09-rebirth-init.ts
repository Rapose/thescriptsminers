import { bootstrapCtx, resolveEssMint, standardBootstrapAccounts, SystemProgram, fetchers, bn, assertEq, assertTrue, assertPubkeyEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = bootstrapCtx("09-rebirth-init");
  const { rebirthConfig } = standardBootstrapAccounts(env);
  const essMint = resolveEssMint(args);
  const recipientWallet = args.recipient ? new (await import("@solana/web3.js")).PublicKey(args.recipient) : env.wallet.publicKey;
  const burnBps = Number(args.burnBps ?? "1000");
  const treasuryBps = Number(args.treasuryBps ?? "9000");
  const minParent = [1, 2, 3, 4, 5];
  const essCost = [bn(100), bn(200), bn(300), bn(400), bn(500)].map((x) => Number(x.toString()));
  const before = await fetchers.fetchRebirthConfig(env.program, rebirthConfig);
  const tx = await env.program.methods.rebirthInit(burnBps, treasuryBps, minParent, essCost).accounts({
    admin: env.wallet.publicKey,
    essMint,
    recipientWallet,
    rebirthConfig,
    systemProgram: SystemProgram.programId,
  }).rpc();
  const after: any = await fetchers.fetchRebirthConfig(env.program, rebirthConfig);
  assertEq("burnBps", Number(after.burnBps), burnBps);
  assertEq("treasuryBps", Number(after.treasuryBps), treasuryBps);
  assertTrue("enabled", after.enabled);
  assertPubkeyEq("essMint", after.essMint, essMint);
  printTx("rebirthInit", tx);
  printJson("before", { exists: !!before });
  printJson("after", { rebirthConfig: rebirthConfig.toBase58(), minParentLevelByRarity: after.minParentLevelByRarity });
  printSuccess("rebirth_init validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
