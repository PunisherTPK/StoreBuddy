import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET =
  process.env.JWT_SECRET ||
  "StoreBuddy_2026_SuperSecure_Key_9f7a2b8d!";



/**
 * Hash a password before storing it.
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

/**
 * Compare a plain password with its hash.
 */
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT
 */
export function createToken(payload) {
  return jwt.sign(payload, SECRET, {
    expiresIn: "8h",
    issuer: "StoreBuddy"
  });
}

/**
 * Verify JWT
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}