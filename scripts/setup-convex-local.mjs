import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultProjectName = "skillflow-convex";
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = resolve(projectRoot, "infra/convex/compose.yml");
const convexCli = resolve(projectRoot, "node_modules/convex/bin/main.js");

function requiredSafeName(name, value) {
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(value)) {
    throw new Error(`${name} must contain only lowercase letters, digits, hyphens, or underscores.`);
  }
  return value;
}

function resolveProjectName() {
  const runId = process.env.SKILLFLOW_LOOP_RUN_ID;
  const explicitProject = process.env.SKILLFLOW_CONVEX_PROJECT;
  const runProject = runId
    ? `skillflow-loop-${requiredSafeName("SKILLFLOW_LOOP_RUN_ID", runId)}`
    : undefined;

  if (runProject && explicitProject && runProject !== explicitProject) {
    throw new Error("SKILLFLOW_CONVEX_PROJECT must match the project derived from SKILLFLOW_LOOP_RUN_ID.");
  }

  return requiredSafeName(
    "SKILLFLOW_CONVEX_PROJECT",
    explicitProject ?? runProject ?? defaultProjectName,
  );
}

function resolvePort(name, fallback) {
  const rawValue = process.env[name] ?? fallback;
  const port = Number(rawValue);
  if (!/^\d+$/.test(rawValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return String(port);
}

function parseHttpOrigin(name, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTP or HTTPS origin.`);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${name} must be an HTTP or HTTPS origin without credentials.`);
  }
  return url.origin;
}

function resolveHttpOrigin(name, fallback) {
  return parseHttpOrigin(name, process.env[name] ?? fallback);
}

const projectName = resolveProjectName();
const runId = process.env.SKILLFLOW_LOOP_RUN_ID;
const owner = process.env.SKILLFLOW_CONVEX_OWNER ?? (runId ? `agent-loop:${runId}` : "developer");
const bindAddress = process.env.CONVEX_BIND_ADDRESS ?? "127.0.0.1";
const backendPort = resolvePort("CONVEX_PORT", "3210");
const sitePort = resolvePort("CONVEX_SITE_PROXY_PORT", "3211");
const dashboardPort = resolvePort("CONVEX_DASHBOARD_PORT", "6791");
const backendOrigin = resolveHttpOrigin(
  "CONVEX_CLOUD_ORIGIN",
  `http://127.0.0.1:${backendPort}`,
);
const siteOrigin = resolveHttpOrigin(
  "CONVEX_SITE_ORIGIN",
  `http://127.0.0.1:${sitePort}`,
);
const healthUrl = `http://127.0.0.1:${backendPort}/version`;
const localEnvironmentFile = projectName === defaultProjectName
  ? resolve(projectRoot, ".env.local")
  : resolve(projectRoot, ".convex", `${projectName}.env`);

function requireExplicitOriginsForLanBinding() {
  if (bindAddress === "127.0.0.1") {
    return;
  }
  if (!process.env.CONVEX_CLOUD_ORIGIN || !process.env.CONVEX_SITE_ORIGIN) {
    throw new Error("Non-loopback binding requires explicit CONVEX_CLOUD_ORIGIN and CONVEX_SITE_ORIGIN.");
  }
}

function dockerEnvironment() {
  return {
    ...process.env,
    CONVEX_CLOUD_ORIGIN: backendOrigin,
    CONVEX_SITE_ORIGIN: siteOrigin,
    SKILLFLOW_CONVEX_OWNER: owner,
    SKILLFLOW_CONVEX_PROJECT: projectName,
  };
}

function runDocker(argumentsList, captureOutput = false) {
  const output = execFileSync(
    "docker",
    ["compose", "--project-name", projectName, "-f", composeFile, ...argumentsList],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: dockerEnvironment(),
      stdio: captureOutput ? ["ignore", "pipe", "inherit"] : "inherit",
    },
  );
  return captureOutput ? output.trim() : "";
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

