export function printHeader(title: string) {
  console.log(`\n================ ${title} ================`);
}

export function printSection(section: string) {
  console.log(`\n--- ${section} ---`);
}

export function printJson(label: string, data: unknown) {
  console.log(`${label}:`, JSON.stringify(data, null, 2));
}

export function printTx(label: string, signature: string) {
  console.log(`${label} tx: ${signature}`);
}

export function printSuccess(message: string) {
  console.log(`✅ ${message}`);
}

export function printWarn(message: string) {
  console.warn(`⚠️ ${message}`);
}

export function printFailure(message: string) {
  console.error(`❌ ${message}`);
}
