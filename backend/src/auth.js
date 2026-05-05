import crypto from "node:crypto";

const SECRET = "storebuddy-local-secret";

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function createToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
}

export function verifyToken(token) {
  if (!token) {
    return null;
  }

  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(body)
    .digest("base64url");

  if (expected !== signature) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
