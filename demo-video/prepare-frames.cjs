const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const folder = path.join(__dirname, "public/frames/raw");
fs.mkdirSync(folder, { recursive: true });
const source = path.join(__dirname, "public/capture.webm");
const hash = crypto
  .createHash("sha256")
  .update(fs.readFileSync(source))
  .digest("hex");
const manifest = path.join(__dirname, "public/frames/manifest.json");
if (
  fs.existsSync(manifest) &&
  JSON.parse(fs.readFileSync(manifest)).hash === hash
) {
  console.log("Source frames already prepared.");
  process.exit(0);
}
const ffmpeg = path.join(
  __dirname,
  "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe",
);
execFileSync(
  ffmpeg,
  [
    "-v",
    "error",
    "-i",
    source,
    "-an",
    "-r",
    "30",
    "-q:v",
    "2",
    "-y",
    path.join(folder, "%04d.jpg"),
  ],
  { stdio: "inherit" },
);
fs.writeFileSync(
  manifest,
  JSON.stringify(
    {
      hash,
      fps: 30,
      frames: fs.readdirSync(folder).filter((f) => f.endsWith(".jpg")).length,
    },
    null,
    2,
  ),
);
console.log("Source frames prepared.");
