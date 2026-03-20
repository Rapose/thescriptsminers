export type CliArgs = {
  miner?: string;
  land?: string;
  equipment?: string;
  seller?: string;
  buyer?: string;
  tier?: string;
  purchaseId?: string;
  lootboxId?: string;
  price?: string;
  [k: string]: string | undefined;
};

export function parseCliArgs(argv = process.argv.slice(2)): CliArgs {
  const out: CliArgs = {};
  for (const token of argv) {
    if (!token.startsWith("--")) continue;
    const [k, ...v] = token.slice(2).split("=");
    out[k] = v.length ? v.join("=") : "true";
  }
  return out;
}

export function requireArg(args: CliArgs, key: keyof CliArgs): string {
  const value = args[key];
  if (!value) throw new Error(`Missing required arg --${String(key)}=...`);
  return value;
}
