// Read the shared password from stdin; never record it in source or output.
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const readSecret = require("./read_secret.cjs");
(async () => {
const password = await readSecret();
assert.ok(password, "Supply the gallery password through stdin.");
const context = { window: {} };
const source = fs.readFileSync("data/private-room508.js", "utf8");
vm.runInNewContext(source, context);
const envelope = context.window.ROOM508_ENVELOPE;
const ciphertext = Buffer.from(envelope.ciphertext, "base64");
function decrypt(phrase) {
  const key = crypto.pbkdf2Sync(phrase, Buffer.from(envelope.salt, "base64"), envelope.iterations, 32, "sha256");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(ciphertext.subarray(-16));
  const clear = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]);
  key.fill(0);
  return JSON.parse(clear.toString("utf8"));
}
assert.throws(() => decrypt(password + "-incorrect"));
const gallery = decrypt(password);
assert.equal(gallery.photos.length, 6);
assert.ok(gallery.photos.every(photo => {
  const bytes = Buffer.from(photo.data, "base64");
  return photo.mime === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8;
}));
assert.ok(gallery.photos.every(photo => !source.includes(photo.data)));
assert.equal(fs.existsSync("media/albums/room-508"), false);
console.log("PASS: supplied password decrypts six JPEG photographs; incorrect password fails; no public plaintext 508 directory.");
})().catch(error => { console.error(error.message); process.exitCode = 1; });
