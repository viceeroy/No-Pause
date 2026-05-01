const C = {
  bg: { r: 1, g: 0.984, b: 0.965 },
  page: { r: 0.969, g: 0.953, b: 0.925 },
  card: { r: 1, g: 1, b: 1 },
  ink: { r: 0.09, g: 0.082, b: 0.071 },
  muted: { r: 0.439, g: 0.4, b: 0.353 },
  faint: { r: 0.835, g: 0.804, b: 0.753 },
  orange: { r: 0.93, g: 0.427, b: 0.157 },
  orangeSoft: { r: 1, g: 0.89, b: 0.804 },
  orangePale: { r: 1, g: 0.957, b: 0.914 },
  green: { r: 0.137, g: 0.604, b: 0.392 },
  red: { r: 0.74, g: 0.161, b: 0.125 },
  blue: { r: 0.231, g: 0.416, b: 0.722 }
};

const FONT = "Inter";
const MOBILE_W = 390;
const MOBILE_H = 844;
const R = {
  card: 24,
  button: 999,
  chip: 16
};

const iconSvgs = {
  mic: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#ED6D28" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/><path d="M8 22h8"/></svg>',
  square: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="2"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>',
  user: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#171512" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
  arrow: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#171512" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
  chart: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#ED6D28" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-7"/></svg>',
  clock: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#ED6D28" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pause: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#ED6D28" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4v16"/><path d="M14 4v16"/></svg>',
  google: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2z"/><path fill="#34A853" d="M12 22c2.7 0 5-0.9 6.6-2.5l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 13.8a6 6 0 0 1 0-3.6V7.6H3.1a10 10 0 0 0 0 8.8l3.3-2.6z"/><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2 10 10 0 0 0 3.1 7.6l3.3 2.6c.8-2.3 3-4.1 5.6-4.1z"/></svg>',
  telegram: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#2AABEE"><path d="M21.7 4.4 18.5 19c-.2 1-.8 1.3-1.6.8l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.7 8.5-7.7c.4-.3-.1-.5-.6-.2L7 13l-4.5-1.4c-1-.3-1-1 .2-1.5L20.2 3.4c.8-.3 1.6.2 1.5 1z"/></svg>',
  alert: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#BD291F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
};

function solid(color) {
  return [{ type: "SOLID", color }];
}

function stroke(color, weight = 1) {
  return { strokes: solid(color), strokeWeight: weight };
}

function shadow(y = 14, blur = 34, alpha = 0.12) {
  return [{
    type: "DROP_SHADOW",
    color: { r: 0.09, g: 0.07, b: 0.04, a: alpha },
    offset: { x: 0, y },
    radius: blur,
    spread: 0,
    visible: true,
    blendMode: "NORMAL"
  }];
}

async function text(parent, value, x, y, size, weight = "Regular", color = C.ink, width) {
  const node = figma.createText();
  parent.appendChild(node);
  await figma.loadFontAsync({ family: FONT, style: weight });
  node.fontName = { family: FONT, style: weight };
  node.characters = value;
  node.fontSize = size;
  node.fills = solid(color);
  node.x = x;
  node.y = y;
  node.lineHeight = { unit: "PERCENT", value: 118 };
  if (width) {
    node.resize(width, node.height);
    node.textAutoResize = "HEIGHT";
  }
  return node;
}

function frame(parent, name, x, y, w, h, fill = C.bg) {
  const f = figma.createFrame();
  parent.appendChild(f);
  f.name = name;
  f.x = x;
  f.y = y;
  f.resize(w, h);
  f.fills = solid(fill);
  f.clipsContent = false;
  return f;
}

function rect(parent, name, x, y, w, h, fill, radius = 0, borderColor, effects = []) {
  const r = figma.createRectangle();
  parent.appendChild(r);
  r.name = name;
  r.x = x;
  r.y = y;
  r.resize(w, h);
  r.cornerRadius = radius;
  r.fills = solid(fill);
  if (borderColor) Object.assign(r, stroke(borderColor));
  r.effects = effects;
  return r;
}

function ellipse(parent, name, x, y, w, h, fill, borderColor, effects = []) {
  const e = figma.createEllipse();
  parent.appendChild(e);
  e.name = name;
  e.x = x;
  e.y = y;
  e.resize(w, h);
  e.fills = solid(fill);
  if (borderColor) Object.assign(e, stroke(borderColor));
  e.effects = effects;
  return e;
}

function icon(parent, key, x, y, size = 24) {
  const node = figma.createNodeFromSvg(iconSvgs[key]);
  parent.appendChild(node);
  node.name = `${key} icon`;
  node.x = x;
  node.y = y;
  node.resize(size, size);
  return node;
}

