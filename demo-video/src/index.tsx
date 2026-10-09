import {
  AbsoluteFill,
  Composition,
  registerRoot,
  Sequence,
  useCurrentFrame,
} from "remotion";
import timeline from "../public/timeline.json";
import { FilmScene } from "./scenes/FilmScene";
import { End } from "./scenes/End";
import { ApprovalScene, approvalDuration } from "./scenes/ApprovalScene";
import "./style.css";
const FPS = 30;
const palette = { blue: "#1677ff", navy: "#0a1930", paper: "#f5f8fd" };
const Demo = () => {
  let at = 0;
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: palette.paper,
        color: palette.navy,
        fontFamily: "Segoe UI, Arial, sans-serif",
      }}
    >
      {timeline.map((s) => {
        const start = at;
        at += s.duration * FPS;
        return (
          <Sequence
            key={s.id}
            from={start}
            durationInFrames={s.duration * FPS}
            name={s.id}
          >
            <FilmScene shot={s} />
          </Sequence>
        );
      })}
      <Sequence from={71 * FPS} durationInFrames={approvalDuration * FPS} name="Driver approval">
        <ApprovalScene />
      </Sequence>
      <Sequence from={(71 + approvalDuration) * FPS} durationInFrames={4 * FPS} name="Closing">
        <End />
      </Sequence>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 4,
          width: `${f < 71 * FPS ? (f / 2250) * 100 : ((71 / 75) + ((f - 71 * FPS) / ((4 + approvalDuration) * FPS)) * (4 / 75)) * 100}%`,
          background: palette.blue,
        }}
      />
    </AbsoluteFill>
  );
};
registerRoot(() => (
  <Composition
    id="DarbGoDemo"
    component={Demo}
    durationInFrames={(75 + approvalDuration) * FPS}
    fps={30}
    width={1920}
    height={1080}
  />
));
