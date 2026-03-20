import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Connection,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";

export type Env = {
  provider: anchor.AnchorProvider;
  program: anchor.Program;
  admin: any;
};

function resolveIdlPath(): string {
  const candidates = [
    path.resolve("target/idl/moe_anchor_v1.json"),
    path.resolve("target/idl/miners.json"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error("IDL not found. Run `anchor build` first.");
}

export function loadEnv(): Env {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idlPath = resolveIdlPath();
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

  const program = new anchor.Program(idl, provider) as anchor.Program;

  console.log("loadEnv rpc =", provider.connection.rpcEndpoint);
  console.log("loadEnv wallet =", provider.wallet.publicKey.toBase58());

  return { provider, program, admin: provider.wallet as any };
}

export async function airdropIfNeeded(
  provider: anchor.AnchorProvider,
  wallet: PublicKey,
  minLamports = 2 * LAMPORTS_PER_SOL
) {
  const connection = provider.connection;
  const endpoint = connection.rpcEndpoint;

  const bal = await connection.getBalance(wallet, "confirmed");
  if (bal >= minLamports) {
    console.log("airdrop skipped:", {
      wallet: wallet.toBase58(),
      balance: bal,
      endpoint,
    });
    return;
  }

  const amount = minLamports - bal + LAMPORTS_PER_SOL;
  let lastErr: any;

  for (let i = 0; i < 5; i++) {
    try {
      console.log(`airdrop attempt ${i + 1}:`, {
        wallet: wallet.toBase58(),
        amount,
        endpoint,
      });

      const sig = await connection.requestAirdrop(wallet, amount);
      const latest = await connection.getLatestBlockhash("confirmed");

      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed"
      );

      const after = await connection.getBalance(wallet, "confirmed");
      if (after >= minLamports) {
        console.log("airdrop success:", {
          wallet: wallet.toBase58(),
          balance: after,
          endpoint,
        });
        return;
      }
    } catch (e) {
      lastErr = e;
      console.log(`airdrop attempt ${i + 1} failed:`, e);
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  throw lastErr;
}

export async function fundIfNeeded(
  provider: anchor.AnchorProvider,
  wallet: PublicKey,
  minLamports = 2 * LAMPORTS_PER_SOL
) {
  const connection = provider.connection;
  const bal = await connection.getBalance(wallet, "confirmed");
  if (bal >= minLamports) {
    console.log("fund skipped:", {
      wallet: wallet.toBase58(),
      balance: bal,
    });
    return;
  }

  const amount = minLamports - bal + LAMPORTS_PER_SOL;

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: provider.wallet.publicKey,
      toPubkey: wallet,
      lamports: amount,
    })
  );

  await provider.sendAndConfirm(tx, []);
  const after = await connection.getBalance(wallet, "confirmed");

  console.log("fund success:", {
    wallet: wallet.toBase58(),
    balance: after,
  });
}

export function bn(n: number | string | bigint) {
  return new anchor.BN(n.toString());
}

export function assertEq<T>(label: string, got: T, expected: T) {
  if (got !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(got)}`);
  }
}

export async function expectTxFail(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error(`${label}: tx succeeded unexpectedly`);
  } catch (e) {
    console.log(
      `✔ expected failure: ${label} :: ${String((e as Error).message).slice(0, 180)}`
    );
  }
}

export async function waitSlots(connection: Connection, n: number) {
  const start = await connection.getSlot("confirmed");
  while ((await connection.getSlot("confirmed")) < start + n) {
    await new Promise((r) => setTimeout(r, 350));
  }
}

export function keypairFromFileMaybe(filePath: string): Keypair | null {
  if (!fs.existsSync(filePath)) return null;
  const arr = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}