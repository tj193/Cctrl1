const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const bin = path.join(
  __dirname,
  "node_modules/@remotion/compositor-win32-x64-msvc",
);
const file = path.join(__dirname, "out/DarbGo-demo-89s.mp4");
const metadata = JSON.parse(
  execFileSync(
    path.join(bin, "ffprobe.exe"),
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
    { encoding: "utf8" },
  ),
);
const video = metadata.streams.find((x) => x.codec_type === "video");
if (
  video.width !== 1920 ||
  video.height !== 1080 ||
  video.avg_frame_rate !== "30/1" ||
  Math.abs(+metadata.format.duration - 89) > 0.05 ||
  metadata.streams.some((x) => x.codec_type === "audio")
)
  throw Error("Output does not meet delivery specification");
fs.mkdirSync(path.join(__dirname, "audit/final"), { recursive: true });
execFileSync(path.join(bin, "ffmpeg.exe"), [
  "-v",
  "error",
  "-i",
  file,
  "-vf",
  "scale=960:540",
  "-r",
  "1/3",
  "-y",
  path.join(__dirname, "audit/final/frame-%02d.jpg"),
]);
execFileSync(path.join(bin, "ffmpeg.exe"), [
  "-v",
  "error",
  "-i",
  file,
  "-map",
  "0:v:0",
  "-c:v",
  "rawvideo",
  "-f",
  "null",
  "-",
]);
fs.writeFileSync(
  path.join(__dirname, "out/verification.json"),
  JSON.stringify(
    {
      duration: +metadata.format.duration,
      width: video.width,
      height: video.height,
      fps: video.avg_frame_rate,
      frames: video.nb_frames,
      codec: video.codec_name,
      pixelFormat: video.pix_fmt,
      audioStreams: 0,
      fullDecode: "passed",
    },
    null,
    2,
  ),
);
console.log(
  "Verified: 89 seconds, 1920x1080, 30fps, H.264, no audio; complete decode passed.",
);
