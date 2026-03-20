import * as anchor from "@coral-xyz/anchor";
import { getAccount, getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";
import { parseCliArgs } from "../helpers/cli";
import { loadEnv } from "../helpers/env";
import { pdas } from "../helpers/pdas";
import { fetchers } from "../helpers/fetchers";
import { airdropIfNeeded, fundIfNeeded } from "../helpers/fixtures";
import { printHeader, printJson, printSuccess, printTx, printWarn } from "../helpers/log";
import { assertEq, assertExists, assertFalse, assertPubkeyEq, assertTrue, expectFailure } from "../helpers/assert";

const WALLET_DIR = ".devnet_test_wallets";
const BUYER_FILE = path.join(WALLET_DIR, "buyer.json");

export function marketCtx(title: string) {
  const env = loadEnv();
  const args = parseCliArgs();
  printHeader(title);
  return { env, args };
}

export function bn(v: number | string | bigint) {
  return new anchor.BN(v.toString());
}

export function toNum(v: any): number {
  return Number(v?.toString?.() ?? v);
}

export function resolveEssMint(args: Record<string, string | undefined>) {
  if (args.essMint) return new PublicKey(args.essMint);
  if (fs.existsSync(".ess_mint.tmp")) return new PublicKey(fs.readFileSync(".ess_mint.tmp", "utf8").trim());
  throw new Error("Passe --essMint=... ou crie .ess_mint.tmp");
}

function loadOrCreateKeypair(filePath: string) {
  if (fs.existsSync(filePath)) {
    const arr = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
  const kp = Keypair.generate();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

export async function fixtureParties(env: ReturnType<typeof loadEnv>, args: Record<string, string | undefined>, essMint: PublicKey) {
  const seller = env.wallet.publicKey;
  const buyer = args.buyer ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(args.buyer, "utf8")))) : loadOrCreateKeypair(BUYER_FILE);

  await fundIfNeeded(env.provider, buyer.publicKey);
  await airdropIfNeeded(env.provider, buyer.publicKey);

  const payer = (env.wallet as any).payer;
  const sellerAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, seller)).address;
  const buyerAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, buyer.publicKey)).address;

  const sellerBalance = await getAccount(env.connection, sellerAta);
  if (sellerBalance.amount > 0n) {
    const transferAmount = sellerBalance.amount > 2_000_000_000n ? 2_000_000_000n : sellerBalance.amount / 4n;
    if (transferAmount > 0n) {
      await transfer(env.connection, payer, sellerAta, buyerAta, payer, transferAmount);
    }
  }

  return { seller, buyer, sellerAta, buyerAta };
}

export async function nextListingPda(env: ReturnType<typeof loadEnv>) {
  const config = pdas.config(env.programId);
  const cfg: any = assertExists("config", await fetchers.fetchConfig(env.program, config));
  const id = BigInt(cfg.nextListingId.toString());
  const listing = pdas.listing(env.programId, id);
  return { config, id, listing };
}

export async function findOwnedMiner(env: ReturnType<typeof loadEnv>, owner: PublicKey, listed?: boolean) {
  const client = env.program.account?.minerState;
  if (!client) throw new Error("IDL sem minerState");
  const all = await client.all();
  const found = all.find((r: any) => r.account.owner.equals(owner) && (listed == null || !!r.account.listed === listed));
  if (!found) throw new Error("Miner não encontrado para owner informado");
  return found.publicKey as PublicKey;
}

export async function findOwnedLand(env: ReturnType<typeof loadEnv>, owner: PublicKey, listed?: boolean) {
  const client = env.program.account?.landState;
  if (!client) throw new Error("IDL sem landState");
  const all = await client.all();
  const found = all.find((r: any) => r.account.owner.equals(owner) && (listed == null || !!r.account.listed === listed));
  if (!found) throw new Error("Land não encontrado para owner informado");
  return found.publicKey as PublicKey;
}

export async function findOwnedEquipment(env: ReturnType<typeof loadEnv>, owner: PublicKey, listed?: boolean) {
  const client = env.program.account?.equipmentInstance;
  if (!client) throw new Error("IDL sem equipmentInstance");
  const all = await client.all();
  const found = all.find((r: any) => r.account.owner.equals(owner) && r.account.active && r.account.equippedToMiner.equals(PublicKey.default) && (listed == null || !!r.account.listed === listed));
  if (!found) throw new Error("EquipmentInstance livre não encontrado para owner informado");
  return found.publicKey as PublicKey;
}

export async function findActiveListingByKind(env: ReturnType<typeof loadEnv>, kind: 1 | 2 | 3, seller?: PublicKey) {
  const client = env.program.account?.listingState ?? env.program.account?.listing;
  if (!client) throw new Error("IDL sem listingState/listing");
  const all = await client.all();
  const found = all.find((r: any) => r.account.active && toNum(r.account.assetKind) === kind && (!seller || r.account.seller.equals(seller)));
  if (!found) throw new Error(`Listing ativa kind=${kind} não encontrada`);
  return found.publicKey as PublicKey;
}

export function requireMethod(env: ReturnType<typeof loadEnv>, methodName: string) {
  const fn = (env.program.methods as any)?.[methodName];
  return typeof fn === "function";
}

export { pdas, fetchers, assertEq, assertExists, assertFalse, assertPubkeyEq, assertTrue, expectFailure, getAccount, getOrCreateAssociatedTokenAccount, printJson, printSuccess, printTx, printWarn };
