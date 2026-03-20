import { getOrCreateAssociatedTokenAccount, getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { parseCliArgs, requireArg } from "../helpers/cli";
import { loadEnv, bn } from "../helpers/env";
import { pdas } from "../helpers/pdas";
import { fetchers } from "../helpers/fetchers";
import { printHeader, printJson, printSuccess, printTx, printWarn } from "../helpers/log";
import { assertEq, assertPubkeyEq, assertTrue, expectFailure } from "../helpers/assert";
import { waitUntilTimestamp } from "../helpers/waits";

export function progressionCtx(title: string) {
  const env = loadEnv();
  const args = parseCliArgs();
  printHeader(title);
  return { env, args };
}

export function toNum(v: any) {
  return Number(v?.toString?.() ?? v);
}

export function pick<T = any>(obj: any, camel: string, snake: string): T {
  return (obj?.[camel] ?? obj?.[snake]) as T;
}

export function powBps(baseBps: number, exp: number): number {
  let result = 10_000;
  let base = baseBps;
  while (exp > 0) {
    if (exp & 1) result = Math.floor((result * base) / 10_000);
    base = Math.floor((base * base) / 10_000);
    exp >>= 1;
  }
  return result;
}

export function expRequired(cfg: any, rarityIdx: number, level: number): number {
  const base = Number(pick(cfg, "expBaseByRarity", "exp_base_by_rarity")?.[rarityIdx] ?? 0);
  const growth = Number(pick(cfg, "expGrowthBps", "exp_growth_bps"));
  return Math.floor((base * powBps(growth, Math.max(level - 1, 0))) / 10_000);
}

export function essCostForLevelUp(cfg: any, rarityIdx: number, level: number): number {
  const base = Number(pick(cfg, "essBaseCostByRarity", "ess_base_cost_by_rarity")?.[rarityIdx] ?? 0);
  const growth = Number(pick(cfg, "essGrowthBps", "ess_growth_bps"));
  return Math.floor((base * powBps(growth, Math.max(level - 1, 0))) / 10_000);
}

export async function resolveMinerAndProgress(env: ReturnType<typeof loadEnv>, args: Record<string, string | undefined>) {
  const owner = env.wallet.publicKey;
  const config = pdas.config(env.programId);
  const cfg: any = await fetchers.fetchConfig(env.program, config);
  const minerPk = args.miner ? new PublicKey(args.miner) : pdas.miner(env.programId, owner, BigInt(cfg.nextMinerId.toString()) - 1n);
  const progressPk = pdas.minerProgress(env.programId, minerPk);
  return { owner, config, minerPk, progressPk };
}

export async function ensureClaimWindowIfNeeded(lastClaimTs: number, windowSec: number) {
  const now = Math.floor(Date.now() / 1000);
  const target = lastClaimTs + windowSec;
  if (now < target) await waitUntilTimestamp(target + 1);
}

export { getOrCreateAssociatedTokenAccount, getAccount, TOKEN_PROGRAM_ID, SystemProgram, pdas, fetchers, bn, requireArg, assertEq, assertPubkeyEq, assertTrue, expectFailure, printJson, printSuccess, printTx, printWarn };
