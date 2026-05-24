import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto"

const KEY_LENGTH = 32
const SCRYPT_COST = 16384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1

function deriveKeyWithScrypt(secret: string, salt: Buffer) {
  return scryptSync(secret, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  })
}

function deriveKeyLegacy(secret: string) {
  return createHash("sha256").update(secret).digest()
}

function requireSecret() {
  const secret =
    process.env.VIBEGUARD_SECRET?.trim() ??
    process.env.CONTENT_FOUNDATION_SECRET?.trim()

  if (!secret) {
    throw new Error(
      "VIBEGUARD_SECRET is required to encrypt or decrypt provider credentials.",
    )
  }

  return secret
}

export function encryptSecret(plaintext: string) {
  const secret = requireSecret()
  const salt = randomBytes(16)
  const key = deriveKeyWithScrypt(secret, salt)
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    salt.toString("base64"),
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".")
}

export function decryptSecret(ciphertext: string) {
  const parts = ciphertext.split(".")

  // 新格式密文：salt.iv.tag.encrypted（共 4 段，使用 scrypt 派生密钥）
  if (parts.length === 4) {
    const [salt, iv, tag, encrypted] = parts

    if (!salt || !iv || !tag || !encrypted) {
      return ""
    }

    try {
      const secret = requireSecret()
      const key = deriveKeyWithScrypt(secret, Buffer.from(salt, "base64"))
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(iv, "base64"),
      )
      decipher.setAuthTag(Buffer.from(tag, "base64"))

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64")),
        decipher.final(),
      ])

      return decrypted.toString("utf8")
    } catch (error) {
      console.warn("Decryption failed (scrypt):", error instanceof Error ? error.message : String(error))
      return ""
    }
  }

  // 旧格式密文：iv.tag.encrypted（共 3 段，使用 SHA-256 派生密钥，仅用于向后兼容）
  if (parts.length === 3) {
    const [iv, tag, encrypted] = parts

    if (!iv || !tag || !encrypted) {
      return ""
    }

    try {
      const secret = requireSecret()
      const key = deriveKeyLegacy(secret)
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(iv, "base64"),
      )
      decipher.setAuthTag(Buffer.from(tag, "base64"))

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64")),
        decipher.final(),
      ])

      return decrypted.toString("utf8")
    } catch (error) {
      console.warn("Decryption failed (legacy):", error instanceof Error ? error.message : String(error))
      return ""
    }
  }

  return ""
}
