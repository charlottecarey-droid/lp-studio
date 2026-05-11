import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, stat, readFile } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [
      path.resolve(artifactDir, "src/index.ts"),
      // Built as a separate bundle so it can be loaded via Node's --import
      // flag BEFORE the main bundle. See src/instrument.ts for why.
      path.resolve(artifactDir, "src/instrument.ts"),
    ],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "geoip-lite",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "@sentry/*",
      "@opentelemetry/*",
      "import-in-the-middle",
      "require-in-the-middle",
      // Sentry's node SDK hooks Node's module loader to instrument these
      // libraries automatically. Bundling them defeats that — the hooks
      // never see them get loaded. Keep them external so the runtime
      // import order (initSentry → import server) is what's enforced.
      "express",
      "http",
      "https",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

/**
 * Regression guard for task #189.
 *
 * The production deployment is launched by the args declared in
 * `.replit-artifact/artifact.toml` → `[services.production.run]`, NOT by
 * `package.json`'s `start` script. The two have drifted out of sync once
 * already: prod shipped without `--import dist/instrument.mjs`, which meant
 * Sentry's express auto-instrumentation never registered (it has to hook
 * Node's module loader BEFORE `express` is imported — see
 * `src/instrument.ts`). That kind of silent contract drift is exactly what
 * we want the build to catch.
 *
 * This check fails the build if either:
 *   1. esbuild didn't actually emit both required entrypoints, or
 *   2. the prod run command in artifact.toml doesn't `--import` the
 *      instrument bundle ahead of the main entrypoint.
 *
 * Intentionally string-based on the TOML — pulling in a TOML parser as a
 * build-time dep just to assert two substrings would be overkill, and the
 * substrings we look for are unambiguous.
 */
async function assertProductionEntrypointsWired(distDir) {
  const indexPath = path.join(distDir, "index.mjs");
  const instrumentPath = path.join(distDir, "instrument.mjs");
  for (const p of [indexPath, instrumentPath]) {
    try {
      const st = await stat(p);
      if (!st.isFile()) throw new Error("not a file");
    } catch (err) {
      throw new Error(
        `Build output missing required entrypoint: ${p} (${err.message}). ` +
          `Both dist/index.mjs and dist/instrument.mjs must be emitted — ` +
          `the prod runner --imports instrument.mjs before index.mjs.`,
      );
    }
  }

  const tomlPath = path.resolve(
    artifactDir,
    ".replit-artifact",
    "artifact.toml",
  );
  let toml;
  try {
    toml = await readFile(tomlPath, "utf8");
  } catch (err) {
    throw new Error(
      `Could not read ${tomlPath} to validate prod run args: ${err.message}`,
    );
  }

  const runSectionMatch = toml.match(
    /\[services\.production\.run\][\s\S]*?(?=\n\[|$)/,
  );
  if (!runSectionMatch) {
    throw new Error(
      `artifact.toml is missing [services.production.run] — production has no run command.`,
    );
  }
  const runSection = runSectionMatch[0];

  const hasImportFlag = /"--import"/.test(runSection);
  const hasInstrumentRef = /instrument\.mjs/.test(runSection);
  const hasIndexRef = /index\.mjs/.test(runSection);
  if (!hasImportFlag || !hasInstrumentRef || !hasIndexRef) {
    throw new Error(
      `artifact.toml [services.production.run].args must launch with ` +
        `\`--import .../dist/instrument.mjs\` before \`.../dist/index.mjs\`. ` +
        `Without it Sentry's express auto-instrumentation never registers ` +
        `in production (see src/instrument.ts and task #189). Current args:\n` +
        runSection,
    );
  }
  // Ordering: --import + instrument.mjs must come before index.mjs.
  const instrumentIdx = runSection.indexOf("instrument.mjs");
  const indexIdx = runSection.indexOf("index.mjs");
  if (instrumentIdx === -1 || indexIdx === -1 || instrumentIdx > indexIdx) {
    throw new Error(
      `artifact.toml [services.production.run].args must reference ` +
        `instrument.mjs BEFORE index.mjs (Sentry must hook the module ` +
        `loader before express is imported). Current args:\n${runSection}`,
    );
  }
}

/**
 * Regression guard for task #195.
 *
 * Task #190 added a 5-minute Sentry heartbeat (see
 * `src/lib/sentryHeartbeat.ts`) that the prod "no events for N hours"
 * Sentry alert depends on. If a future refactor of `server.ts` accidentally
 * drops the `startSentryHeartbeat()` call (the same class of regression
 * #189 caught for `initSentry()`), the alarm goes blind silently — Sentry
 * just stops receiving heartbeats and the alert can no longer distinguish
 * "no errors" from "ingestion broken".
 *
 * Source-level check on purpose: the heartbeat must be wired up at
 * application boot (top-level call in `server.ts`), not buried inside a
 * route handler or feature flag, so a substring match on the source is
 * exactly the contract we want to enforce.
 */
async function assertSentryHeartbeatWired() {
  const serverPath = path.resolve(artifactDir, "src", "server.ts");
  let src;
  try {
    src = await readFile(serverPath, "utf8");
  } catch (err) {
    throw new Error(
      `Could not read ${serverPath} to validate Sentry heartbeat wiring: ${err.message}`,
    );
  }
  const hasImport = /from\s+["']\.\/lib\/sentryHeartbeat["']/.test(src);
  const hasCall = /startSentryHeartbeat\s*\(/.test(src);
  if (!hasImport || !hasCall) {
    throw new Error(
      `src/server.ts must import and call startSentryHeartbeat() at boot ` +
        `(task #195). Without it the prod Sentry "no events" alert (see ` +
        `src/lib/SENTRY_PROD_ALERT_VERIFICATION.md) goes blind. ` +
        `Detected: import=${hasImport}, call=${hasCall}.`,
    );
  }
}

buildAll()
  .then(() => assertProductionEntrypointsWired(path.resolve(artifactDir, "dist")))
  .then(() => assertSentryHeartbeatWired())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
