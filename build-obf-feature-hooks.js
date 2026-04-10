const fs = require("fs");
const path = require("path");
const terser = require("terser");
const JavaScriptObfuscator = require("javascript-obfuscator");

const inputPath = path.join(__dirname, "feature-hooks.js");

const reservedNames = ["PanelFeatureHooks", "PanelFeatureConfig", "PanelBallistics"];

const obfuscateOptions = {
  compact: true,
  renameGlobals: false,
  stringArray: true,
  stringArrayThreshold: 0.7,
  stringArrayEncoding: ["base64"],
  stringArrayShuffle: true,
  stringArrayRotate: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  deadCodeInjection: false,
  controlFlowFlattening: false,
  selfDefending: false,
  debugProtection: false,
  debugProtectionInterval: 0,
  reservedNames,
};

async function main() {
  let code = fs.readFileSync(inputPath, "utf8");
  const passes = 3;

  for (let i = 0; i < passes; i += 1) {
    const minified = await terser.minify(code, {
      compress: true,
      mangle: {
        toplevel: false,
        reserved: reservedNames,
      },
      format: {
        comments: false,
      },
    });

    if (minified.error) {
      throw minified.error;
    }

    code = JavaScriptObfuscator.obfuscate(
      minified.code,
      obfuscateOptions
    ).getObfuscatedCode();
  }

  fs.writeFileSync(inputPath, code, "utf8");
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
