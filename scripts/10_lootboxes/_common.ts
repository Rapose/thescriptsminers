import { TOKEN_PROGRAM_ID, getAccount, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import crypto from "node:crypto";
import fs from "node:fs";
import { parseCliArgs, requireArg } from "../helpers/cli";
import { loadEnv, bn } from "../helpers/env";
import { pdas, u64Le } from "../helpers/pdas";
import { fetchers } from "../helpers/fetchers";
import { printHeader, printJson, printSuccess, printTx } from "../helpers/log";
import { assertEq, assertFalse, assertPubkeyEq, assertTrue, assertDefaultPubkey } from "../helpers/assert";
import { waitSlots } from "../helpers/waits";

export const DOMAIN_MINER = Buffer.from("MOE:LB:MINER");
export const DOMAIN_LAND = Buffer.from("MOE:LB:LAND");
export const MIN_REVEAL_DELAY_SLOTS = 2;

export function lootboxCtx(title: string) {
  const env = loadEnv();
  const args = parseCliArgs();
  printHeader(title);
  return { env, args };
}

export function resolveEssMint(args: Record<string, string | undefined>) {
  if (args.essMint) return new PublicKey(args.essMint);
  if (fs.existsSync(".ess_mint.tmp")) return new PublicKey(fs.readFileSync(".ess_mint.tmp", "utf8").trim());
  throw new Error("Passe --essMint=... ou crie .ess_mint.tmp");
}

export function parseLootboxId(args: Record<string, string | undefined>) {
  return BigInt(requireArg(args, "lootboxId"));
}

export function salt32FromArgs(args: Record<string, string | undefined>) {
  if (args.saltHex) {
    const b = Buffer.from(args.saltHex, "hex");
    if (b.length !== 32) throw new Error("--saltHex precisa ter 32 bytes (64 hex chars)");
    return [...b] as number[];
  }
  return [...crypto.randomBytes(32)] as number[];
}

export function commitment(domain: Buffer, lootboxId: bigint, salt32: number[]) {
  const id = u64Le(lootboxId);
  const h = crypto.createHash("sha256");
  h.update(domain);
  h.update(id);
  h.update(Buffer.from(salt32));
  return [...h.digest()] as number[];
}

export async function economyAccounts(env: ReturnType<typeof loadEnv>, essMint: PublicKey, buyer: PublicKey) {
  const economy = pdas.economy(env.programId);
  const eco: any = await fetchers.fetchEconomy(env.program, economy);
  if (!eco) throw new Error("Economy não inicializada. Rode bootstrap primeiro.");
  const recipientWallet = eco.recipientWallet as PublicKey;
  const payer = (env.wallet as any).payer as Keypair;
  const userAta = await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, buyer);
  const recipientAta = await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, recipientWallet);
  return { economy, recipientWallet, userAta: userAta.address, recipientAta: recipientAta.address, eco };
}

export async function printAssetSummary(label: string, address: PublicKey, data: any) {
  printJson(label, { address: address.toBase58(), data });
}

export { TOKEN_PROGRAM_ID, SystemProgram, pdas, fetchers, getAccount, assertEq, assertFalse, assertPubkeyEq, assertTrue, assertDefaultPubkey, printJson, printSuccess, printTx, waitSlots, bn };
