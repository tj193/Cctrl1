import { Config } from "@remotion/cli/config";
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setBrowserExecutable(
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
