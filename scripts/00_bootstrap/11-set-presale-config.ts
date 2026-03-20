import { PublicKey } from "@solana/web3.js";
import { bootstrapCtx, standardBootstrapAccounts, fetchers, bn, assertEq, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = bootstrapCtx("11-set-presale-config");
  const { config } = standardBootstrapAccounts(env);
  const treasury = args.treasury ? new PublicKey(args.treasury) : env.wallet.publicKey;
  const minerPrice = bn(args.presaleMinerPriceLamports ?? "10000000");
  const landPrice = bn(args.presaleLandPriceLamports ?? "5000000");
  const before: any = await fetchers.fetchConfig(env.program, config);
  const tx = await env.program.methods
    .setPresaleConfig(true, true, treasury, minerPrice, landPrice)
    .accounts({ admin: env.wallet.publicKey, config })
    .rpc();
  const after: any = await fetchers.fetchConfig(env.program, config);
  assertTrue("presaleSolEnabled", after.presaleSolEnabled);
  assertTrue("publicLootboxInitEnabled", after.publicLootboxInitEnabled);
  assertPubkeyEq("presaleTreasury", after.presaleTreasury, treasury);
  assertEq("presaleMinerPriceLamports", Number(after.presaleMinerPriceLamports), Number(minerPrice.toString()));
  assertEq("presaleLandPriceLamports", Number(after.presaleLandPriceLamports), Number(landPrice.toString()));
  printTx("setPresaleConfig", tx);
  printJson("before", { presaleSolEnabled: before.presaleSolEnabled });
  printJson("after", { treasury: after.presaleTreasury.toBase58() });
  printSuccess("set_presale_config validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
