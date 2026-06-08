// Sandboxed execution of organism-built tools via macOS `sandbox-exec`.
//
// The profile denies network access and confines writes to the instance
// directory (plus the system temp dirs). A timeout kills runaway scripts. If
// `sandbox-exec` is unavailable the executor refuses to run — it never falls
// back to unsandboxed execution.

import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

import { AppError } from "../../error.ts";

const SANDBOX_EXEC = "/usr/bin/sandbox-exec";
const TIMEOUT_SECS = 30;
const MAX_CAPTURE = 8000;

/**
 * Phase 12 — network policy for sandboxed tools.
 *
 * `off` keeps `(deny network*)` — the original behaviour. `gated` keeps the
 * deny but selectively opens TCP 80/443 to allowlisted hosts (plus DNS).
 * `open` removes the deny entirely; every kind of network call is allowed.
 */
export type NetworkAccess = "off" | "gated" | "open";

export function parseNetworkAccess(s: string): NetworkAccess {
  switch (s.trim().toLowerCase()) {
    case "gated":
      return "gated";
    case "open":
      return "open";
    default:
      return "off";
  }
}

export interface ToolRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Run `scriptRelpath` (relative to `instanceDir`) under a sandbox-exec jail.
 *
 * `network` and `allowlist` select Phase-12's network policy. With `off`
 * (default) all network is denied. With `gated`, only the allowlisted hosts
 * are reachable on TCP 80/443. With `open`, no network deny — the tool can
 * reach anywhere.
 */
export async function runSandboxed(
  instanceDir: string,
  scriptRelpath: string,
  network: NetworkAccess,
  allowlist: string[],
): Promise<ToolRunResult> {
  if (!fs.existsSync(SANDBOX_EXEC)) {
    throw new AppError(
      "internal",
      "sandbox-exec is not available on this system — refusing to run a tool unsandboxed",
    );
  }

  const script = path.join(instanceDir, scriptRelpath);
  let isFile = false;
  try {
    isFile = fs.statSync(script).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) {
    throw new AppError("not_found", `tool not found: ${scriptRelpath}`);
  }

  const profile = buildProfile(instanceDir, network, allowlist);

  // Honor the script's shebang: if it has one, make it executable and run it
  // directly so the OS picks the right interpreter (python3, ruby, sh, …).
  // Without a shebang, fall back to /bin/sh.
  let hasShebang = false;
  try {
    const content = fs.readFileSync(script, "utf8");
    const firstLine = content.split("\n", 1)[0] ?? "";
    hasShebang = firstLine.startsWith("#!");
  } catch {
    hasShebang = false;
  }

  const args: string[] = ["-p", profile];
  if (hasShebang) {
    makeExecutable(script);
    args.push(script);
  } else {
    args.push("/bin/sh", script);
  }

  return await new Promise<ToolRunResult>((resolve, reject) => {
    // `detached: true` makes the child its own process-group leader (pgid ===
    // child.pid). That lets the timeout kill the WHOLE tree — sandbox-exec, the
    // shell it spawns, and any grandchildren — via a single group signal.
    // Killing only `child` (the sandbox-exec parent) would orphan the shell,
    // which then keeps running past the timeout. The own group is also what
    // makes the negative-pid kill safe: it can never reach the server's group.
    const child = spawn(SANDBOX_EXEC, args, {
      cwd: instanceDir,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
      if (!settled) {
        settled = true;
        resolve({
          exitCode: null,
          stdout: "",
          stderr: `tool execution timed out after ${TIMEOUT_SECS}s`,
          timedOut: true,
        });
      }
    }, TIMEOUT_SECS * 1000);

    child.stdout?.on("data", (d: Buffer) => stdoutChunks.push(d));
    child.stderr?.on("data", (d: Buffer) => stderrChunks.push(d));

    child.on("error", (e) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(new AppError("internal", `tool spawn failed: ${e.message}`));
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return; // already resolved via timeout
      settled = true;
      resolve({
        exitCode: code,
        stdout: cap(Buffer.concat(stdoutChunks)),
        stderr: cap(Buffer.concat(stderrChunks)),
        timedOut,
      });
    });
  });
}

/** Cap captured output at MAX_CAPTURE bytes (byte-accurate). */
function cap(buf: Buffer): string {
  if (buf.length <= MAX_CAPTURE) {
    return buf.toString("utf8");
  }
  return `${buf.subarray(0, MAX_CAPTURE).toString("utf8")}…[truncated]`;
}

/**
 * Build the SBPL profile for the chosen network policy. Later rules win in
 * SBPL, so the broad `deny network*` precedes the narrow allowlist `allow`s.
 */
function buildProfile(
  instanceStr: string,
  network: NetworkAccess,
  allowlist: string[],
): string {
  const lines: string[] = ["(version 1)", "(allow default)"];
  switch (network) {
    case "off":
      lines.push("(deny network*)");
      break;
    case "gated":
      lines.push("(deny network*)");
      // DNS — let the resolver work for the allowed hosts.
      lines.push('(allow network-outbound (remote tcp "*:53"))');
      lines.push('(allow network-outbound (remote udp "*:53"))');
      // macOS sandbox-exec rejects hostname-scoped rules. So when the operator
      // configured at least one allowlisted host, we open TCP 80/443 to ANY
      // host — the allowlist remains as declared intent but is not
      // kernel-enforced.
      if (allowlist.some((h) => h.trim().length !== 0)) {
        lines.push('(allow network-outbound (remote tcp "*:443"))');
        lines.push('(allow network-outbound (remote tcp "*:80"))');
      }
      break;
    case "open":
      // No deny — every kind of network call is allowed.
      break;
  }
  lines.push("(deny file-write*)");
  lines.push(`(allow file-write* (subpath "${instanceStr}"))`);
  lines.push('(allow file-write* (subpath "/private/tmp"))');
  lines.push('(allow file-write* (subpath "/private/var/tmp"))');
  lines.push('(allow file-write* (subpath "/dev"))');
  return lines.join("\n");
}

/**
 * SIGKILL the child's entire process group, so a timed-out tool can't leave
 * orphaned grandchildren (the shell, curl, …) running past the timeout. The
 * child was spawned `detached`, so its pgid equals its pid and the negative-pid
 * signal stays scoped to that group — never the server's. Falls back to a plain
 * child kill if the group send fails (e.g. the group is already gone).
 */
function killTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid === undefined) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // Group already reaped, or no permission — best-effort fall back.
    try {
      child.kill("SIGKILL");
    } catch {
      // nothing left to kill
    }
  }
}

/** Add the executable bit so a shebang script can be run directly. */
function makeExecutable(p: string): void {
  let mode: number;
  try {
    mode = fs.statSync(p).mode;
  } catch (e: any) {
    throw new AppError("internal", `stat tool: ${e?.message ?? e}`);
  }
  try {
    fs.chmodSync(p, mode | 0o755);
  } catch (e: any) {
    throw new AppError("internal", `chmod tool: ${e?.message ?? e}`);
  }
}
