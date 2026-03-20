import * as anchor from "@coral-xyz/anchor";

export function getProvider() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  return provider;
}

export function getProgram() {
  const provider = getProvider();
  const program = anchor.workspace.Miners;
  return { program, provider };
}