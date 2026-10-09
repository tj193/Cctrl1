const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const OUT = path.join(__dirname, "public");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: path.join(__dirname, "raw"),
      size: { width: 1440, height: 900 },
    },
  });
  await context.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== "127.0.0.1") return r.abort();
    if (u.port === "8000") {
      u.port = "8009";
      const response = await r.fetch({ url: u.toString() });
      return r.fulfill({ response });
    }
    return r.continue();
  });
  const p = await context.newPage();
  const epoch = Date.now();
  const now = () => (Date.now() - epoch) / 1000;
  const scenes = [];
  let scene;
  let cursor = { x: 1250, y: 750 };
  const wait = (ms) => p.waitForTimeout(ms);
  async function move(selector) {
    const loc = p.locator(selector).first();
    await loc.scrollIntoViewIfNeeded();
    await wait(150);
    const b = await loc.boundingBox();
    const target = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    scene.cursor.push({ t: now() - scene.start, ...cursor });
    await p.mouse.move(target.x, target.y, { steps: 24 });
    await wait(400);
    cursor = target;
    scene.cursor.push({ t: now() - scene.start, ...cursor });
    return loc;
  }
  async function click(selector) {
    const loc = await move(selector);
    scene.clicks.push({ t: now() - scene.start, ...cursor });
    await loc.click();
  }
  async function focus(selector, label) {
    const b = await p.locator(selector).first().boundingBox();
    scene.highlights.push({
      t: now() - scene.start,
      duration: 2.3,
      box: b,
      label,
    });
    await wait(2500);
  }
  async function shot(id, duration, title, caption, action) {
    scene = {
      id,
      duration,
      title,
      caption,
      start: now(),
      cursor: [{ t: 0, ...cursor }],
      clicks: [],
      highlights: [],
    };
    await action();
    const spent = now() - scene.start;
    await wait(Math.max(350, (duration - spent) * 1000));
    scene.end = now();
    await p.screenshot({ path: path.join(OUT, id + ".png") });
    scenes.push(scene);
    console.log(id, (scene.end - scene.start).toFixed(2));
  }
  await p.goto("http://127.0.0.1:5199/index.html");
  await wait(1500);
  await shot("home", 4, "من منطقتك", "إلى جامعتك", async () => {
    await wait(1800);
    await click('a[href="register.html"].primary');
  });
  await wait(350);
  await shot("role", 3, "رحلتك تبدأ هنا", "اختر حساب طالب", async () => {
    await wait(900);
    await click(".student-option");
  });
  await wait(350);
  await shot(
    "map",
    7,
    "حدّد نقطة البداية",
    "بغداد على خريطة العراق",
    async () => {
      await wait(600);
      await click('text[data-governorate="baghdad"]');
      await focus(".map-selection", "بغداد");
      await click("#nextStep");
    },
  );
  await wait(300);
  await shot(
    "journey",
    9,
    "رحلة تناسب يومك",
    "المنطقة · الجامعة · الوصول",
    async () => {
      await click("#studentHomeArea");
      await p.keyboard.press("Escape");
      await p.selectOption("#studentHomeArea", { label: "المنصور" });
      await wait(750);
      await click("#studentUniversity");
      await p.keyboard.press("Escape");
      await p.selectOption("#studentUniversity", { label: "جامعة بغداد" });
      await wait(750);
      await click('[data-time="08:00"]');
      await wait(2000);
      await click("#nextStep");
    },
  );
  await wait(300);
  await shot(
    "account",
    8,
    "حسابك وبياناتك",
    "الاسم · البريد · الهاتف · كلمة المرور",
    async () => {
      for (const [id, value] of [
        ["studentName", "Demo Student"],
        ["studentEmail", "student@example.invalid"],
        ["studentPhone", "07000000000"],
        ["studentPassword", "LocalDemoOnly2026!"],
        ["studentConfirmPassword", "LocalDemoOnly2026!"],
      ]) {
        await click("#" + id);
        await p.locator("#" + id).pressSequentially(value, { delay: 12 });
      }
      await wait(1000);
    },
  );
  await shot(
    "success",
    4,
    "حساب تجريبي جاهز",
    "إنشاء محلي ثم تسجيل الدخول",
    async () => {
      await click("#nextStep");
      await p.locator("#registrationSuccess:not([hidden])").waitFor();
      await wait(1000);
    },
  );
  // The login bridge is performed normally; typing is removed by the edit.
  await p.locator("#registrationSuccess a").click();
  await p.fill("#loginIdentifier", "student@example.invalid");
  await p.fill("#loginPassword", "LocalDemoOnly2026!");
  await p.locator(".login-submit").click();
  await p.waitForURL("**/student/dashboard.html");
  await wait(5000);
  // Existing preview control removes pre-seeded accepted requests; no invented state.
  await p.selectOption("#demoScenario", "routes").catch(async () => {
    console.log(
      "Preview options",
      await p.locator("#demoScenario").innerText(),
    );
  });
  await shot("search", 5, "تفضيلاتك محفوظة", "ابدأ البحث عن خط", async () => {
    await wait(1200);
    await click("#findRouteButton");
    await p.waitForURL("**/routes.html?search=1");
    await p.waitForSelector(".route-card");
    await wait(3500);
  });
  await shot(
    "compare",
    9,
    "قارن قبل القرار",
    "الوقت · السعر الشهري · المقاعد",
    async () => {
      await focus(
        '[data-route-id="route-101"] .route-card-price > div:nth-child(2)',
        "وقت الانطلاق",
      );
      await focus(
        '[data-route-id="route-101"] .route-card-price > div:first-child',
        "السعر بالدينار",
      );
      await focus('[data-route-id="route-101"] .seat-pill', "المقاعد المتاحة");
    },
  );
  await shot(
    "third",
    5,
    "خيار ثالث للمقارنة",
    "تفاصيل واضحة لكل خط",
    async () => {
      await p.locator('[data-route-id="route-103"]').scrollIntoViewIfNeeded();
      await wait(700);
      await focus(
        '[data-route-id="route-103"] .route-card-price',
        "وقت وسعر مختلفان",
      );
    },
  );
  await p.locator('[data-route-id="route-101"]').scrollIntoViewIfNeeded();
  await wait(400);
  await shot(
    "details",
    8,
    "اتخذ قرارك",
    "راجع التفاصيل ثم أرسل طلباً",
    async () => {
      await click('[data-route-id="route-101"] [data-action="details"]');
      await wait(1200);
      await focus(".detail-grid", "التكلفة والموعد ونقطة الالتقاء");
      await click("#dialogRequest");
      await p.waitForURL("**/requests.html");
    },
  );
  await shot(
    "pending",
    3,
    "طلب قيد الانتظار",
    "تجريبي؛ لم يُحجز مقعد حقيقي",
    async () => {
      await focus(
        ".request-card:first-child .status-badge",
        "بانتظار المراجعة",
      );
    },
  );
  // Separate driver demo account, authenticated through the real API on isolated SQLite.
  await p.goto("http://127.0.0.1:5199/login.html");
  await p.fill("#loginIdentifier", "driver@example.invalid");
  await p.fill("#loginPassword", "LocalDemoOnly2026!");
  await p.click(".login-submit");
  await p.waitForURL("**/driver/driver_dashboard.html");
  await p.locator('a[href="student_requests.html"]').click();
  await wait(600);
  await shot(
    "driver",
    6,
    "من جهة السائق",
    "واجهة الطلبات الأولية",
    async () => {
      await focus(
        ".request-card:first-child .request-info",
        "عرض بيانات الطالب",
      );
    },
  );
  const recordingEnd = now();
  await context.close();
  await p.video().saveAs(path.join(OUT, "capture.webm"));
  await browser.close();
  const { execFileSync } = require("node:child_process");
  const probe = path.join(
    __dirname,
    "node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe",
  );
  const metadata = JSON.parse(
    execFileSync(
      probe,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        path.join(OUT, "capture.webm"),
      ],
      { encoding: "utf8" },
    ),
  );
  fs.writeFileSync(
    path.join(OUT, "capture-meta.json"),
    JSON.stringify(
      {
        recordingOffsetSeconds: recordingEnd - Number(metadata.format.duration),
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(OUT, "timeline.json"),
    JSON.stringify(scenes, null, 2),
  );
  fs.copyFileSync(
    path.join(__dirname, "../assets/logo/darbgo-logo.png"),
    path.join(OUT, "logo.png"),
  );
  require("./prepare-frames.cjs");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
