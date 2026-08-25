import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = resolve(projectRoot, "infra/convex/compose.yml");
const localEnvironmentFile = resolve(projectRoot, ".env.local");

function runDocker(argumentsList) {
  return execFileSync("docker", ["compose", "-f", composeFile, ...argumentsList], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function setEnvironmentValue(contents, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");

  if (pattern.test(contents)) {
    return contents.replace(pattern, line);
  }

  const separator = contents.length === 0 || contents.endsWith("\n") ? "" : "\n";
  return `${contents}${separator}${line}\n`;
}

runDocker(["up", "-d", "--wait"]);

const adminKey = runDocker(["exec", "-T", "backend", "./generate_admin_key.sh"]);
if (!adminKey) {
  throw new Error("Convex did not return a local admin key.");
}

let environmentContents = "";
try {
  environmentContents = readFileSync(localEnvironmentFile, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}

environmentContents = setEnvironmentValue(
  environmentContents,
  "CONVEX_SELF_HOSTED_URL",
  "http://127.0.0.1:3210",
);
environmentContents = setEnvironmentValue(
  environmentContents,
  "CONVEX_SELF_HOSTED_ADMIN_KEY",
  adminKey,
);
environmentContents = setEnvironmentValue(
  environmentContents,
  "EXPO_PUBLIC_CONVEX_URL",
  "http://127.0.0.1:3210",
);

writeFileSync(localEnvironmentFile, environmentContents, { mode: 0o600 });
chmodSync(localEnvironmentFile, 0o600);

console.log("Local Convex is healthy and .env.local is configured.");
console.log("Dashboard: http://127.0.0.1:6791");
console.log("The admin key was saved without being printed.");
console.log("For Android, replace EXPO_PUBLIC_CONVEX_URL as described in README.md.");
