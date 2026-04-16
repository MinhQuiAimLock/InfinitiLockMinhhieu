const fs = require("fs");
const path = require("path");
const terser = require("terser");
const JavaScriptObfuscator = require("javascript-obfuscator");

const inputPath = path.join(__dirname, "panel-actions.js");

const reservedNames = [
  "PanelActions",
  "AimLock2D",
  "AimLockEnabled",
  "VSHTechInputKit"
];

async function main() {
  const source = fs.readFileSync(inputPath, "utf8");

  const minified = await terser.minify(source, {
    compress: true,
    mangle: {
      toplevel: false,
      reserved: reservedNames
    },
    format: {
      comments: false
    }
  });

  if (minified.error) {
    throw minified.error;
  }

  const obfuscated = JavaScriptObfuscator.obfuscate(minified.code, {
    compact: true,
    renameGlobals: false,
    stringArray: true,
    stringArrayThreshold: 0.6,
    reservedNames,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    selfDefending: false,
    debugProtection: false,
    debugProtectionInterval: 0
  });

  fs.writeFileSync(inputPath, obfuscated.getObfuscatedCode(), "utf8");
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
