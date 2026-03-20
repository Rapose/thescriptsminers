import { printHeader, printSuccess } from "../helpers/log";
import { runScript } from "../helpers/runner";

export function runSuite(title: string, scripts: string[]) {
  printHeader(title);
  scripts.forEach((script, idx) => {
    console.log(`▶️  [${idx + 1}/${scripts.length}] START ${script}`);
    runScript(script);
    console.log(`✅ [${idx + 1}/${scripts.length}] DONE  ${script}`);
  });
  printSuccess(`${title} concluída`);
}
