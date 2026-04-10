const fs = require("fs");
const path = require("path");
const terser = require("terser");

const inputPath = path.join(__dirname, "panel-actions.js");

async function main() {
  const source = fs.readFileSync(inputPath, "utf8");

  const minified = await terser.minify(source, {
    compress: true,
    mangle: false,
    format: {
      comments: false
    }
  });

  if (minified.error) {
    throw minified.error;
  }

  fs.writeFileSync(inputPath, minified.code, "utf8");
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
