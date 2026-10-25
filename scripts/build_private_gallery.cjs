// Password arrives over stdin and is never written to the repository.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const readSecret = require("./read_secret.cjs");
const root = path.resolve(__dirname, "..");
(async () => {
const password = await readSecret();
if (!password) throw new Error("Provide the private gallery password through stdin.");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "build/private-room508-manifest.json"), "utf8"));
if (manifest.length !== 6) throw new Error("The private selection must contain six photographs.");
const photos = manifest.map((item, index) => {
  const bytes = fs.readFileSync(path.join(root, item.destination));
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Expected an optimized JPEG.");
  return { mime: "image/jpeg", caption: "Private collection · Frame " + (index + 1), data: bytes.toString("base64") };
});
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const iterations = 310000;
const key = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const plaintext = Buffer.from(JSON.stringify({ title: "Room 508", photos }));
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
const envelope = { version: 1, kdf: "PBKDF2-SHA256", iterations, salt: salt.toString("base64"), iv: iv.toString("base64"), ciphertext: ciphertext.toString("base64") };
fs.writeFileSync(path.join(root, "data/private-room508.js"), "window.ROOM508_ENVELOPE = " + JSON.stringify(envelope) + ";\n");
key.fill(0);
plaintext.fill(0);
console.log("Encrypted six selected photographs. No plaintext media was written to the public gallery.");
})().catch(error => { console.error(error.message); process.exitCode = 1; });
