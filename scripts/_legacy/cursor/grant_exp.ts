import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";

const SEED_CONFIG = Buffer.from("config");
const SEED_PROGRESSION = Buffer.from("progression_v1");
const SEED_MINER_PROGRESS = Buffer.from("miner_progress_v1");

const MINER_STATE = new PublicKey("7brrw7dvRxgQEayasv4rN1TdEukXGbnH9ankyA4ELA6z");
const EXPECTED_MINER_PROGRESS = new PublicKey("EHaGU3rjAPy45apXsL5d9JquR2Era87uUt16bkDgetMX");

// troque aqui a quantidade de XP que quer dar
const XP_TO_GRANT = new anchor.BN(1000);

function resolveIdlPath(): string {
  const candidates = [
    path.resolve("target/idl/moe_anchor_v1.json"),
    path.resolve("target/idl/miners.json"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error("IDL não encontrado. Rode `anchor build` primeiro.");
}

function loadProgram(provider: anchor.AnchorProvider) {
  const idlPath = resolveIdlPath();
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  return new anchor.Program(idl, provider) as anchor.Program;
}

function getAccountClient(program: any, names: string[]) {
  for (const n of names) {
    if (program.account?.[n]) return program.account[n];
  }
  throw new Error(`Account client não encontrado. Tentados: ${names.join(", ")}`);
}

async function main() {
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
const wallet = new anchor.Wallet(
  anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync("/mnt/c/Users/Rapose/miners-of-essence/miners/minha-wallet.json", "utf8")))
  )
);

const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});
anchor.setProvider(provider);
  anchor.setProvider(provider);

  const program = loadProgram(provider);
  const admin = provider.wallet.publicKey;

  const [configPda] = PublicKey.findProgramAddressSync(
    [SEED_CONFIG],
    program.programId
  );

  const [progressionPda] = PublicKey.findProgramAddressSync(
    [SEED_PROGRESSION],
    program.programId
  );

  const [minerProgressPda] = PublicKey.findProgramAddressSync(
    [SEED_MINER_PROGRESS, MINER_STATE.toBuffer()],
    program.programId
  );

  console.log("\n=== GRANT XP TO SPECIFIC MINER ===");
  console.log("programId           :", program.programId.toBase58());
  console.log("admin               :", admin.toBase58());
  console.log("configPda           :", configPda.toBase58());
  console.log("progressionPda      :", progressionPda.toBase58());
  console.log("minerState          :", MINER_STATE.toBase58());
  console.log("minerProgress deriv :", minerProgressPda.toBase58());
  console.log("minerProgress esperado:", EXPECTED_MINER_PROGRESS.toBase58());

  if (!minerProgressPda.equals(EXPECTED_MINER_PROGRESS)) {
    throw new Error(
      `O PDA derivado do miner_progress não bate com o esperado.
Derivado: ${minerProgressPda.toBase58()}
Esperado: ${EXPECTED_MINER_PROGRESS.toBase58()}
Verifique se o programId atual é o mesmo do reveal usado nesse miner.`
    );
  }

  const minerProgressAccount = getAccountClient(program, ["minerProgress"]);

  const before: any = await minerProgressAccount.fetch(minerProgressPda);

  console.log("\n--- BEFORE ---");
  console.log({
    miner: before.miner?.toBase58?.() ?? String(before.miner),
    owner: before.owner?.toBase58?.() ?? String(before.owner),
    level: Number(before.level),
    exp: Number(before.exp),
    bump: Number(before.bump),
    xpToGrant: XP_TO_GRANT.toString(),
  });

  const tx = await program.methods
    .adminGrantExp(XP_TO_GRANT)
    .accounts({
      admin,
      config: configPda,
      progression: progressionPda,
      minerState: MINER_STATE,
      minerProgress: minerProgressPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("\nTX:", tx);

  const after: any = await minerProgressAccount.fetch(minerProgressPda);

  console.log("\n--- AFTER ---");
  console.log({
    miner: after.miner?.toBase58?.() ?? String(after.miner),
    owner: after.owner?.toBase58?.() ?? String(after.owner),
    level: Number(after.level),
    exp: Number(after.exp),
    bump: Number(after.bump),
  });

  console.log("\n✅ XP enviado com sucesso.");
}

main().catch((e) => {
  console.error("\nFATAL grant_xp_specific_miner:", e);
  process.exit(1);
});