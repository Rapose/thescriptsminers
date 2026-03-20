import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "node:fs";
import { waitSlots } from "../helpers/test_env";

const SEED_CONFIG = Buffer.from("config");
const SEED_LB_LAND = Buffer.from("lb_land");
const SEED_LAND = Buffer.from("land");

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

type RawLootboxLandState = {
  lootboxId: bigint;
  owner: PublicKey;
  committed: boolean;
  revealed: boolean;
  commitSlot: bigint;
  commitment: Buffer;
  rarity: number;
  element: number;
  slots: number;
  bump: number;
};

function parseLootboxLandState(data: Buffer): RawLootboxLandState {
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
    slots: readU8(data, o + 84),
    bump: readU8(data, o + 85),
  };
}

async function fetchRawLootboxLandState(
  connection: anchor.web3.Connection,
  pda: PublicKey
): Promise<RawLootboxLandState> {
  const info = await connection.getAccountInfo(pda, "confirmed");
  if (!info) throw new Error("lootbox land account não encontrada");
  return parseLootboxLandState(Buffer.from(info.data));
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
    [SEED_LB_LAND, owner.toBuffer(), u64Le(lootboxId)],
    program.programId
  );

  const cfgBefore: any = await configAccount.fetch(config);
  const nextLandId = BigInt(cfgBefore.nextLandId.toString());

  const [landState] = PublicKey.findProgramAddressSync(
    [SEED_LAND, owner.toBuffer(), u64Le(nextLandId)],
    program.programId
  );

  const salt = new Uint8Array(32);

  console.log("debug PDAs:", {
    programId: program.programId.toBase58(),
    owner: owner.toBase58(),
    config: config.toBase58(),
    lootboxId: lootboxId.toString(),
    lootbox: lootbox.toBase58(),
    nextLandId: nextLandId.toString(),
    landState: landState.toBase58(),
  });

  await program.methods
    .lootboxLandInit(new anchor.BN(lootboxId.toString()))
    .accounts({
      owner,
      config,
      lootbox,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("land init ok");

  await program.methods
    .lootboxLandCommit(new anchor.BN(lootboxId.toString()), [...salt])
    .accounts({
      owner,
      lootbox,
    })
    .rpc();

  const lbAfterCommit = await fetchRawLootboxLandState(
    provider.connection,
    lootbox
  );

  console.log("lootbox land after commit (raw debug only):", {
    lootboxId: lbAfterCommit.lootboxId.toString(),
    owner: lbAfterCommit.owner.toBase58(),
    committed: lbAfterCommit.committed,
    revealed: lbAfterCommit.revealed,
    commitSlot: lbAfterCommit.commitSlot.toString(),
    rarity: lbAfterCommit.rarity,
    element: lbAfterCommit.element,
    slots: lbAfterCommit.slots,
    commitmentHex: lbAfterCommit.commitment.toString("hex"),
  });

  // Não confiar no commitSlot raw enquanto o parser não estiver 100% alinhado.
  await waitSlots(provider.connection, 10);

  await program.methods
    .lootboxLandReveal(new anchor.BN(lootboxId.toString()), [...salt])
    .accounts({
      owner,
      config,
      lootbox,
      landState,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const lbAfterReveal = await fetchRawLootboxLandState(
    provider.connection,
    lootbox
  );

  console.log("\n=== LOOTBOX LAND FINAL ===");
  console.log({
    lootboxPda: lootbox.toBase58(),
    lootboxId: lbAfterReveal.lootboxId.toString(),
    owner: lbAfterReveal.owner.toBase58(),
    committed: lbAfterReveal.committed,
    revealed: lbAfterReveal.revealed,
    commitSlot: lbAfterReveal.commitSlot.toString(),
    rarity: lbAfterReveal.rarity,
    element: lbAfterReveal.element,
    slots: lbAfterReveal.slots,
    bump: lbAfterReveal.bump,
    commitmentHex: lbAfterReveal.commitment.toString("hex"),
  });

  try {
    const landAccount = getAccountClient(program, ["landState", "land"]);
    const land: any = await landAccount.fetch(landState);

    console.log("\n=== LAND STATE ===");
    console.log({
      landPda: landState.toBase58(),
      lootboxPda: lootbox.toBase58(),
      id: toDisplay(pickField(land, ["id"])),
      owner: toDisplay(pickField(land, ["owner"])),
      rarity: pickField(land, ["rarity"]),
      element: pickField(land, ["element"]),
      slots: toDisplay(pickField(land, ["slots", "maxSlots", "max_slots"])),
      listed: pickField(land, ["listed"]),
      allocatedMinersCount: toDisplay(
        pickField(land, ["allocatedMinersCount", "allocated_miners_count"])
      ),
      createdAt: toDisplay(pickField(land, ["createdAt", "created_at"])),
      bump: pickField(land, ["bump"]),
    });
  } catch (e: any) {
    console.log("[WARN] could not decode landState via IDL:", e?.message ?? e);
  }

  console.log("✅ lootbox_land_flow completed");
}

main().catch((e) => {
  console.error("FATAL lootbox_land_flow:", e);
  process.exit(1);
});