function readOptionalFile(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function writeLocalEnvironment(adminKey) {
  let contents = readOptionalFile(localEnvironmentFile);
  contents = setEnvironmentValue(contents, "CONVEX_SELF_HOSTED_URL", backendOrigin);
  contents = setEnvironmentValue(contents, "CONVEX_SELF_HOSTED_ADMIN_KEY", adminKey);
  contents = setEnvironmentValue(contents, "EXPO_PUBLIC_CONVEX_URL", backendOrigin);

  mkdirSync(dirname(localEnvironmentFile), { mode: 0o700, recursive: true });
  writeFileSync(localEnvironmentFile, contents, { mode: 0o600 });
  chmodSync(localEnvironmentFile, 0o600);
}

function parseEnvironment(contents) {
  const values = new Map();
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const separator = line.indexOf("=");
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    const doubleQuoted = value.startsWith('"') && value.endsWith('"');
    const singleQuoted = value.startsWith("'") && value.endsWith("'");
    if (doubleQuoted || singleQuoted) {
      value = value.slice(1, -1);
    }
    values.set(name, value);
  }
  return values;
}

function validateSelfHostedEnvironment() {
  const contents = readOptionalFile(localEnvironmentFile);
  if (!contents) {
    throw new Error(`Missing ${relative(projectRoot, localEnvironmentFile)}. Run npm run convex:bootstrap first.`);
  }
  const values = parseEnvironment(contents);
  const url = values.get("CONVEX_SELF_HOSTED_URL");
  const adminKey = values.get("CONVEX_SELF_HOSTED_ADMIN_KEY");
  if (!url || !adminKey) {
    throw new Error("Local Convex configuration is missing its self-hosted URL or admin key.");
  }
  if (values.get("CONVEX_DEPLOYMENT") || values.get("CONVEX_DEPLOY_KEY")) {
    throw new Error("Local Convex configuration contains cloud deployment fields; refusing to run.");
  }
  const normalizedUrl = parseHttpOrigin("CONVEX_SELF_HOSTED_URL", url);
  if (normalizedUrl !== backendOrigin) {
    throw new Error("Local Convex URL does not match the selected project's configured backend origin.");
  }
  return { adminKey, url: normalizedUrl };
}

function bootstrap() {
  startServices();
  const adminKey = runDocker(["exec", "-T", "backend", "./generate_admin_key.sh"], true);
  if (!adminKey) {
    throw new Error("Convex did not return a local admin key.");
  }
  writeLocalEnvironment(adminKey);
  console.log(`Local Convex project ${projectName} is healthy.`);
  console.log(`Configuration: ${relative(projectRoot, localEnvironmentFile)} (mode 0600)`);
  console.log(`Dashboard: http://127.0.0.1:${dashboardPort}`);
  console.log("The admin key was saved without being printed.");
}

async function checkHealth() {
  const response = await fetch(healthUrl);
  if (!response.ok) {
    throw new Error(`Local Convex health check failed with HTTP ${response.status}.`);
  }
  console.log(await response.text());
}

function runConvexDev(argumentsList) {
  const controlledFlags = ["--configure", "--dev-deployment", "--env-file"];
  const forbidden = argumentsList.find((value) => controlledFlags.some(
    (flag) => value === flag || value.startsWith(`${flag}=`),
  ));
  if (forbidden) {
    throw new Error(`${forbidden} is controlled by the self-hosted wrapper and cannot be overridden.`);
  }
  const selfHostedEnvironment = validateSelfHostedEnvironment();
  const environment = {
    ...process.env,
    CI: "1",
    CONVEX_SELF_HOSTED_ADMIN_KEY: selfHostedEnvironment.adminKey,
    CONVEX_SELF_HOSTED_URL: selfHostedEnvironment.url,
    CONVEX_VERSION_API_ORIGIN: selfHostedEnvironment.url,
  };
  delete environment.CONVEX_DEPLOYMENT;
  delete environment.CONVEX_DEPLOY_KEY;
  execFileSync(
    process.execPath,
    [convexCli, "dev", "--env-file", localEnvironmentFile, ...argumentsList],
    { cwd: projectRoot, env: environment, stdio: "inherit" },
  );
}

function startServices() {
  requireExplicitOriginsForLanBinding();
  runDocker(["up", "-d", "--wait"]);
}

async function main() {
  const [action = "bootstrap", ...argumentsList] = process.argv.slice(2);
  if (action === "bootstrap") bootstrap();
  else if (action === "up") startServices();
  else if (action === "down") runDocker(["down"]);
  else if (action === "status") runDocker(["ps"]);
  else if (action === "logs") runDocker(["logs", "--follow", "backend", "dashboard"]);
  else if (action === "health") await checkHealth();
  else if (action === "dev") runConvexDev(argumentsList);
  else throw new Error(`Unknown local Convex action: ${action}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
