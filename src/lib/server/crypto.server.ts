import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
} from "node:crypto";

function keyMaterial(): Buffer {
  const envKey = process.env.WEBHOOK_ENCRYPTION_KEY?.trim();
  const secret = envKey || "loadstring-preview-webhook-key";
  return scryptSync(secret, "loadstring.lua.webhooks", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB, tagB, dataB] = payload.split(".");
  if (!ivB || !tagB || !dataB) throw new Error("Malformed secret");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyMaterial(),
    Buffer.from(ivB, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB, "base64url")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function generateWebhookSecret(): string {
  return `ls_${randomBytes(24).toString("base64url")}`;
}

export function hmacSha256(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function secretSuffix(secret: string): string {
  return secret.slice(-4);
}
