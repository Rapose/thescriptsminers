import * as anchor from "@coral-xyz/anchor";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

export async function airdropIfNeeded(provider: anchor.AnchorProvider, wallet: PublicKey, minLamports = 2 * LAMPORTS_PER_SOL) {
  const bal = await provider.connection.getBalance(wallet, "confirmed");
  if (bal >= minLamports) return;
  const amount = minLamports - bal + LAMPORTS_PER_SOL;
  const sig = await provider.connection.requestAirdrop(wallet, amount);
  const latest = await provider.connection.getLatestBlockhash("confirmed");
  await provider.connection.confirmTransaction({ signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, "confirmed");
}

export async function fundIfNeeded(provider: anchor.AnchorProvider, destination: PublicKey, minLamports = 2 * LAMPORTS_PER_SOL) {
  const bal = await provider.connection.getBalance(destination, "confirmed");
  if (bal >= minLamports) return;
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: provider.wallet.publicKey,
      toPubkey: destination,
      lamports: minLamports - bal,
    })
  );
  await provider.sendAndConfirm(tx, []);
}

export function loadOrCreateKeypair(cache: Map<string, Keypair>, label: string): Keypair {
  if (!cache.has(label)) cache.set(label, Keypair.generate());
  return cache.get(label)!;
}

export async function ensureAta(connection: anchor.web3.Connection, payer: Keypair, mint: PublicKey, owner: PublicKey) {
  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, owner);
  return ata.address;
}
