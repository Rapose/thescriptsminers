import fs from "node:fs";
import { PublicKey } from "@solana/web3.js";
import { lootboxCtx, parseLootboxId, DOMAIN_MINER, pdas, fetchers, assertEq, assertFalse, assertPubkeyEq, assertTrue, assertDefaultPubkey, printJson, printSuccess, printTx, waitSlots, bn } from "./_common";

async function main() {
  const { env, args } = lootboxCtx("12-reveal-miner-lootbox");
  const owner = env.wallet.publicKey;
  const lootboxId = parseLootboxId(args);
  const saleType = Number(args.saleType ?? "0");
  const config = pdas.config(env.programId);
  const cfgBefore: any = await fetchers.fetchConfig(env.program, config);
  const nextMinerId = BigInt(cfgBefore.nextMinerId.toString());
  const lootbox = pdas.lootboxMiner(env.programId, owner, lootboxId, saleType);
  const minerState = pdas.miner(env.programId, owner, nextMinerId);
  const minerProgress = pdas.minerProgress(env.programId, minerState);

  const saltHex = args.saltHex ?? fs.readFileSync(`.lootbox_miner_${lootboxId.toString()}_salt.hex`, "utf8").trim();
  const salt32 = [...Buffer.from(saltHex, "hex")];

  await waitSlots(env.connection, 2);

  const tx = await env.program.methods.lootboxMinerReveal(bn(lootboxId), saleType, salt32).accounts({
    owner,
    config,
    lootbox,
    minerState,
    minerProgress,
    systemProgram: (await import("@solana/web3.js")).SystemProgram.programId,
  }).rpc();

  const lb: any = await fetchers.fetchLootboxMinerState(env.program, lootbox);
  const miner: any = await fetchers.fetchMinerState(env.program, minerState);
  const cfgAfter: any = await fetchers.fetchConfig(env.program, config);

  assertTrue("revealed", lb.revealed);
  assertEq("nextMinerId increment", Number(cfgAfter.nextMinerId), Number(cfgBefore.nextMinerId) + 1);
  assertEq("rarity mirror", Number(miner.rarity), Number(lb.rarity));
  assertEq("element mirror", Number(miner.element), Number(lb.element));
  assertEq("hashBase mirror", Number(miner.hashBase), Number(lb.hashBase));
  assertDefaultPubkey("allocatedLand", miner.allocatedLand as PublicKey);
  assertFalse("listed", miner.listed);
  assertEq("expeditionEndsAt", Number(miner.expeditionEndsAt), 0);

  printJson("accounts", { owner: owner.toBase58(), lootbox: lootbox.toBase58(), miner: minerState.toBase58(), lootboxId: lootboxId.toString() });
  printTx("lootboxMinerReveal", tx);
  printJson("before", { nextMinerId: Number(cfgBefore.nextMinerId) });
  printJson("after", { nextMinerId: Number(cfgAfter.nextMinerId), rarity: Number(miner.rarity), element: Number(miner.element), hashBase: Number(miner.hashBase), cosmetics: { face: miner.face, helmet: miner.helmet, backpack: miner.backpack, jacket: miner.jacket, item: miner.item, background: miner.background } });
  printSuccess("Reveal miner validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
