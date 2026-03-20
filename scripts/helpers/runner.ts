import { execSync } from "node:child_process";

export function runScript(path: string, extraEnv: Record<string, string> = {}) {
  execSync(`npx ts-node ${path}`, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

export function runSequence(paths: string[], extraEnv: Record<string, string> = {}) {
  for (const path of paths) {
    runScript(path, extraEnv);
  }
}

export async function runSteps(steps: Array<() => Promise<void>>) {
  for (const step of steps) {
    await step();
  }
}
