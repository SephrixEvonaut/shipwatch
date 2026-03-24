#!/usr/bin/env node
// ============================================================================
// PREFLIGHT CHECK — runs before every app launch
// Ensures: node_modules exist, TypeScript is compiled, dist/ is fresh
// Also warns about: stale lock file, missing tsc, Teensy absent, git dirt
// ============================================================================

import { existsSync, statSync, readdirSync } from "fs";
import { execSync, execFileSync } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

let needsBuild = false;
let issues = [];

// ── 1. node_modules present ──────────────────────────────────────────────────
if (!existsSync(join(ROOT, "node_modules"))) {
  console.log("📦 node_modules missing — running npm install...");
  execSync("npm install", { cwd: ROOT, stdio: "inherit" });
}

// ── 2. package-lock.json vs node_modules staleness ───────────────────────────
{
  const lockPath = join(ROOT, "package-lock.json");
  const nmPath = join(ROOT, "node_modules");
  if (existsSync(lockPath) && existsSync(nmPath)) {
    const lockMtime = statSync(lockPath).mtimeMs;
    const nmMtime = statSync(nmPath).mtimeMs;
    if (lockMtime > nmMtime) {
      console.log(
        "📦 package-lock.json is newer than node_modules — running npm install...",
      );
      execSync("npm install", { cwd: ROOT, stdio: "inherit" });
    }
  }
}

// ── 3. TypeScript compiler availability ──────────────────────────────────────
{
  const tscLocal = join(ROOT, "node_modules", ".bin", "tsc");
  if (!existsSync(tscLocal)) {
    console.warn(
      "⚠️  TypeScript compiler (tsc) not found in node_modules/.bin/",
    );
    console.warn("    Run: npm install   to restore dev dependencies");
  }
}

// ── 4. dist/ present and complete ────────────────────────────────────────────
if (
  !existsSync(join(ROOT, "dist")) ||
  !existsSync(join(ROOT, "dist", "index.js"))
) {
  issues.push("dist/ missing or incomplete");
  needsBuild = true;
}

// ── 5. src/*.ts newer than dist/*.js ─────────────────────────────────────────
if (!needsBuild) {
  const srcDir = join(ROOT, "src");
  const distDir = join(ROOT, "dist");

  try {
    const srcFiles = readdirSync(srcDir).filter((f) => f.endsWith(".ts"));
    for (const tsFile of srcFiles) {
      const jsFile = tsFile.replace(/\.ts$/, ".js");
      const srcPath = join(srcDir, tsFile);
      const distPath = join(distDir, jsFile);

      if (!existsSync(distPath)) {
        issues.push(`dist/${jsFile} missing (src/${tsFile} exists)`);
        needsBuild = true;
        break;
      }

      const srcMtime = statSync(srcPath).mtimeMs;
      const distMtime = statSync(distPath).mtimeMs;

      if (srcMtime > distMtime) {
        issues.push(`src/${tsFile} is newer than dist/${jsFile}`);
        needsBuild = true;
        break;
      }
    }
  } catch {
    issues.push("Could not compare src/dist timestamps");
    needsBuild = true;
  }
}

// ── 6. Build if needed ────────────────────────────────────────────────────────
if (needsBuild) {
  console.log(`🔨 Rebuilding: ${issues.join(", ")}`);
  execSync("npx tsc", { cwd: ROOT, stdio: "inherit" });
  console.log("✅ Build complete");
} else {
  console.log("✅ Preflight OK — dist/ is up to date");
}

// ── 7. Teensy serial port availability (warn only, never block) ───────────────
try {
  // Dynamically import serialport so this check is skipped if the module is absent
  const { SerialPort } = await import("serialport");
  const ports = await SerialPort.list();
  const teensyPort = ports.find(
    (p) =>
      p.vendorId?.toLowerCase() === "16c0" ||
      p.manufacturer?.toLowerCase().includes("teensy") ||
      p.manufacturer?.toLowerCase().includes("pjrc"),
  );

  if (teensyPort) {
    console.log(`✅ Teensy detected at ${teensyPort.path}`);
  } else {
    if (ports.length === 0) {
      console.warn(
        "⚠️  No serial ports found — Teensy not connected (software mode will be used if --backend not set)",
      );
    } else {
      const portList = ports.map((p) => p.path).join(", ");
      console.warn(
        `⚠️  Teensy NOT detected on any port [${portList}] — software fallback active`,
      );
    }
  }
} catch {
  // serialport module not available or failed — skip silently
}

// ── 8. Git dirty-state warning ────────────────────────────────────────────────
try {
  const dirty = execFileSync("git", ["status", "--porcelain"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();

  if (dirty) {
    const lineCount = dirty.split("\n").length;
    console.warn(
      `⚠️  Git: ${lineCount} uncommitted change(s) — consider committing before a session`,
    );
  }
} catch {
  // git not available or not a git repo — skip silently
}
