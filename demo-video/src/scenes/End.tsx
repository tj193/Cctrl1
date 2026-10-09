import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const End = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      className="ending"
      style={{ opacity: interpolate(f, [0, 12], [0, 1], clamp) }}
    >
      <Img
        src={staticFile("logo.png")}
        style={{ width: 150, height: 150, objectFit: "contain" }}
      />
      <div className="brand">
        Darb<span>Go</span>
      </div>
      <h1 dir="rtl">من منطقتك إلى جامعتك</h1>
      <div className="relationship" dir="rtl">
        <span>الطالب يختار</span>
        <i>←</i>
        <strong>المنصة تربط</strong>
        <i>←</i>
        <span>السائق ينظّم</span>
      </div>
      <p dir="rtl">رحلة أوضح للطالب · تنظيم أفضل للسائق</p>
      <small dir="rtl">نموذج تجريبي — لا حجوزات فعلية</small>
    </AbsoluteFill>
  );
};
