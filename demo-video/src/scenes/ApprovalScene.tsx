import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';

const steps = [
  { file: 'approval-waiting.png', title: 'طلب السائق قيد المراجعة', caption: 'يُرسل الطلب وينتظر موافقة الإدارة', cursor: [752, 475] },
  { file: 'approval-table.png', title: 'يصل الطلب إلى الإدارة', caption: 'طلبات السائقين والموافقات', cursor: [1338, 379], click: true },
  { file: 'approval-review.png', title: 'مراجعة بيانات السائق', caption: 'تتحقق الإدارة ثم توافق أو ترفض', cursor: [512, 698], click: true },
  { file: 'approval-saved.png', title: 'تم حفظ الموافقة', caption: 'رسالة جاهزة لإبلاغ السائق عبر واتساب', cursor: [544, 735] },
] as const;
const durations = [3, 3, 4, 4];
export const approvalDuration = durations.reduce((a, b) => a + b, 0);

export const ApprovalScene: React.FC = () => {
  const frame = useCurrentFrame();
  let offset = 0;
  let index = 0;
  for (let i = 0; i < steps.length; i++) {
    if (frame < offset + durations[i] * 30) { index = i; break; }
    offset += durations[i] * 30;
  }
  const step = steps[index];
  const localFrame = frame - offset;
  const duration = durations[index] * 30;
  const opacity = interpolate(localFrame, [0, 7, duration - 7, duration], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const progress = interpolate(localFrame, [0, duration - 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const x = 1120 + (step.cursor[0] - 1120) * progress;
  const y = 730 + (step.cursor[1] - 730) * progress;
  return <AbsoluteFill style={{ opacity }}>
    <div className="rail">
      <div className="step">{String(index + 13).padStart(2, '0')} / 16</div>
      <h1 dir="rtl">{step.title}</h1>
      <div className="rule" />
      <p dir="rtl">{step.caption}</p>
      <div className="demo" dir="rtl">عرض تجريبي محلي<br /><small>لا تُرسل رسالة فعلية</small></div>
    </div>
    <div className="screen">
      <div style={{ width: 1440, height: 900, position: 'relative', scale: 1600 / 1440, transformOrigin: 'top left' }}>
        <Img src={staticFile(step.file)} style={{ width: 1440, height: 900 }} />
        {'click' in step && step.click && localFrame > duration - 16 && <div style={{ position: 'absolute', left: step.cursor[0] - 22, top: step.cursor[1] - 22, width: 44, height: 44, border: '3px solid #1677ff', borderRadius: '50%', opacity: interpolate(localFrame, [duration - 16, duration], [.8, 0]) }} />}
        <svg style={{ position: 'absolute', left: x - 3, top: y - 3, filter: 'drop-shadow(0 2px 3px #0a193040)' }} width="25" height="33" viewBox="0 0 25 33"><path d="M3 2L22 19L13 20L9 29Z" fill="white" stroke="#0a1930" strokeWidth="2" /></svg>
      </div>
    </div>
  </AbsoluteFill>;
};
