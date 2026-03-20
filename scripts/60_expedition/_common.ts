import { BN } from "@coral-xyz/anchor";
import { getAccount, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "node:fs";
import { parseCliArgs } from "../helpers/cli";
import { loadEnv } from "../helpers/env";
import { fetchers } from "../helpers/fetchers";
import { printHeader, printJson, printSuccess, printTx, printWarn } from "../helpers/log";
import { pdas, SEEDS, u64Le } from "../helpers/pdas";
import { waitForExpeditionUnlock } from "../helpers/waits";
import { assertDefaultPubkey, assertEq, assertExists, assertFalse, assertPubkeyEq, assertTrue } from "../helpers/assert";

export function expeditionCtx(title: string) {
  const env = loadEnv();
  const args = parseCliArgs();
  printHeader(title);
  return { env, args };
}

export function toNum(v: any): number {
  return Number(v?.toString?.() ?? v);
}

export function toBig(v: any): bigint {
  return BigInt(v?.toString?.() ?? v ?? 0);
}

export function resolveEssMint(args: Record<string, string | undefined>) {
  if (args.essMint) return new PublicKey(args.essMint);
  if (fs.existsSync(".ess_mint.tmp")) return new PublicKey(fs.readFileSync(".ess_mint.tmp", "utf8").trim());
  throw new Error("Passe --essMint=... ou crie .ess_mint.tmp");
}

export function resolveTier(args: Record<string, string | undefined>) {
  return Number(args.tier ?? "1");
}

export async function accountExists(connection: ReturnType<typeof loadEnv>["connection"], key: PublicKey) {
  return !!(await connection.getAccountInfo(key, "confirmed"));
}

export async function findOwnedMinerForExpedition(env: ReturnType<typeof loadEnv>, args: Record<string, string | undefined>) {
  const owner = env.wallet.publicKey;
  if (args.miner) {
    const minerPk = new PublicKey(args.miner);
    return { owner, minerPk, minerProgress: pdas.minerProgress(env.programId, minerPk) };
  }

  const client = env.program.account?.minerState;
  if (!client) throw new Error("IDL sem account minerState");
  const miners = await client.all();

  for (const row of miners) {
    const miner: any = row.account;
    const minerPk: PublicKey = row.publicKey;
    if (!miner.owner.equals(owner)) continue;
    if (miner.listed) continue;
    if (!miner.allocatedLand.equals(PublicKey.default)) continue;

    const session = pdas.expeditionSession(env.programId, minerPk);
    if (await accountExists(env.connection, session)) continue;

    return { owner, minerPk, minerProgress: pdas.minerProgress(env.programId, minerPk) };
  }

  throw new Error("Nenhum miner elegível encontrado sem sessão ativa/histórica. Passe --miner=...");
}

export async function ensureRewardsVaultLiquidity(
  env: ReturnType<typeof loadEnv>,
  essMint: PublicKey,
  minAmount: bigint
) {
  const payer = (env.wallet as any).payer;
  const owner = env.wallet.publicKey;
  const rewardsAuthority = pdas.rewardsAuthority(env.programId);
  const rewardsVault = pdas.rewardsVault(essMint, rewardsAuthority);

  const ownerAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, owner)).address;
  await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, rewardsAuthority, true);

  const vaultBefore = await getAccount(env.connection, rewardsVault);
  if (vaultBefore.amount < minAmount) {
    const deficit = new BN((minAmount - vaultBefore.amount).toString());
    const tx = await env.program.methods.rewardsDeposit(deficit).accounts({
      depositor: owner,
      economy: pdas.economy(env.programId),
      essMint,
      depositorAta: ownerAta,
      rewardsAuthority,
      rewardsVault,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
    printTx("rewardsDeposit(top-up)", tx);
  }

  return {
    ownerAta,
    rewardsAuthority,
    rewardsVault,
    vaultAmount: (await getAccount(env.connection, rewardsVault)).amount,
  };
}

export async function resolveSessionIfUnlocked(
  env: ReturnType<typeof loadEnv>,
  params: {
    owner: PublicKey;
    minerPk: PublicKey;
    minerProgress: PublicKey;
    sessionPk: PublicKey;
    expeditionConfig: PublicKey;
    economy: PublicKey;
    essMint: PublicKey;
    ownerAta: PublicKey;
    rewardsVault: PublicKey;
    rewardsAuthority: PublicKey;
  }
) {
  const session: any = await fetchers.fetchExpeditionSession(env.program, params.sessionPk);
  if (!session) return false;
  if (toNum(session.resolvedAt) > 0) return false;

  await waitForExpeditionUnlock(env.connection, toNum(session.endsAt));

  const tx = await env.program.methods.expeditionResolve().accounts({
    owner: params.owner,
    minerState: params.minerPk,
    minerProgress: params.minerProgress,
    expeditionSession: params.sessionPk,
    economy: params.economy,
    expeditionConfig: params.expeditionConfig,
    tokenProgram: TOKEN_PROGRAM_ID,
    rewardsVault: params.rewardsVault,
    rewardsAuthority: params.rewardsAuthority,
    ownerAta: params.ownerAta,
  }).rpc();
  printTx("expeditionResolve(pre)", tx);
  return true;
}

export function equipmentInstancePda(programId: PublicKey, id: bigint) {
  return PublicKey.findProgramAddressSync([SEEDS.EQUIPMENT_INSTANCE, u64Le(id)], programId)[0];
}

export { TOKEN_PROGRAM_ID, SystemProgram, pdas, fetchers, waitForExpeditionUnlock, assertDefaultPubkey, assertEq, assertExists, assertFalse, assertPubkeyEq, assertTrue, getAccount, getOrCreateAssociatedTokenAccount, printJson, printSuccess, printTx, printWarn };