async function button(parent, label, x, y, w, h, variant = "primary", iconKey) {
  const fill = variant === "primary" ? C.orange : C.card;
  const ink = variant === "primary" ? { r: 1, g: 1, b: 1 } : C.ink;
  rect(parent, `${label} button`, x, y, w, h, fill, R.button, variant === "primary" ? C.orange : C.faint, shadow(10, 24, 0.1));
  if (iconKey) icon(parent, iconKey, x + 24, y + (h - 20) / 2, 20);
  const t = await text(parent, label, x + (iconKey ? 54 : 0), y + (h - 20) / 2, 16, "Bold", ink, iconKey ? w - 78 : w);
  if (!iconKey) t.textAlignHorizontal = "CENTER";
  return t;
}

async function statCard(parent, label, value, x, y, w, h, iconKey) {
  rect(parent, `${label} card`, x, y, w, h, C.card, 20, C.faint, shadow(12, 28, 0.08));
  icon(parent, iconKey, x + 18, y + 16, 20);
  await text(parent, label, x + 18, y + 46, 12, "Medium", C.muted, w - 36);
  await text(parent, value, x + 18, y + 68, 24, "Bold", C.ink, w - 36);
}

async function infoCard(parent, title, body, x, y, w, iconKey) {
  rect(parent, `${title} info`, x, y, w, 118, C.card, 20, C.faint, shadow(10, 24, 0.07));
  rect(parent, "icon well", x + 16, y + 14, 38, 38, C.orangePale, 13, C.orangeSoft);
  icon(parent, iconKey, x + 23, y + 21, 24);
  await text(parent, title, x + 16, y + 62, 14, "Bold", C.ink, w - 32);
  await text(parent, body, x + 16, y + 84, 12, "Regular", C.muted, w - 32);
}

async function sectionTitle(parent, label, x, y) {
  await text(parent, label, x, y, 16, "Bold", C.ink);
}

function wave(parent, x, y) {
  const heights = [18, 32, 52, 76, 96, 76, 52, 32, 18];
  heights.forEach((h, i) => {
    rect(parent, "wave bar", x + i * 16, y + (96 - h) / 2, 7, h, i === 4 ? C.orange : C.orangeSoft, 999);
  });
}

async function dashboard(root, x, y) {
  const f = frame(root, "01 Dashboard / Home - mobile", x, y, MOBILE_W, MOBILE_H);
  await text(f, "No Pause", 24, 25, 28, "Bold", C.ink);
  await text(f, "Free Speaking practice", 24, 61, 14, "Medium", C.muted);
  ellipse(f, "profile opens stats", 330, 28, 42, 42, C.card, C.faint, shadow(8, 18, 0.1));
  icon(f, "user", 339, 37, 24);
  await statCard(f, "Flow score", "86", 24, 102, 160, 108, "chart");
  await statCard(f, "Practice time", "12m", 206, 102, 160, 108, "clock");

  rect(f, "hero speaking card", 24, 236, 342, 332, C.card, 28, C.faint, shadow(18, 46, 0.14));
  ellipse(f, "large orange halo", 104, 277, 182, 182, C.orangePale, C.orangeSoft);
  ellipse(f, "mic disc", 139, 312, 112, 112, C.card, C.orangeSoft, shadow(16, 32, 0.12));
  icon(f, "mic", 171, 344, 48);
  await text(f, "Start with your voice", 58, 475, 28, "Bold", C.ink, 274);
  await text(f, "Open Free Speaking, record a short session, then review your Flow Score.", 62, 515, 14, "Regular", C.muted, 266);

  await sectionTitle(f, "Next steps", 24, 594);
  await infoCard(f, "Speak more", "Short daily sessions build fluency.", 24, 626, 154, "mic");
  await infoCard(f, "Reduce pauses", "Keep momentum through silence gaps.", 194, 626, 172, "pause");
  await button(f, "Start Speaking", 24, 772, 342, 56, "primary", "mic");
}

