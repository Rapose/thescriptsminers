import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export function assertEq<T>(label: string, got: T, expected: T) {
  if (got !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(got)}`);
}

export function assertBnEq(label: string, got: BN, expected: BN) {
  if (!got.eq(expected)) throw new Error(`${label}: expected ${expected.toString()}, got ${got.toString()}`);
}

export function assertPubkeyEq(label: string, got: PublicKey, expected: PublicKey) {
  if (!got.equals(expected)) throw new Error(`${label}: expected ${expected.toBase58()}, got ${got.toBase58()}`);
}

export function assertTrue(label: string, value: boolean) {
  if (!value) throw new Error(`${label}: expected true`);
}

export function assertFalse(label: string, value: boolean) {
  if (value) throw new Error(`${label}: expected false`);
}

export function assertExists<T>(label: string, value: T | null | undefined): T {
  if (value == null) throw new Error(`${label}: expected value to exist`);
  return value;
}

export function assertDefaultPubkey(label: string, value: PublicKey) {
  assertPubkeyEq(label, value, PublicKey.default);
}

export async function expectFailure(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    return String((error as Error)?.message ?? error);
  }
  throw new Error(`${label}: expected failure but transaction succeeded`);
}
