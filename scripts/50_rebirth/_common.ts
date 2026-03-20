import { getAccount, getMint, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "node:fs";
import { parseCliArgs } from "../helpers/cli";
import { loadEnv, bn } from "../helpers/env";
import { pdas } from "../helpers/pdas";
import { fetchers } from "../helpers/fetchers";
import { printHeader, printJson, printSuccess, printTx, printWarn } from "../helpers/log";
import { assertEq, assertFalse, assertPubkeyEq, assertTrue, expectFailure } from "../helpers/assert";

export function rebirthCtx(title: string) {
  const env = loadEnv();
  const args = parseCliArgs();
  printHeader(title);
  return { env, args };
}

export function toNum(v: any) { return Number(v?.toString?.() ?? v); }

export function resolveEssMint(args: Record<string, string | undefined>) {
  if (args.essMint) return new PublicKey(args.essMint);
  if (fs.existsSync('.ess_mint.tmp')) return new PublicKey(fs.readFileSync('.ess_mint.tmp','utf8').trim());
  throw new Error('Passe --essMint=... ou crie .ess_mint.tmp');
}

export async function resolveParents(env: ReturnType<typeof loadEnv>, args: Record<string, string | undefined>) {
  const owner = env.wallet.publicKey;
  const config = pdas.config(env.programId);
  const cfg: any = await fetchers.fetchConfig(env.program, config);

  const parentA = args.parentA ? new PublicKey(args.parentA) : pdas.miner(env.programId, owner, BigInt(cfg.nextMinerId.toString()) - 1n);
  const parentB = args.parentB ? new PublicKey(args.parentB) : pdas.miner(env.programId, owner, BigInt(cfg.nextMinerId.toString()) - 2n);

  const parentAProgress = pdas.minerProgress(env.programId, parentA);
  const parentBProgress = pdas.minerProgress(env.programId, parentB);
  const child = pdas.miner(env.programId, owner, BigInt(cfg.nextMinerId.toString()));
  const childProgress = pdas.minerProgress(env.programId, child);

  return { owner, config, parentA, parentB, parentAProgress, parentBProgress, child, childProgress, cfg };
}

export function rarityHashRange(rarity: number): [number, number] {
  if (rarity === 0) return [60, 100];
  if (rarity === 1) return [120, 180];
  if (rarity === 2) return [300, 450];
  if (rarity === 3) return [600, 900];
  if (rarity === 4) return [1200, 1600];
  throw new Error(`Invalid rarity ${rarity}`);
}

export { TOKEN_PROGRAM_ID, SystemProgram, pdas, fetchers, bn, getAccount, getMint, getOrCreateAssociatedTokenAccount, assertEq, assertFalse, assertPubkeyEq, assertTrue, expectFailure, printJson, printSuccess, printTx, printWarn };
