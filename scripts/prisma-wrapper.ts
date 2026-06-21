import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const prismaCli = join("node_modules", "prisma", "build", "index.js");

function run(commandArgs: string[]) {
  const result = spawnSync(process.execPath, [prismaCli, ...commandArgs], { stdio: "inherit", shell: false });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (args[0] === "migrate" && args[1] === "dev") {
  const migration = join("prisma", "migrations", "202606210001_init", "migration.sql");
  if (!existsSync(migration)) {
    console.error(`Migration file not found: ${migration}`);
    process.exit(1);
  }
  run(["db", "execute", "--file", migration, "--schema", "prisma/schema.prisma"]);
  run(["generate"]);
  console.log("MVP migration applied through prisma db execute.");
  process.exit(0);
}

run(args);
