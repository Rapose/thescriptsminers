import fs from "node:fs";
import { lootboxCtx, parseLootboxId, salt32FromArgs, commitment, DOMAIN_LAND, pdas, fetchers, assertEq, assertTrue, printJson, printSuccess, printTx, bn } from "./_common";

async function main() {
  const { env, args } = lootboxCtx("14-commit-land-lootbox");
  const owner = env.wallet.publicKey;
  const lootboxId = parseLootboxId(args);
  const saleType = Number(args.saleType ?? "0");
  const salt32 = salt32FromArgs(args);
  const lootbox = pdas.lootboxLand(env.programId, owner, lootboxId, saleType);
  const before: any = await fetchers.fetchLootboxLandState(env.program, lootbox);

  const tx = await env.program.methods.lootboxLandCommit(bn(lootboxId), saleType, salt32).accounts({ owner, lootbox }).rpc();
  const after: any = await fetchers.fetchLootboxLandState(env.program, lootbox);
  const expected = commitment(DOMAIN_LAND, lootboxId, salt32);

  assertTrue("committed", after.committed);
  assertTrue("commitSlot > 0", Number(after.commitSlot) > 0);
  assertEq("commitment", Buffer.from(after.commitment).toString("hex"), Buffer.from(expected).toString("hex"));

  fs.writeFileSync(`.lootbox_land_${lootboxId.toString()}_salt.hex`, Buffer.from(salt32).toString("hex"));

  printJson("accounts", { owner: owner.toBase58(), lootbox: lootbox.toBase58(), lootboxId: lootboxId.toString() });
  printTx("lootboxLandCommit", tx);
  printJson("before", { committed: before?.committed, commitSlot: Number(before?.commitSlot ?? 0) });
  printJson("after", { committed: after.committed, commitSlot: Number(after.commitSlot), saltHex: Buffer.from(salt32).toString("hex") });
  printSuccess("Commit land validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
