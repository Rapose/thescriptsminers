import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "node:fs";
import { waitSlots } from "../helpers/test_env";

const SEED_CONFIG = Buffer.from("config");
const SEED_LB_MINER = Buffer.from("lb_miner");
const SEED_MINER = Buffer.from("miner");
const SEED_MINER_PROGRESS = Buffer.from("miner_progress_v1");

function u64Le(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

function readBool(buf: Buffer, offset: number): boolean {
  return buf.readUInt8(offset) !== 0;
}

function readU8(buf: Buffer, offset: number): number {
  return buf.readUInt8(offset);
}

function readU64(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

function readPubkey(buf: Buffer, offset: number): PublicKey {
  return new PublicKey(buf.subarray(offset, offset + 32));
}

function readBytes32(buf: Buffer, offset: number): Buffer {
  return Buffer.from(buf.subarray(offset, offset + 32));
}

type RawLootboxMinerState = {
  lootboxId: bigint;
  owner: PublicKey;
  committed: boolean;
  revealed: boolean;
  commitSlot: bigint;
  commitment: Buffer;
  rarity: number;
  element: number;
  hashBase: bigint;
  face: number;
  helmet: number;
  backpack: number;
  jacket: number;
  item: number;
  background: number;
  bump: number;
};

function parseLootboxMinerState(data: Buffer): RawLootboxMinerState {
  const o = 8;

  return {
    lootboxId: readU64(data, o),
    owner: readPubkey(data, o + 8),
    committed: readBool(data, o + 40),
    revealed: readBool(data, o + 41),
    commitSlot: readU64(data, o + 42),
    commitment: readBytes32(data, o + 50),
    rarity: readU8(data, o + 82),
    element: readU8(data, o + 83),
    hashBase: readU64(data, o + 84),
    face: readU8(data, o + 92),
    helmet: readU8(data, o + 93),
    backpack: readU8(data, o + 94),
    jacket: readU8(data, o + 95),
    item: readU8(data, o + 96),
    background: readU8(data, o + 97),
    bump: readU8(data, o + 98),
  };
}

async function fetchRawLootboxMinerState(
  connection: anchor.web3.Connection,
  pda: PublicKey
): Promise<RawLootboxMinerState> {
  const info = await connection.getAccountInfo(pda, "confirmed");
  if (!info) throw new Error("lootbox miner account não encontrada");
  return parseLootboxMinerState(Buffer.from(info.data));
}

function resolveIdlPath(): string {
  const candidates = [
    "target/idl/moe_anchor_v1.json",
    "target/idl/miners.json",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("IDL not found. Run `anchor build` first.");
}

function loadProgram(provider: anchor.AnchorProvider) {
  const idlPath = resolveIdlPath();
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  return new anchor.Program(idl, provider) as anchor.Program;
}

function getAccountClient(program: any, names: string[]) {
  for (const n of names) {
    if (program.account?.[n]) return program.account[n];
  }
  throw new Error(`Account client not found. Tried: ${names.join(", ")}`);
}

function pickField(obj: any, names: string[]) {
  for (const n of names) {
    if (obj?.[n] !== undefined) return obj[n];
  }
  return undefined;
}

function toDisplay(value: any) {
  if (value?.toBase58) return value.toBase58();
  if (typeof value === "bigint") return value.toString();
  if (value?.toString && typeof value !== "string") return value.toString();
  return value ?? null;
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = loadProgram(provider);
  const owner = provider.wallet.publicKey;

  const configAccount = getAccountClient(program, ["config"]);

  const lootboxId = BigInt(Date.now());

  const [config] = PublicKey.findProgramAddressSync(
    [SEED_CONFIG],
    program.programId
  );

  const cfgInfo = await provider.connection.getAccountInfo(config, "confirmed");
  if (!cfgInfo) {
    console.log("Config not found. Initializing...");
    await program.methods
      .initializeConfig()
      .accounts({
        admin: owner,
        config,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  const [lootbox] = PublicKey.findProgramAddressSync(
    [SEED_LB_MINER, owner.toBuffer(), u64Le(lootboxId)],
    program.programId
  );

  const cfgBefore: any = await configAccount.fetch(config);
  const nextMinerId = BigInt(cfgBefore.nextMinerId.toString());

  const [minerState] = PublicKey.findProgramAddressSync(
    [SEED_MINER, owner.toBuffer(), u64Le(nextMinerId)],
    program.programId
  );

  const [minerProgress] = PublicKey.findProgramAddressSync(
    [SEED_MINER_PROGRESS, minerState.toBuffer()],
    program.programId
  );

  const salt = new Uint8Array(32);

  console.log("debug PDAs:", {
    programId: program.programId.toBase58(),
    owner: owner.toBase58(),
    config: config.toBase58(),
    lootboxId: lootboxId.toString(),
    lootbox: lootbox.toBase58(),
    nextMinerId: nextMinerId.toString(),
    minerState: minerState.toBase58(),
    minerProgress: minerProgress.toBase58(),
  });

  await program.methods
    .lootboxMinerInit(new anchor.BN(lootboxId.toString()))
    .accounts({
      owner,
      config,
      lootbox,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("miner init ok");

  await program.methods
    .lootboxMinerCommit(new anchor.BN(lootboxId.toString()), [...salt])
    .accounts({
      owner,
      lootbox,
    })
    .rpc();

  const lbAfterCommit = await fetchRawLootboxMinerState(
    provider.connection,
    lootbox
  );

  console.log("lootbox miner after commit (raw debug only):", {
    lootboxId: lbAfterCommit.lootboxId.toString(),
    owner: lbAfterCommit.owner.toBase58(),
    committed: lbAfterCommit.committed,
    revealed: lbAfterCommit.revealed,
    commitSlot: lbAfterCommit.commitSlot.toString(),
    rarity: lbAfterCommit.rarity,
    element: lbAfterCommit.element,
    hashBase: lbAfterCommit.hashBase.toString(),
    commitmentHex: lbAfterCommit.commitment.toString("hex"),
  });

  // Não confiar no commitSlot raw enquanto o parser não estiver 100% alinhado.
  await waitSlots(provider.connection, 10);

  await program.methods
    .lootboxMinerReveal(new anchor.BN(lootboxId.toString()), [...salt])
    .accounts({
      owner,
      config,
      lootbox,
      minerState,
      minerProgress,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const lbAfterReveal = await fetchRawLootboxMinerState(
    provider.connection,
    lootbox
  );

  console.log("\n=== LOOTBOX MINER FINAL ===");
  console.log({
    lootboxPda: lootbox.toBase58(),
    lootboxId: lbAfterReveal.lootboxId.toString(),
    owner: lbAfterReveal.owner.toBase58(),
    committed: lbAfterReveal.committed,
    revealed: lbAfterReveal.revealed,
    commitSlot: lbAfterReveal.commitSlot.toString(),
    rarity: lbAfterReveal.rarity,
    element: lbAfterReveal.element,
    hashBase: lbAfterReveal.hashBase.toString(),
    face: lbAfterReveal.face,
    helmet: lbAfterReveal.helmet,
    backpack: lbAfterReveal.backpack,
    jacket: lbAfterReveal.jacket,
    item: lbAfterReveal.item,
    background: lbAfterReveal.background,
    bump: lbAfterReveal.bump,
    commitmentHex: lbAfterReveal.commitment.toString("hex"),
  });

  try {
    const minerAccount = getAccountClient(program, ["minerState", "miner"]);
    const miner: any = await minerAccount.fetch(minerState);

    console.log("\n=== MINER STATE ===");
    console.log({
      minerPda: minerState.toBase58(),
      lootboxPda: lootbox.toBase58(),
      id: toDisplay(pickField(miner, ["id"])),
      owner: toDisplay(pickField(miner, ["owner"])),
      rarity: pickField(miner, ["rarity"]),
      element: pickField(miner, ["element"]),
      hashBase: toDisplay(pickField(miner, ["hashBase", "hash_base"])),
      face: pickField(miner, ["face"]),
      helmet: pickField(miner, ["helmet"]),
      backpack: pickField(miner, ["backpack"]),
      jacket: pickField(miner, ["jacket"]),
      item: pickField(miner, ["item"]),
      background: pickField(miner, ["background"]),
      allocatedLand: toDisplay(
        pickField(miner, ["allocatedLand", "allocated_land"])
      ),
      listed: pickField(miner, ["listed"]),
      createdAt: toDisplay(pickField(miner, ["createdAt", "created_at"])),
      bump: pickField(miner, ["bump"]),
    });
  } catch (e: any) {
    console.log("[WARN] could not decode minerState via IDL:", e?.message ?? e);
  }

  try {
    const progressAccount = getAccountClient(program, [
      "minerProgress",
      "minerProgressState",
    ]);
    const progress: any = await progressAccount.fetch(minerProgress);

    console.log("\n=== MINER PROGRESS ===");
    console.log({
      minerProgressPda: minerProgress.toBase58(),
      miner: toDisplay(pickField(progress, ["miner"])),
      owner: toDisplay(pickField(progress, ["owner"])),
      level: toDisplay(pickField(progress, ["level"])),
      exp: toDisplay(pickField(progress, ["exp"])),
      lastExpClaimTs: toDisplay(
        pickField(progress, ["lastExpClaimTs", "last_exp_claim_ts"])
      ),
      bump: pickField(progress, ["bump"]),
    });
  } catch (e: any) {
    console.log(
      "[WARN] could not decode minerProgress via IDL:",
      e?.message ?? e
    );
  }

  console.log("✅ lootbox_miner_flow completed");
}

main().catch((e) => {
  console.error("FATAL lootbox_miner_flow:", e);
  process.exit(1);
});