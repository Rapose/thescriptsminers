import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";

export type ScriptEnv = {
  provider: anchor.AnchorProvider;
  program: anchor.Program;
  connection: Connection;
  wallet: anchor.Wallet;
  programId: PublicKey;
};

const DEFAULT_IDL = "target/idl/moe_anchor_v1.json";

function resolveIdlPath(): string {
  const envPath = process.env.ANCHOR_IDL_PATH;
  const candidates = [
    envPath,
    DEFAULT_IDL,
    "miners/target/idl/moe_anchor_v1.json",
    "target/idl/miners.json",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const full = path.resolve(candidate);
    if (fs.existsSync(full)) return full;
  }

  throw new Error(`IDL not found. Expected one of: ${candidates.join(", ")}`);
}

export function loadEnv(): ScriptEnv {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idlPath = resolveIdlPath();
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const explicitProgramId = process.env.ANCHOR_PROGRAM_ID;
  const programId = explicitProgramId ? new PublicKey(explicitProgramId) : new PublicKey(idl.address);

  const program = new anchor.Program(idl, programId, provider) as anchor.Program;

  return {
    provider,
    program,
    connection: provider.connection,
    wallet: provider.wallet as anchor.Wallet,
    programId,
  };
}

export function bn(n: number | string | bigint) {
  return new anchor.BN(n.toString());
}

export function keypairFromFileMaybe(filePath: string): Keypair | null {
  if (!fs.existsSync(filePath)) return null;
  const arr = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}
