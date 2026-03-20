import { PublicKey } from "@solana/web3.js";
import { rebirthCtx, resolveParents, pdas, fetchers, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID, SystemProgram, expectFailure, printJson, printSuccess, printWarn } from "./_common";

async function main() {
  const { env, args } = rebirthCtx("52-rebirth-failures");
  const rebirthConfig = pdas.rebirthConfig(env.programId);
  const d = await resolveParents(env, args);
  const rCfg: any = await fetchers.fetchRebirthConfig(env.program, rebirthConfig);
  const payer = (env.wallet as any).payer;
  const ownerAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, rCfg.essMint, d.owner)).address;
  const recipientAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, rCfg.essMint, rCfg.recipientWallet)).address;

  const baseAccounts = {
    owner: d.owner,
    config: d.config,
    rebirthConfig,
    parentAState: d.parentA,
    parentBState: d.parentB,
    parentAProgress: d.parentAProgress,
    parentBProgress: d.parentBProgress,
    childState: d.child,
    childProgress: d.childProgress,
    essMint: rCfg.essMint,
    ownerAta,
    recipientAta,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };

  const sameParentErr = await expectFailure("same parent", async () => {
    await env.program.methods.rebirthMiner().accounts({ ...baseAccounts, parentBState: d.parentA, parentBProgress: d.parentAProgress }).rpc();
  });

  const lowLevelTx = await env.program.methods.rebirthUpdateConfig(Number(rCfg.burnBps), Number(rCfg.treasuryBps), true, [999, 999, 999, 999, 999], rCfg.essCostByRarity).accounts({
    admin: d.owner,
    essMint: rCfg.essMint,
    recipientWallet: rCfg.recipientWallet,
    rebirthConfig,
  }).rpc();

  const lowLevelErr = await expectFailure("low level", async () => {
    await env.program.methods.rebirthMiner().accounts(baseAccounts).rpc();
  });

  const noEssTx = await env.program.methods.rebirthUpdateConfig(Number(rCfg.burnBps), Number(rCfg.treasuryBps), true, [0, 0, 0, 0, 0], [10_000_000_000, 10_000_000_000, 10_000_000_000, 10_000_000_000, 10_000_000_000]).accounts({
    admin: d.owner,
    essMint: rCfg.essMint,
    recipientWallet: rCfg.recipientWallet,
    rebirthConfig,
  }).rpc();

  const noEssErr = await expectFailure("insufficient ESS", async () => {
    await env.program.methods.rebirthMiner().accounts(baseAccounts).rpc();
  });

  printJson("errors", { sameParentErr, lowLevelErr, noEssErr });
  printJson("configTx", { lowLevelTx, noEssTx });
  printWarn("Falhas cobertas conforme travas explícitas do handler. Cenário 'parent listed' exige preparar listing antes.");
  printSuccess("rebirth failures validados");
}

main().catch((e) => { console.error(e); process.exit(1); });
