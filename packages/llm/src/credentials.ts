import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

function getEncryptionKey() {
  const secret = process.env.CONTENT_FOUNDATION_SECRET?.trim()

  if (!secret) {
    throw new Error(
      "CONTENT_FOUNDATION_SECRET is required to encrypt or decrypt provider credentials.",
    )
  }

  return createHash("sha256").update(secret).digest()
}

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".")
}

export function decryptSecret(ciphertext: string) {
  const [iv, tag, encrypted] = ciphertext.split(".")

  if (!iv || !tag || !encrypted) {
    return ""
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(iv, "base64"),
    )
    decipher.setAuthTag(Buffer.from(tag, "base64"))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64")),
      decipher.final(),
    ])

    return decrypted.toString("utf8")
  } catch {
    return ""
  }
}
