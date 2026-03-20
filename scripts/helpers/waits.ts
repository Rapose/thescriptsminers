import { Connection } from "@solana/web3.js";

export function sleepMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitSlots(connection: Connection, slots: number) {
  const start = await connection.getSlot("confirmed");
  while ((await connection.getSlot("confirmed")) < start + slots) {
    await sleepMs(350);
  }
}

export async function waitUntilTimestamp(targetUnixSec: number) {
  while (Math.floor(Date.now() / 1000) < targetUnixSec) {
    await sleepMs(500);
  }
}

export async function waitForExpeditionUnlock(connection: Connection, endsAtUnixSec: number) {
  await waitUntilTimestamp(endsAtUnixSec + 1);
  await connection.getLatestBlockhash("confirmed");
}