async function recording(root, x, y) {
  const f = frame(root, "02 Practice Recording - mobile", x, y, MOBILE_W, MOBILE_H);
  await text(f, "Free Speaking", 24, 28, 16, "Bold", C.orange);
  await text(f, "Speak freely", 24, 57, 32, "Bold", C.ink, 342);
  await text(f, "Recording in progress", 24, 100, 14, "Medium", C.muted);

  ellipse(f, "animated ring outer", 53, 185, 284, 284, { r: 1, g: 0.97, b: 0.94 }, C.orangeSoft);
  ellipse(f, "animated ring middle", 76, 208, 238, 238, C.orangePale, C.orange);
  ellipse(f, "timer disc", 105, 237, 180, 180, C.card, C.orangeSoft, shadow(18, 42, 0.12));
  await text(f, "01:24", 131, 303, 48, "Bold", C.orange);
  wave(f, 124, 475);
  await text(f, "The ring expands softly with your voice level.", 52, 592, 14, "Regular", C.muted, 286);
  await button(f, "Finish Session", 24, 772, 342, 56, "primary", "square");
}

async function results(root, x, y) {
  const f = frame(root, "03 Results - mobile", x, y, MOBILE_W, MOBILE_H);
  await text(f, "Results", 24, 26, 28, "Bold", C.ink);
  await text(f, "Strong flow. Keep the pace steady.", 24, 64, 14, "Regular", C.muted, 300);
  rect(f, "score card", 24, 104, 342, 190, C.card, 28, C.faint, shadow(18, 42, 0.13));
  await text(f, "Flow Score", 48, 132, 13, "Bold", C.muted);
  await text(f, "86", 48, 158, 86, "Bold", C.orange);
  await text(f, "out of 100", 174, 218, 14, "Medium", C.muted);
  rect(f, "score line", 48, 258, 280, 10, C.orangePale, 999);
  rect(f, "score line filled", 48, 258, 236, 10, C.orange, 999);

  await statCard(f, "Speaking time", "2m 14s", 24, 318, 160, 102, "clock");
  await statCard(f, "Pauses", "3", 206, 318, 160, 102, "pause");

  rect(f, "feedback card", 24, 444, 342, 104, C.card, 22, C.faint, shadow(12, 28, 0.08));
  await text(f, "Feedback", 44, 465, 16, "Bold", C.ink);
  await text(f, "You recovered quickly after short pauses. Try linking thoughts with simple bridge phrases.", 44, 493, 14, "Regular", C.muted, 282);

  rect(f, "transcript card", 24, 572, 342, 146, C.card, 22, C.faint, shadow(12, 28, 0.08));
  await text(f, "Transcript", 44, 592, 16, "Bold", C.ink);
  await text(f, "I want to explain the idea in a simple way. The main point is that small daily speaking habits make it easier to stay fluent...", 44, 622, 14, "Regular", C.muted, 282);
  await button(f, "Practice Again", 24, 772, 342, 56, "primary", "mic");
}

async function stats(root, x, y) {
  const f = frame(root, "04 Stats - mobile", x, y, MOBILE_W, MOBILE_H);
  icon(f, "arrow", 24, 31, 22);
  await text(f, "Stats", 24, 70, 32, "Bold", C.ink);
  await text(f, "Free Speaking progress", 24, 112, 14, "Regular", C.muted);

  rect(f, "overall flow", 24, 148, 342, 176, C.card, 28, C.faint, shadow(18, 42, 0.12));
  await text(f, "Overall Flow Score", 48, 176, 14, "Bold", C.muted);
  await text(f, "82", 48, 207, 76, "Bold", C.orange);
  await text(f, "15 scored sessions", 181, 255, 14, "Medium", C.muted);

  await statCard(f, "Current streak", "5 days", 24, 348, 160, 104, "chart");
  await statCard(f, "Total practice", "48m", 206, 348, 160, 104, "clock");

  rect(f, "telegram secondary", 24, 476, 342, 72, C.orangePale, 20, C.orangeSoft);
  icon(f, "telegram", 44, 500, 28);
  await text(f, "Telegram integration", 84, 493, 15, "Bold", C.ink);
  await text(f, "Optional voice note practice outside the web app.", 84, 516, 12, "Regular", C.muted, 240);

  await sectionTitle(f, "Recent sessions", 24, 580);
  await sessionRow(f, "Today, 9:42 PM", "2m 14s - 3 pauses", "86", 24, 612);
  await sessionRow(f, "Apr 30, 8:16 PM", "4m 02s - 5 pauses", "79", 24, 694);
  await sessionRow(f, "Apr 29, 7:05 PM", "3m 11s - 2 pauses", "91", 24, 776);
}

async function sessionRow(parent, date, meta, score, x, y) {
  rect(parent, "session row", x, y, 342, 64, C.card, 18, C.faint, shadow(8, 18, 0.06));
  await text(parent, "Free Speaking", x + 18, y + 13, 14, "Bold", C.ink);
  await text(parent, `${date}  |  ${meta}`, x + 18, y + 36, 11, "Regular", C.muted, 230);
  await text(parent, score, x + 285, y + 12, 24, "Bold", C.orange);
  await text(parent, "Flow", x + 283, y + 41, 10, "Bold", C.muted);
}

