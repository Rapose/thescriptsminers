import { getAccount, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "node:fs";
import { parseCliArgs } from "../helpers/cli";
import { loadEnv, bn } from "../helpers/env";
import { pdas } from "../helpers/pdas";
import { fetchers } from "../helpers/fetchers";
import { printHeader, printJson, printSuccess, printTx, printWarn } from "../helpers/log";
import { assertDefaultPubkey, assertEq, assertFalse, assertPubkeyEq, assertTrue } from "../helpers/assert";

export function gmCtx(title: string) {
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

export function resolveEssMint(args: Record<string, string | undefined>) {
  if (args.essMint) return new PublicKey(args.essMint);
  if (fs.existsSync(".ess_mint.tmp")) return new PublicKey(fs.readFileSync(".ess_mint.tmp", "utf8").trim());
  throw new Error("Passe --essMint=... ou crie .ess_mint.tmp");
}

export async function resolveMinerLand(env: ReturnType<typeof loadEnv>, args: Record<string, string | undefined>) {
  const owner = env.wallet.publicKey;
  const config = pdas.config(env.programId);
  const cfg: any = await fetchers.fetchConfig(env.program, config);
  const minerPk = args.miner ? new PublicKey(args.miner) : pdas.miner(env.programId, owner, BigInt(cfg.nextMinerId.toString()) - 1n);
  const landPk = args.land ? new PublicKey(args.land) : pdas.land(env.programId, owner, BigInt(cfg.nextLandId.toString()) - 1n);
  const minerProgress = pdas.minerProgress(env.programId, minerPk);
  const minerMining = pdas.minerMining(env.programId, minerPk);
  const equipment = args.equipment ? new PublicKey(args.equipment) : pdas.equipmentState(env.programId, minerPk);
  return { owner, config, minerPk, landPk, minerProgress, minerMining, equipment };
}

export { TOKEN_PROGRAM_ID, SystemProgram, pdas, fetchers, bn, getAccount, getOrCreateAssociatedTokenAccount, assertDefaultPubkey, assertEq, assertFalse, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx, printWarn };
