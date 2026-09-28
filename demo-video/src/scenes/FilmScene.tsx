import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import timeline from "../../public/timeline.json";
import captureMeta from "../../public/capture-meta.json";
import frameMeta from "../../public/frames/manifest.json";

const FPS = 30;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type Shot = (typeof timeline)[number];
export const FilmScene: React.FC<{ shot: Shot }> = ({ shot }) => {
  const f = useCurrentFrame(),
    t = f / FPS;
  const rate = (shot.end - shot.start) / shot.duration;
  const sourceT = t * rate;
  const pts = shot.cursor;
  const last = pts.findIndex((v) => v.t > sourceT);
  const b = last < 0 ? pts[pts.length - 1] : pts[last];
  const a = last <= 0 ? b : pts[last - 1];
  const mix = a.t === b.t ? 1 : interpolate(sourceT, [a.t, b.t], [0, 1], clamp);
  const x = a.x + (b.x - a.x) * mix,
    y = a.y + (b.y - a.y) * mix;
  const h = shot.highlights.find(
    (v) => sourceT >= v.t && sourceT < v.t + v.duration,
  );
  const click = shot.clicks.find((v) => sourceT >= v.t && sourceT < v.t + 0.55);
  const opacity = interpolate(
    f,
    [0, 7, shot.duration * FPS - 7, shot.duration * FPS],
    [0, 1, 1, 0],
    clamp,
  );
  return (
    <AbsoluteFill style={{ opacity }}>
      <div className="rail">
        <div className="step">
          {String(timeline.indexOf(shot) + 1).padStart(2, "0")} / 13
        </div>
        <h1 dir="rtl">{shot.title}</h1>
        <div className="rule" />
        <p dir="rtl">{shot.caption}</p>
        {shot.id === "driver" && (
          <div className="limitation" dir="rtl">
            القبول والرفض غير مفعّلين بعد
          </div>
        )}
        {["compare", "third", "details"].includes(shot.id) && (
          <div className="note" dir="rtl">
            الأسعار والمقاعد ونسب التطابق بيانات تجريبية
          </div>
        )}
        <div className="demo" dir="rtl">
          عرض تجريبي محلي
          <br />
          <small>لا يوجد حجز فعلي</small>
        </div>
      </div>
      <div className="screen">
        <div
          style={{
            width: 1440,
            height: 900,
            position: "relative",
            scale: 1600 / 1440,
            transformOrigin: "top left",
          }}
        >
          <Img
            src={staticFile(
              (shot.id === "search" && sourceT < 2.2 ? "search-map.png" : "frames/raw/" +
                String(
                  Math.min(
                    frameMeta.frames,
                    Math.max(
                      1,
                      Math.floor(
                        (shot.start -
                          captureMeta.recordingOffsetSeconds +
                          sourceT) *
                          FPS,
                      ) + 1,
                    ),
                  ),
                ).padStart(4, "0") +
                ".jpg"),
            )}
            style={{ width: 1440, height: 900 }}
          />
          {h && h.box && (
            <div
              style={{
                position: "absolute",
                left: h.box.x - 7,
                top: h.box.y - 7,
                width: h.box.width + 14,
                height: h.box.height + 14,
                border: "3px solid #1677ff",
                borderRadius: 14,
                boxShadow: "0 0 0 5px #1677ff18",
                pointerEvents: "none",
              }}
            />
          )}
          {click && (
            <div
              style={{
                position: "absolute",
                left: click.x - 22,
                top: click.y - 22,
                width: 44,
                height: 44,
                border: "3px solid #1677ff",
                borderRadius: "50%",
                scale: interpolate(
                  sourceT - click.t,
                  [0, 0.55],
                  [0.4, 1.8],
                  clamp,
                ),
                opacity: interpolate(
                  sourceT - click.t,
                  [0, 0.55],
                  [0.8, 0],
                  clamp,
                ),
              }}
            />
          )}
          <svg
            style={{
              position: "absolute",
              left: x - 3,
              top: y - 3,
              filter: "drop-shadow(0 2px 3px #0a193040)",
            }}
            width="25"
            height="33"
            viewBox="0 0 25 33"
          >
            <path
              d="M3 2L22 19L13 20L9 29Z"
              fill="white"
              stroke="#0a1930"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>
      {h && (
        <div className="focus-label" dir="rtl">
          {h.label}
        </div>
      )}
    </AbsoluteFill>
  );
};