async function auth(root, x, y) {
  const f = frame(root, "05 Auth - mobile", x, y, MOBILE_W, MOBILE_H);
  ellipse(f, "soft mic halo", 95, 112, 200, 200, C.orangePale, C.orangeSoft);
  ellipse(f, "mic circle", 140, 157, 110, 110, C.card, C.orangeSoft, shadow(18, 42, 0.12));
  icon(f, "mic", 171, 188, 48);
  await text(f, "No Pause", 66, 352, 44, "Bold", C.ink, 258);
  await text(f, "Minimal speech practice for smoother Free Speaking.", 54, 416, 17, "Regular", C.muted, 282);
  rect(f, "auth card", 24, 536, 342, 180, C.card, 26, C.faint, shadow(18, 42, 0.12));
  await text(f, "Sign in to save your flow", 54, 566, 20, "Bold", C.ink, 282);
  await text(f, "Your sessions, Flow Score, transcript, and stats stay connected to your account.", 54, 599, 14, "Regular", C.muted, 282);
  rect(f, "google button", 54, 656, 282, 48, C.bg, R.button, C.faint);
  icon(f, "google", 77, 668, 24);
  await text(f, "Continue with Google", 118, 670, 15, "Bold", C.ink, 185);
}

async function states(root, x, y) {
  const f = frame(root, "06 States - mobile", x, y, MOBILE_W, MOBILE_H);
  await text(f, "States", 24, 28, 30, "Bold", C.ink);
  await stateCard(f, "Loading stats", "Fetching recent Free Speaking sessions...", 24, 92, "clock", true);
  await stateCard(f, "No sessions yet", "Start your first Free Speaking session to see scores and transcript history.", 24, 234, "mic", false);
  await stateCard(f, "Microphone blocked", "Allow microphone access, then try recording again.", 24, 396, "alert", false);
  await stateCard(f, "Transcript unavailable", "Audio saved. You can retry transcription from Results.", 24, 558, "alert", false);
  await button(f, "Start Speaking", 24, 772, 342, 56, "primary", "mic");
}

async function stateCard(parent, title, body, x, y, iconKey, loading) {
  rect(parent, `${title} state`, x, y, 342, 118, C.card, 24, C.faint, shadow(12, 28, 0.08));
  if (loading) {
    ellipse(parent, "loading ring", x + 20, y + 26, 44, 44, C.orangePale, C.orange);
  } else {
    rect(parent, "state icon well", x + 20, y + 24, 46, 46, C.orangePale, 16, C.orangeSoft);
    icon(parent, iconKey, x + 31, y + 35, 24);
  }
  await text(parent, title, x + 82, y + 27, 17, "Bold", C.ink, 230);
  await text(parent, body, x + 82, y + 56, 13, "Regular", C.muted, 230);
}

async function designSystem(root, x, y) {
  const f = frame(root, "Design System", x, y, 1060, 980, C.page);
  await text(f, "No Pause Design System", 48, 42, 36, "Bold", C.ink);
  await text(f, "Clean, modern, mobile-first, white background, orange accent, rounded cards, soft shadows, simple icons.", 48, 94, 18, "Regular", C.muted, 720);

  await text(f, "Typography", 48, 164, 22, "Bold", C.ink);
  const typeRows = [
    ["Display", "44 / 52, Bold", 44],
    ["Screen title", "32 / 38, Bold", 32],
    ["Section", "20 / 24, Bold", 20],
    ["Body", "15 / 22, Regular", 15],
    ["Caption", "12 / 16, Medium", 12]
  ];
  for (let i = 0; i < typeRows.length; i++) {
    const row = typeRows[i];
    await text(f, row[0], 48, 210 + i * 74, row[2], i < 3 ? "Bold" : "Regular", C.ink, 260);
    await text(f, row[1], 360, 219 + i * 74, 14, "Medium", C.muted, 200);
  }

  await text(f, "Color", 560, 164, 22, "Bold", C.ink);
  await swatch(f, "Orange accent", "#ED6D28", C.orange, 560, 210);
  await swatch(f, "Warm background", "#FFFBF6", C.bg, 560, 300);
  await swatch(f, "Card", "#FFFFFF", C.card, 560, 390);
  await swatch(f, "Ink", "#171512", C.ink, 560, 480);
  await swatch(f, "Muted text", "#70665A", C.muted, 560, 570);

  await text(f, "Components", 48, 618, 22, "Bold", C.ink);
  await button(f, "Primary action", 48, 666, 240, 56, "primary", "mic");
  await button(f, "Secondary", 320, 666, 200, 56, "secondary");
  await statCard(f, "Metric card", "86", 560, 648, 180, 118, "chart");
  await infoCard(f, "Info card", "Short horizontal cards below stats.", 772, 648, 220, "mic");

  await text(f, "Spacing Rules", 48, 780, 22, "Bold", C.ink);
  await text(f, "Mobile gutters: 24. Card padding: 20-24. Section gaps: 28-36. Button height: 56. Desktop max content: 1120 with two-column compositions.", 48, 824, 16, "Regular", C.muted, 520);
  await text(f, "Orange Usage", 560, 780, 22, "Bold", C.ink);
  await text(f, "Use orange for primary actions, active recording rings, score emphasis, and small icon wells. Avoid large orange backgrounds except the fixed primary CTA.", 560, 824, 16, "Regular", C.muted, 420);
}

