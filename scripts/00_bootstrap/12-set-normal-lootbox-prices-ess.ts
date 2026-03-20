import { bootstrapCtx, standardBootstrapAccounts, fetchers, bn, assertEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = bootstrapCtx("12-set-normal-lootbox-prices-ess");
  const { config } = standardBootstrapAccounts(env);
  const minerPrice = bn(args.normalMinerPriceEss ?? "1000");
  const landPrice = bn(args.normalLandPriceEss ?? "1200");
  const before: any = await fetchers.fetchConfig(env.program, config);
  const tx = await env.program.methods
    .setNormalLootboxPricesEss(minerPrice, landPrice)
    .accounts({ admin: env.wallet.publicKey, config })
    .rpc();
  const after: any = await fetchers.fetchConfig(env.program, config);
  assertEq("normalMinerPriceEss", Number(after.normalMinerPriceEss), Number(minerPrice.toString()));
  assertEq("normalLandPriceEss", Number(after.normalLandPriceEss), Number(landPrice.toString()));
  printTx("setNormalLootboxPricesEss", tx);
  printJson("before", { normalMinerPriceEss: Number(before.normalMinerPriceEss), normalLandPriceEss: Number(before.normalLandPriceEss) });
  printJson("after", { normalMinerPriceEss: Number(after.normalMinerPriceEss), normalLandPriceEss: Number(after.normalLandPriceEss) });
  printSuccess("set_normal_lootbox_prices_ess validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
