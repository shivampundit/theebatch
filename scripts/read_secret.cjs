const fs = require("node:fs");
module.exports = async function readSecret() {
  if (!process.stdin.isTTY) return fs.readFileSync(0, "utf8").replace(/[\r\n]+$/, "");
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    let value = "";
    process.stdout.write("Private gallery password (hidden): ");
    input.setRawMode(true);
    input.setEncoding("utf8");
    input.resume();
    const finish = () => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", receive);
      process.stdout.write("\n");
    };
    const receive = chunk => {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") { finish(); resolve(value); return; }
        if (character === "\u0003") { finish(); reject(new Error("Password entry cancelled.")); return; }
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " " && character !== "\u001b") value += character;
      }
    };
    input.on("data", receive);
  });
};
