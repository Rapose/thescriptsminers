import { LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { parseCliArgs, requireArg } from "../helpers/cli";
import { loadEnv, bn } from "../helpers/env";
import { pdas } from "../helpers/pdas";
import { fetchers } from "../helpers/fetchers";
import { printHeader, printJson, printSuccess, printTx } from "../helpers/log";
import { assertEq, assertFalse, assertPubkeyEq, assertTrue } from "../helpers/assert";
import { fundIfNeeded } from "../helpers/fixtures";

export function presaleCtx(title: string) {
  const env = loadEnv();
  const args = parseCliArgs();
  printHeader(title);
  return { env, args };
}

export function purchaseIdFromArgs(args: Record<string, string | undefined>) {
  return BigInt(requireArg(args, "purchaseId"));
}

export async function ensureBuyerFunded(env: ReturnType<typeof loadEnv>, buyer: PublicKey) {
  await fundIfNeeded(env.provider, buyer, 0.5 * LAMPORTS_PER_SOL);
}

export { SystemProgram, pdas, fetchers, assertEq, assertFalse, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx, bn };
