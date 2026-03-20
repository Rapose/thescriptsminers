import fs from "node:fs";
import { lootboxCtx, parseLootboxId, pdas, fetchers, assertEq, assertFalse, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx, waitSlots, bn } from "./_common";

async function main() {
  const { env, args } = lootboxCtx("15-reveal-land-lootbox");
  const owner = env.wallet.publicKey;
  const lootboxId = parseLootboxId(args);
  const saleType = Number(args.saleType ?? "0");
  const config = pdas.config(env.programId);
  const cfgBefore: any = await fetchers.fetchConfig(env.program, config);
  const nextLandId = BigInt(cfgBefore.nextLandId.toString());
  const lootbox = pdas.lootboxLand(env.programId, owner, lootboxId, saleType);
  const landState = pdas.land(env.programId, owner, nextLandId);

  const saltHex = args.saltHex ?? fs.readFileSync(`.lootbox_land_${lootboxId.toString()}_salt.hex`, "utf8").trim();
  const salt32 = [...Buffer.from(saltHex, "hex")];

  await waitSlots(env.connection, 2);

  const tx = await env.program.methods.lootboxLandReveal(bn(lootboxId), saleType, salt32).accounts({
    owner,
    config,
    lootbox,
    landState,
    systemProgram: (await import("@solana/web3.js")).SystemProgram.programId,
  }).rpc();

  const lb: any = await fetchers.fetchLootboxLandState(env.program, lootbox);
  const land: any = await fetchers.fetchLandState(env.program, landState);
  const cfgAfter: any = await fetchers.fetchConfig(env.program, config);

  assertTrue("revealed", lb.revealed);
  assertEq("nextLandId increment", Number(cfgAfter.nextLandId), Number(cfgBefore.nextLandId) + 1);
  assertEq("rarity mirror", Number(land.rarity), Number(lb.rarity));
  assertEq("element mirror", Number(land.element), Number(lb.element));
  assertEq("slots mirror", Number(land.slots), Number(lb.slots));
  assertEq("allocatedMinersCount", Number(land.allocatedMinersCount), 0);
  assertFalse("listed", land.listed);

  printJson("accounts", { owner: owner.toBase58(), lootbox: lootbox.toBase58(), land: landState.toBase58(), lootboxId: lootboxId.toString() });
  printTx("lootboxLandReveal", tx);
  printJson("before", { nextLandId: Number(cfgBefore.nextLandId) });
  printJson("after", { nextLandId: Number(cfgAfter.nextLandId), rarity: Number(land.rarity), element: Number(land.element), slots: Number(land.slots), listed: land.listed });
  printSuccess("Reveal land validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
