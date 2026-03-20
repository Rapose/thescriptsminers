import { getAccount, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "node:fs";
import { parseCliArgs } from "../helpers/cli";
import { loadEnv } from "../helpers/env";
import { pdas } from "../helpers/pdas";
import { fetchers } from "../helpers/fetchers";
import { printHeader, printJson, printSuccess, printTx } from "../helpers/log";
import { assertDefaultPubkey, assertEq, assertExists, assertFalse, assertPubkeyEq, assertTrue } from "../helpers/assert";

export function equipmentCtx(title: string) {
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

export async function resolveMiner(env: ReturnType<typeof loadEnv>, args: Record<string, string | undefined>) {
  const owner = env.wallet.publicKey;
  if (args.miner) {
    const minerPk = new PublicKey(args.miner);
    return { owner, minerPk, equipment: pdas.equipmentState(env.programId, minerPk) };
  }

  const client = env.program.account?.minerState;
  if (!client) throw new Error("IDL sem account minerState");
  const miners = await client.all();
  const mine = miners.find((row: any) => row.account.owner.equals(owner) && !row.account.listed);
  if (!mine) throw new Error("Nenhum miner do owner encontrado. Passe --miner=...");
  const minerPk: PublicKey = mine.publicKey;
  return { owner, minerPk, equipment: pdas.equipmentState(env.programId, minerPk) };
}

export async function listOwnerEquipmentInstances(env: ReturnType<typeof loadEnv>, owner: PublicKey) {
  const client = env.program.account?.equipmentInstance;
  if (!client) throw new Error("IDL sem account equipmentInstance");
  const all = await client.all();
  return all
    .filter((r: any) => r.account.owner.equals(owner))
    .map((r: any) => ({ pubkey: r.publicKey as PublicKey, account: r.account }));
}

export async function findFreeEquipment(env: ReturnType<typeof loadEnv>, owner: PublicKey, slot: 0 | 1, minLevel = 1) {
  const all = await listOwnerEquipmentInstances(env, owner);
  const found = all
    .filter((x: any) => toNum(x.account.slot) === slot)
    .filter((x: any) => toNum(x.account.level) >= minLevel)
    .filter((x: any) => x.account.active && !x.account.listed && !x.account.broken)
    .filter((x: any) => x.account.equippedToMiner.equals(PublicKey.default));
  found.sort((a: any, b: any) => toNum(a.account.level) - toNum(b.account.level));
  return found;
}

export async function findFreeFourSameLevel(env: ReturnType<typeof loadEnv>, owner: PublicKey, slot: 0 | 1) {
  const all = await findFreeEquipment(env, owner, slot, 1);
  const byLevel = new Map<number, Array<{ pubkey: PublicKey; account: any }>>();
  for (const item of all) {
    const lvl = toNum(item.account.level);
    if (lvl >= 18) continue;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(item);
  }

  for (const [level, items] of byLevel) {
    if (items.length >= 4) return { level, items: items.slice(0, 4) };
  }

  throw new Error(`Não há 4 equipment livres do slot ${slot} no mesmo level (<18). Gere itens via expedition.`);
}

export { TOKEN_PROGRAM_ID, SystemProgram, pdas, fetchers, assertDefaultPubkey, assertEq, assertExists, assertFalse, assertPubkeyEq, assertTrue, getAccount, getOrCreateAssociatedTokenAccount, printJson, printSuccess, printTx };
