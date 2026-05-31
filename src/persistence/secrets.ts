// Replaces src-tauri/src/persistence/keychain.rs. The Tauri app stored API keys
// in the OS keychain; a headless server has no keychain, so we persist them in
// an AES-256-GCM encrypted file inside the data dir. The encryption key is
// derived from a machine secret (ORBIS_SECRET env var, else a random key file
// created with 0600 perms). This keeps keys off plaintext disk while remaining
// dependency-free.
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { AppError } from "../error.ts";

export type SecretAccount =
  | "anthropic-api-key"
  | "openai-api-key"
  | "gemini-api-key"
  | "telegram-bot-token";

export class SecretStore {
  private filePath: string;
  private keyPath: string;
  private cryptoKey: Buffer;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "secrets.enc");
    this.keyPath = path.join(dataDir, ".secret-key");
    this.cryptoKey = this.resolveKey(dataDir);
  }

  private resolveKey(dataDir: string): Buffer {
    const fromEnv = process.env.ORBIS_SECRET;
    if (fromEnv && fromEnv.length > 0) {
      return crypto.createHash("sha256").update(fromEnv).digest();
    }
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(this.keyPath)) {
      return fs.readFileSync(this.keyPath);
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(this.keyPath, key, { mode: 0o600 });
    return key;
  }

  private readAll(): Record<string, string> {
    if (!fs.existsSync(this.filePath)) return {};
    try {
      const raw = fs.readFileSync(this.filePath);
      const iv = raw.subarray(0, 12);
      const tag = raw.subarray(12, 28);
      const data = raw.subarray(28);
      const decipher = crypto.createDecipheriv("aes-256-gcm", this.cryptoKey, iv);
      decipher.setAuthTag(tag);
      const dec = Buffer.concat([decipher.update(data), decipher.final()]);
      return JSON.parse(dec.toString("utf8"));
    } catch {
      // Unreadable (key rotated / corrupt) — treat as empty rather than crash.
      return {};
    }
  }

  private writeAll(map: Record<string, string>): void {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.cryptoKey, iv);
    const enc = Buffer.concat([
      cipher.update(JSON.stringify(map), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    fs.writeFileSync(this.filePath, Buffer.concat([iv, tag, enc]), { mode: 0o600 });
  }

  set(account: SecretAccount, value: string): void {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new AppError("invalid_input", "api key must not be empty");
    }
    const map = this.readAll();
    map[account] = trimmed;
    this.writeAll(map);
  }

  get(account: SecretAccount): string | null {
    const map = this.readAll();
    return map[account] ?? null;
  }

  has(account: SecretAccount): boolean {
    return this.get(account) !== null;
  }

  clear(account: SecretAccount): void {
    const map = this.readAll();
    if (account in map) {
      delete map[account];
      this.writeAll(map);
    }
  }
}
