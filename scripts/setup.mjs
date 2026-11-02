// Creates .env.local with fresh secrets the first time the app runs.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const target = ".env.local";
if (existsSync(target)) process.exit(0);

const fill = {
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  CRON_SECRET: randomBytes(24).toString("hex"),
};

const lines = readFileSync(".env.example", "utf8")
  .split("\n")
  .map((line) => {
    const m = line.match(/^([A-Z_]+)=$/);
    return m && fill[m[1]] ? `${m[1]}=${fill[m[1]]}` : line;
  });

writeFileSync(target, lines.join("\n"));
console.log("Created .env.local with new secrets.");
