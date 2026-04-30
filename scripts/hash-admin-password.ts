import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

// scrypt parameters (same as Node defaults but pinned explicitly).
const N = 1 << 15; // 32768
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

async function readPassword(): Promise<string> {
  const fromArg = process.argv[2];
  if (fromArg) {
    return fromArg;
  }
  const rl = createInterface({ input: stdin, output: stdout });
  const password = await rl.question("Enter admin password: ");
  rl.close();
  return password;
}

async function main() {
  const password = await readPassword();
  if (!password || password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_LENGTH, { N, r: R, p: P });
  const hash = `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${key.toString("hex")}`;

  console.log("\nAdd this to your .env / secrets manager as ADMIN_PASSWORD_HASH:");
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
