import fs from "node:fs";
import { lootboxCtx, parseLootboxId, salt32FromArgs, commitment, DOMAIN_MINER, pdas, fetchers, assertEq, assertTrue, printJson, printSuccess, printTx, bn } from "./_common";

async function main() {
  const { env, args } = lootboxCtx("11-commit-miner-lootbox");
  const owner = env.wallet.publicKey;
  const lootboxId = parseLootboxId(args);
  const saleType = Number(args.saleType ?? "0");
  const salt32 = salt32FromArgs(args);
  const lootbox = pdas.lootboxMiner(env.programId, owner, lootboxId, saleType);
  const before: any = await fetchers.fetchLootboxMinerState(env.program, lootbox);

  const tx = await env.program.methods.lootboxMinerCommit(bn(lootboxId), saleType, salt32).accounts({ owner, lootbox }).rpc();
  const after: any = await fetchers.fetchLootboxMinerState(env.program, lootbox);
  const expected = commitment(DOMAIN_MINER, lootboxId, salt32);

  assertTrue("committed", after.committed);
  assertTrue("commitSlot > 0", Number(after.commitSlot) > 0);
  assertEq("commitment", Buffer.from(after.commitment).toString("hex"), Buffer.from(expected).toString("hex"));

  fs.writeFileSync(`.lootbox_miner_${lootboxId.toString()}_salt.hex`, Buffer.from(salt32).toString("hex"));

  printJson("accounts", { owner: owner.toBase58(), lootbox: lootbox.toBase58(), lootboxId: lootboxId.toString() });
  printTx("lootboxMinerCommit", tx);
  printJson("before", { committed: before?.committed, commitSlot: Number(before?.commitSlot ?? 0) });
  printJson("after", { committed: after.committed, commitSlot: Number(after.commitSlot), saltHex: Buffer.from(salt32).toString("hex") });
  printSuccess("Commit miner validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