async function swatch(parent, name, hex, color, x, y) {
  rect(parent, `${name} swatch`, x, y, 64, 64, color, 16, C.faint);
  await text(parent, name, x + 84, y + 8, 16, "Bold", C.ink, 220);
  await text(parent, hex, x + 84, y + 34, 14, "Regular", C.muted, 120);
}

async function desktopExamples(root, x, y) {
  const f = frame(root, "Mobile and Desktop Layout Examples", x, y, 1440, 980, C.page);
  await text(f, "Layout Examples", 48, 42, 36, "Bold", C.ink);
  await text(f, "Mobile keeps one focused action per screen. Desktop centers the product surface and lets stats sit beside the speaking card.", 48, 94, 18, "Regular", C.muted, 780);

  const mobileShell = frame(f, "mobile shell", 70, 170, 260, 563, C.bg);
  mobileShell.cornerRadius = 34;
  mobileShell.clipsContent = true;
  await text(mobileShell, "No Pause", 22, 24, 22, "Bold", C.ink);
  rect(mobileShell, "hero", 22, 94, 216, 230, C.card, 22, C.faint, shadow(12, 28, 0.1));
  ellipse(mobileShell, "mic halo", 79, 130, 102, 102, C.orangePale, C.orangeSoft);
  icon(mobileShell, "mic", 117, 168, 28);
  await text(mobileShell, "Free Speaking", 52, 256, 22, "Bold", C.ink, 160);
  await button(mobileShell, "Start", 22, 491, 216, 48, "primary", "mic");

  rect(f, "desktop app surface", 440, 170, 910, 620, C.bg, 34, C.faint, shadow(20, 52, 0.14));
  await text(f, "No Pause", 488, 220, 30, "Bold", C.ink);
  ellipse(f, "desktop profile", 1260, 218, 48, 48, C.card, C.faint, shadow(10, 22, 0.1));
  icon(f, "user", 1272, 230, 24);
  rect(f, "desktop speaking card", 488, 304, 520, 348, C.card, 30, C.faint, shadow(18, 42, 0.12));
  ellipse(f, "desktop halo", 666, 354, 164, 164, C.orangePale, C.orangeSoft);
  icon(f, "mic", 725, 413, 48);
  await text(f, "Start with your voice", 590, 550, 32, "Bold", C.ink, 320);
  await statCard(f, "Overall Flow", "86", 1040, 304, 260, 136, "chart");
  await statCard(f, "Practice Time", "48m", 1040, 472, 260, 136, "clock");
  await button(f, "Start Speaking", 488, 690, 520, 58, "primary", "mic");
}

async function main() {
  await figma.loadFontAsync({ family: FONT, style: "Regular" });
  await figma.loadFontAsync({ family: FONT, style: "Medium" });
  await figma.loadFontAsync({ family: FONT, style: "Bold" });

  const page = figma.createPage();
  page.name = "No Pause - Product Design";
  figma.currentPage = page;

  await dashboard(page, 0, 0);
  await recording(page, 430, 0);
  await results(page, 860, 0);
  await stats(page, 1290, 0);
  await auth(page, 1720, 0);
  await states(page, 2150, 0);
  await designSystem(page, 0, 960);
  await desktopExamples(page, 1120, 960);

  figma.viewport.scrollAndZoomIntoView(page.children);
  figma.notify("No Pause product design created: Free Speaking-focused screens and design system.");
  figma.closePlugin();
}

main().catch((error) => {
  figma.notify(`No Pause design failed: ${error && error.message ? error.message : error}`);
  figma.closePlugin();
});
