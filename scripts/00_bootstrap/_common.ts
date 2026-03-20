import { getOrCreateAssociatedTokenAccount, getAccount, getMint, TOKEN_PROGRAM_ID, createMint, mintTo, setAuthority, AuthorityType } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "node:fs";
import { parseCliArgs, requireArg } from "../helpers/cli";
import { loadEnv, bn } from "../helpers/env";
import { pdas } from "../helpers/pdas";
import { fetchers } from "../helpers/fetchers";
import { printHeader, printJson, printSuccess, printTx } from "../helpers/log";
import { assertEq, assertFalse, assertPubkeyEq, assertTrue } from "../helpers/assert";

export function bootstrapCtx(title: string) {
  const env = loadEnv();
  const args = parseCliArgs();
  printHeader(title);
  return { env, args };
}

export function resolveEssMint(args: Record<string, string | undefined>) {
  if (args.essMint) return new PublicKey(args.essMint);
  if (fs.existsSync(".ess_mint.tmp")) return new PublicKey(fs.readFileSync(".ess_mint.tmp", "utf8").trim());
  throw new Error("ESS mint não encontrado. Passe --essMint=... ou rode 00-create-fixed-mint.ts");
}

export async function ensureRewardsVault(env: ReturnType<typeof loadEnv>, essMint: PublicKey) {
  const rewardsAuthority = pdas.rewardsAuthority(env.programId);
  const vault = await getOrCreateAssociatedTokenAccount(
    env.connection,
    (env.wallet as any).payer as Keypair,
    essMint,
    rewardsAuthority,
    true
  );
  return { rewardsAuthority, rewardsVault: vault.address };
}

export function standardBootstrapAccounts(env: ReturnType<typeof loadEnv>) {
  return {
    config: pdas.config(env.programId),
    economy: pdas.economy(env.programId),
    progression: pdas.progression(env.programId),
    globalMining: pdas.globalMining(env.programId),
    rebirthConfig: pdas.rebirthConfig(env.programId),
    expeditionConfig: pdas.expeditionConfig(env.programId),
  };
}

export async function createFixedMintIfNeeded() {
  const { env, args } = bootstrapCtx("00-create-fixed-mint");
  const payer = (env.wallet as any).payer as Keypair;
  const decimals = Number(args.decimals ?? "8");
  const supply = BigInt(args.supply ?? (1000n * 10n ** 8n).toString());

  if (fs.existsSync(".ess_mint.tmp")) {
    const mint = new PublicKey(fs.readFileSync(".ess_mint.tmp", "utf8").trim());
    const mintInfo = await getMint(env.connection, mint);
    assertEq("cached mint decimals", mintInfo.decimals, decimals);
    assertTrue("cached mint supply > 0", mintInfo.supply > 0n);
    printJson("mint", { mint: mint.toBase58(), reused: true, decimals: mintInfo.decimals, supply: mintInfo.supply.toString() });
    printSuccess("Mint já existente no cache local");
    return;
  }

  const mint = await createMint(env.connection, payer, env.wallet.publicKey, null, decimals);
  const ata = await getOrCreateAssociatedTokenAccount(env.connection, payer, mint, env.wallet.publicKey);
  const sigMint = await mintTo(env.connection, payer, mint, ata.address, payer, supply);
  await setAuthority(env.connection, payer, mint, payer, AuthorityType.MintTokens, null);

  const mintInfo = await getMint(env.connection, mint);
  const ataInfo = await getAccount(env.connection, ata.address);
  assertEq("created mint decimals", mintInfo.decimals, decimals);
  assertEq("created mint supply", mintInfo.supply.toString(), supply.toString());
  assertEq("creator ATA balance", ataInfo.amount.toString(), supply.toString());

  fs.writeFileSync(".ess_mint.tmp", mint.toBase58(), "utf8");
  printTx("mintTo", sigMint);
  printJson("created", { mint: mint.toBase58(), ata: ata.address.toBase58(), supply: supply.toString() });
  printSuccess("Mint fixo criado e salvo em .ess_mint.tmp");
}

export async function validateConfigDefaults(program: any, config: PublicKey, admin: PublicKey) {
  const cfg: any = await fetchers.fetchConfig(program, config);
  assertPubkeyEq("config.admin", cfg.admin, admin);
  assertFalse("config.paused", cfg.paused);
  assertEq("nextMinerId", Number(cfg.nextMinerId), 0);
  assertEq("nextLandId", Number(cfg.nextLandId), 0);
  assertEq("nextListingId", Number(cfg.nextListingId), 0);
  assertFalse("presaleSolEnabled", cfg.presaleSolEnabled);
  assertFalse("publicLootboxInitEnabled", cfg.publicLootboxInitEnabled);
}

export { bn, getAccount, requireArg, SystemProgram, TOKEN_PROGRAM_ID, fetchers, assertEq, assertTrue, assertPubkeyEq, printJson, printSuccess, printTx };
