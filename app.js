/* Pairframe — 페어 다이너 메뉴판 메이커
 * 포스터는 index.html 안의 인라인 SVG 하나가 전부다.
 * 화면 표시와 PNG 저장이 같은 SVG를 쓰므로 보이는 그대로 저장된다. */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

const POSTER_W = 1000, POSTER_H = 1500;
const CENTER = 500;
const EXPORT_SCALE = 3;               // 3000 x 4500 px
const STORE_KEY = 'pairframe.v4';

const poster = $('#poster');

/* ===================== 정의 ===================== */

/* 사진이 들어가는 세 자리. box 는 index.html 의 clip-path / hit 사각형과 같아야 한다.
   가운데 그림만은 액자를 켜면 상자가 안으로 들어가므로 render() 가 다시 써넣는다. */
const PHOTO_BOX = { x: 258, y: 414, w: 484, h: 440 };
const PHOTO_INSET = 32;                      // 액자를 켰을 때 사진이 들어가는 깊이(= 매트 폭)
const FRAMES = {
  main: { box: { ...PHOTO_BOX }, img: '#photoImg', hint: '#photoHint', hit: '#photoHit' },
  c1:   { box: { x:  60, y: 406, w: 176, h: 176 }, img: '#c1Img',    hint: '#c1Hint',    hit: '#c1Hit'    },
  c2:   { box: { x: 764, y: 406, w: 176, h: 176 }, img: '#c2Img',    hint: '#c2Hint',    hit: '#c2Hit'    },
};
const framePic = k => (k === 'main' ? S.photo : S[k].img);

/* 음식 그림. 기본값은 art/ 의 그림이고, 올리면 그 그림으로 바뀐다 */
const SLOTS = [
  { k: 'burger', name: '햄버거',     art: 'art/burger.png', box: { cx: 152, cy: 750,  w: 180, h: 148 } },
  { k: 'pizza',  name: '피자',       art: 'art/pizza.png',  box: { cx: 858, cy: 762,  w: 190, h: 141 } },
  { k: 'shake',  name: '밀크셰이크', art: 'art/shake.png',  box: { cx: 810, cy: 1292, w:  94, h: 210 } },
];
const SLOT_BY_K = Object.fromEntries(SLOTS.map(s => [s.k, s]));

const COLORS = [
  { k: 'paper',  name: '종이 (크림)',       def: '#F7EEDB' },
  { k: 'red',    name: '메인 레드',         def: '#C0281B' },
  { k: 'green',  name: '서브 컬러',         def: '#276B4A' },
  { k: 'accent', name: '포인트 (옐로)',     def: '#F2B84B' },
];

const PRESETS = [
  { name: '클래식', c: { paper:'#F7EEDB', red:'#C0281B', green:'#276B4A', accent:'#F2B84B' } },
  { name: '네이비', c: { paper:'#F5EFE0', red:'#C0281B', green:'#22406E', accent:'#E8B33F' } },
  { name: '나이트', c: { paper:'#2A2A33', red:'#E4705E', green:'#8FC7A4', accent:'#F0C766' } },
];

/* 메뉴판 본문은 고정값이다. SPECIAL PAIR SET 첫 줄만 두 사람 것으로 바뀐다.
   열마다 MENU_TOP 에서 시작해 같은 간격으로 쌓으므로 섹션 사이 여백이 항상 같다. */
const COLS = [{ x0: 70, x1: 336 }, { x0: 364, x1: 636 }, { x0: 664, x1: 930 }];
const MENU_TOP = 826, ROW_PITCH = 33, HEAD_GAP = 36, SEC_GAP = 50;
const HEAD_MID = 19;                // 섹션 머리 중심은 top 에서 늘 이만큼 아래다
const BOX_PAD = 28, BOX_GAP = 16;   // 상자가 마지막 줄 아래로 두는 여백 / 상자 다음 섹션까지 여백
const FRAME_TOP = 774, FRAME_BOT = 1364;   // 메뉴 틀. index.html 의 사각형과 같아야 한다
const MENU = [
  [ { title: 'MAIN DISHES', style: 'slant', dx: 22, rows: [
      ['CLASSIC BURGER','$8.5'], ['CHEESE BURGER','$9.5'], ['DOUBLE BURGER','$11.5'],
      ['CHICKEN SANDWICH','$9.0'], ['FRENCH FRIES','$4.0'], ['ONION RINGS','$4.5']] },
    { title: 'SIDE DISHES', style: 'slant', rows: [
      ['MOZZARELLA STICKS','$5.5'], ['CHICKEN NUGGETS','$5.0'], ['COLESLAW','$3.5'],
      ['MAC & CHEESE','$4.5'], ['TATER TOTS','$4.0']] } ],
  [ { title: 'SPECIAL / PAIR SET', style: 'plaque', box: true, rows: [
      ['@pair','$12.5'], ['BURGER + FRIES','$11.0'], ['CHICKEN + DRINK','$12.0'],
      ['PASTA + SALAD','$13.5'], ['PIZZA + DRINK','$14.0']] },
    { title: 'DRINKS', style: 'band', rows: [
      ['COLA','$2.5'], ['SPRITE','$2.5'], ['ORANGE JUICE','$3.0'], ['ICED TEA','$2.5'], ['MILKSHAKE','$4.5']] } ],
  [ { title: 'DESSERTS', style: 'slant', dx: -22, rows: [
      ['APPLE PIE','$4.5'], ['CHOCOLATE CAKE','$5.0'], ['ICE CREAM (1 SCOOP)','$3.5'],
      ['ICE CREAM (2 SCOOP)','$5.5'], ['BROWNIE','$4.5']] },
    { title: 'EXTRA', style: 'ribbon', rows: [
      ['EXTRA CHEESE','$1.0'], ['BACON','$1.5'], ['AVOCADO','$1.5'], ['EGG','$1.0']] } ],
];

const newSticker = () => ({ src: null, scale: 1, dx: 0, dy: 0 });
const newPic     = () => ({ src: null, nw: 0, nh: 0, zoom: 1, ox: 0, oy: 0 });
const newChar    = () => ({ name: '', img: newPic() });

const defaults = () => ({
  pair: '', arch: '', pill: '',
  badge: '',
  set: '', setp: '',
  c1: newChar(), c2: newChar(), photo: newPic(), frame: false,
  stickers: Object.fromEntries(SLOTS.map(s => [s.k, newSticker()])),
  colors: Object.fromEntries(COLORS.map(c => [c.k, c.def])),
});

let S = defaults();

const PH = {
  pair: 'PAIR', arch: 'OUR SPECIAL', pill: 'MENU',
  badge: 'TWO HEARTS / ONE / MENU',
  c1: 'JUN', c2: 'HANA', setp: '$12.5',
};

/* ===================== 색 유틸 ===================== */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function hex2rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hex(r, g, b) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
function rgb2hsl(hex) {
  const [r, g, b] = hex2rgb(hex).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r)      h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else               h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [h, s, l];
}
function hsl2hex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const t = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x]
          : h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
  return rgb2hex((t[0]+m)*255, (t[1]+m)*255, (t[2]+m)*255);
}
const lum = hex => { const [r,g,b] = hex2rgb(hex); return (0.299*r + 0.587*g + 0.114*b) / 255; };

/** 사진 자리에 깔리는, 배경보다 한 톤 밝은 종이색 */
function sheetOf(hex) {
  const [h, s, l] = rgb2hsl(hex);
  return lum(hex) > 0.5 ? hsl2hex(h, clamp(s * 0.6, 0, 1), clamp(l + 0.05, 0, 0.99))
                        : hsl2hex(h, clamp(s * 0.9, 0, 1), clamp(l + 0.08, 0, 1));
}
/** 본문 글자에 쓰는 따뜻한 먹색 (검정은 쓰지 않는다) */
function inkOf(hex) {
  const [h] = rgb2hsl(hex);
  return lum(hex) > 0.5 ? hsl2hex(h, 0.18, 0.26) : hsl2hex(h, 0.14, 0.9);
}
/** 종이 얼룩 */
function grainOf(hex) {
  const [h, s] = rgb2hsl(hex);
  return lum(hex) > 0.5 ? hsl2hex(h, clamp(s, 0.15, 0.5), 0.34) : hsl2hex(h, clamp(s, 0.1, 0.4), 0.8);
}
/** 색이 칠해진 띠 위에 올릴 글자색: 띠가 밝으면 진하게, 어두우면 종이색으로 */
function onColor(bg, sheet) {
  const [h, s] = rgb2hsl(bg);
  return lum(bg) > 0.62 ? hsl2hex(h, clamp(s * 1.1, 0, 1), 0.22) : sheet;
}

/* ===================== 테마 주입 ===================== */

/* 한글은 라틴 폰트에 글리프가 없어 자동으로 뒤쪽 한글 폰트로 넘어간다. */
const F_SLAB   = "'PFSlab','PFDisplayKR','Apple SD Gothic Neo','Malgun Gothic',serif";
const F_SCRIPT = "'PFScript','PFHandKR','Apple SD Gothic Neo','Malgun Gothic',cursive";
const F_COND   = "'PFCond','PFSansKR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";

function themeCss() {
  const c = S.colors;
  const sheet = sheetOf(c.paper);
  return `
.slab{font-family:${F_SLAB}}
.script{font-family:${F_SCRIPT}}
.cond{font-family:${F_COND}}
.f-paper{fill:${c.paper}}.f-sheet{fill:${sheet}}.f-ink{fill:${inkOf(c.paper)}}
.f-red{fill:${c.red}}.f-green{fill:${c.green}}.f-accent{fill:${c.accent}}
.f-on-red{fill:${onColor(c.red, sheet)}}.f-on-green{fill:${onColor(c.green, sheet)}}
.f-grain{fill:${grainOf(c.paper)};opacity:.13}
.s-paper{stroke:${c.paper}}.s-red{stroke:${c.red}}.s-green{stroke:${c.green}}
`;
}

const TONE_MIX = 0.16;                     // 사진 위에 덮는 종이 색의 양

function applyTheme() {
  $('#theme-style').textContent = themeCss();
  // 종이 색이 바뀌면 사진에 덮는 색도 같이 바뀌어야 한다.
  // out = (1-k)*in + k*paper — feComponentTransfer 의 linear 가 그대로 이 식이다
  const rgb = hex2rgb(S.colors.paper);
  ['#tone-r', '#tone-g', '#tone-b'].forEach((sel, i) => {
    const f = $(sel);
    f.setAttribute('slope', (1 - TONE_MIX).toFixed(3));
    f.setAttribute('intercept', (rgb[i] / 255 * TONE_MIX).toFixed(3));
  });
}

/* ===================== 텍스트 ===================== */

const textWidth = el => { try { return el.getComputedTextLength(); } catch { return 0; } };

function fitText(el, maxW, baseSize) {
  el.style.fontSize = baseSize + 'px';
  const w = textWidth(el);
  if (w > maxW && w > 0) el.style.fontSize = Math.max(8, baseSize * maxW / w) + 'px';
  return el;
}

const setText = (sel, str) => { $(sel).textContent = str; return $(sel); };

const setRect = (el, { x, y, w, h }) => {
  el.setAttribute('x', x); el.setAttribute('y', y);
  el.setAttribute('width', w); el.setAttribute('height', h);
};

const splitLines = (str, max) =>
  str.split('/').map(s => s.trim()).filter(Boolean).slice(0, max);

/** 여러 줄 손글씨 덩어리. anchor 는 start / middle / end */
function lineBlock(gSel, str, { x, y, pitch, size, maxW, anchor = 'start', max = 4 }) {
  const g = $(gSel);
  g.textContent = '';
  const lines = splitLines(str, max);
  let widest = 0, lastY = y;
  lines.forEach((line, i) => {
    const t = svgEl('text', { x, y: y + i * pitch });
    if (anchor !== 'start') t.setAttribute('text-anchor', anchor);
    t.textContent = line;
    g.appendChild(t);
    fitText(t, maxW, size);
    widest = Math.max(widest, textWidth(t));
    lastY = y + i * pitch;
  });
  return { widest, lastY, count: lines.length };
}

/** 글자 폭에 맞춰 크기가 정해지는 알약. 섹션 머리와 간판 띠가 같이 쓴다 */
function pill(rectSel, textSel, cx, cy, h, padX, maxW, base) {
  const t = fitText($(textSel), maxW, base);
  const w = textWidth(t) + padX * 2;
  const r = $(rectSel);
  r.setAttribute('x', cx - w / 2);
  r.setAttribute('y', cy - h / 2);
  r.setAttribute('width', w);
  r.setAttribute('height', h);
  return w;
}

/** 영수증 종이. 위아래 변만 톱니로 뜯기고 좌우는 곧다.
    톱니 끝이 상자 선에 닿고 골은 d 만큼 안으로 들어간다 — 바깥 크기는 상자 그대로다. */
function receiptPath({ x, y, w, h }, n, d) {
  const t = w / n;
  let top = '', bottom = '';
  for (let i = 0; i < n; i++) {
    top    += ` L${x + t * i + t / 2} ${y} L${x + t * (i + 1)} ${y + d}`;
    bottom += ` L${x + w - t * i - t / 2} ${y + h} L${x + w - t * (i + 1)} ${y + h - d}`;
  }
  return `M${x} ${y + d}${top} L${x + w} ${y + h - d}${bottom} Z`;
}

/** 늘 같은 각도로 휘는 호. 길이가 길어지면 반지름이 커져 곡률이 유지된다.
    apexY 는 호의 꼭대기(가운데) 높이다. */
function arcPath(sel, len, angle, apexY, dx = 0, dy = 0) {
  const R = len / angle, half = angle / 2;
  const x = R * Math.sin(half), y = apexY + R * (1 - Math.cos(half));
  $(sel).setAttribute('d', `M${CENTER - x + dx} ${y + dy} A ${R} ${R} 0 0 1 ${CENTER + x + dx} ${y + dy}`);
}

const NAME_ARC = 21 * Math.PI / 180;   // 페어명
const ARCH_CY = 127, ARCH_H = 70;     // 띠 한가운데 / 높이 (띠는 92~162)
const PILL_CY = 358;                  // 알약 중심 **고정** (알약 332~384, 영수증 414 까지 30)
/* 페어명은 **띠 아랫변과 알약 중심의 한가운데**에 세로로 놓는다. 글자가 작아져도 위아래로
   똑같이 줄어들어 늘 가운데에 남는다 — 아래(알약)에 매달면 짧은 이름일수록 위가 텅 빈다. */
const NAME_MID = (ARCH_CY + ARCH_H / 2 + PILL_CY) / 2;
const CAP_LAT = 0.786, CAP_KR = 0.782;   // 글자 크기 대비 잉크 높이 (픽셀로 재서 얻은 값)
/* 호 끝에서 잰 처짐(`arcSag`)은 **실제로 보이는 잉크보다 깊다** — 글자는 호 양끝까지 가지 않고
   마지막 글자의 밑동만 내려앉기 때문이다. 픽셀로 재서 얻은 보정값(라틴 0.857 / 한글 0.927).
   한글이 큰 것은 글자통이 정사각형이라 끝까지 꽉 차기 때문이다. */
const SAG_LAT = 0.857, SAG_KR = 0.927;
/* 짧은 이름은 **글자 크기**(200/156)가, 긴 이름은 **폭**(850)이 한계다.
   폭만 조이면 8글자가 확 쪼그라들고, 크기만 키우면 4글자가 배지와 띠를 덮는다. 둘 다 둬야 한다. */
const NAME_MAX_W = 850, NAME_LAT = 200, NAME_KR = 156;
/* 글자가 작아질수록 **블록(잉크 + 호 처짐) 한가운데**를 띠·알약 사이 한가운데로 옮긴다.
   최대 크기(=짧은 이름)에서는 t = 0 이라 지금 자리가 그대로 유지된다. */
const ARCH_BOT = ARCH_CY + ARCH_H / 2;               // 162 — 띠 아랫변
const PILL_TOP = PILL_CY - 26;                       // 332 — 알약 윗변
const NAME_GAP_MID = (ARCH_BOT + PILL_TOP) / 2;      // 247 — 그 사이의 한가운데
const NAME_RAMP = 0.25;                              // 최대 크기에서 이만큼 줄면 완전히 가운데
/* 마지막 안전선 — 잉크 꼭대기를 띠 아랫변에서 이만큼 아래로 묶는다. 종이색 테두리 12(바깥 6)가
   띠의 빨간 아랫변을 갉지 않을 만큼만 둔다. 지금 값들에서는 어떤 이름도 여기 걸리지 않는다. */
const NAME_TOP_PAD = 6;
const FOOT_CY = (FRAME_BOT + 1436) / 2;                // 메뉴 틀 아래 빈 띠(1364~1436)의 한가운데
/** 페어명 호의 길이 — 짧은 이름도 최소 곡률을 갖도록 바닥을 둔다 */
const nameLen = textW => Math.max(textW, 120) * 1.06;
/** 호의 처짐: 가운데(꼭대기) 글자와 양끝 글자의 baseline 차이 */
const arcSag = len => (len / NAME_ARC) * (1 - Math.cos(NAME_ARC / 2));
const nameArc = (sel, textW, apexY, dx, dy) =>
  arcPath(sel, nameLen(textW), NAME_ARC, apexY, dx, dy);

/* ===================== 한글 폰트 ===================== */

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

function roleOf(el) {
  for (let n = el; n && n !== poster; n = n.parentNode) {
    const c = n.getAttribute && n.getAttribute('class');
    if (c) {
      if (/\bslab\b/.test(c))   return 'PFDisplayKR';
      if (/\bscript\b/.test(c)) return 'PFHandKR';
      if (/\bcond\b/.test(c))   return 'PFSansKR';
    }
  }
  return 'PFSansKR';
}

function neededKrFonts(root = poster) {
  const need = new Set();
  for (const t of root.querySelectorAll('text, textPath')) {
    if (HANGUL.test(t.textContent)) need.add(roleOf(t));
  }
  return need;
}

const krLoaded = new Set();
/** 한글 폰트는 한 벌에 230~460KB라 실제로 쓰일 때만 받고 다시 그린다 */
async function ensureKrFonts() {
  let loaded = false;
  for (const fam of neededKrFonts()) {
    if (krLoaded.has(fam)) continue;
    krLoaded.add(fam);
    try { await document.fonts.load(`32px '${fam}'`); loaded = true; } catch {}
  }
  if (loaded) render();               // 폭을 다시 재야 배치가 맞는다
}

/* ===================== 렌더 ===================== */

function render() {
  applyTheme();

  const n1 = S.c1.name.trim() || PH.c1;
  const n2 = S.c2.name.trim() || PH.c2;

  /* --- 간판 : 띠 · 페어명 · 알약이 서로 물려 한 덩어리로 읽힌다 --- */
  // 띠 길이는 글자 폭에서 잡는다. 고정 길이로 두면 짧은 문구가 붉은 소시지 위에 뜬다
  const archT = setText('#archText', S.arch.trim() || PH.arch);
  pill('#archBg', '#archText', CENTER, ARCH_CY, 70, 96, 540, 40);
  // baseline 은 실제 글자 크기에서 잡는다. 고정값을 쓰면 글자가 줄었을 때 위로 뜬다
  archT.setAttribute('y', ARCH_CY + parseFloat(archT.style.fontSize) * 0.35);
  const starX = textWidth(archT) / 2 + 28;
  $('#archStarL').setAttribute('transform', `translate(${CENTER - starX},${ARCH_CY}) scale(.8)`);
  $('#archStarR').setAttribute('transform', `translate(${CENTER + starX},${ARCH_CY}) scale(.8)`);

  const pairText = S.pair.trim() || PH.pair;
  $('#pairName').textContent = $('#pairShadow').textContent = pairText;
  const nameT = $('#pairNameT');
  const kr = HANGUL.test(pairText);
  fitText(nameT, NAME_MAX_W, kr ? NAME_KR : NAME_LAT);
  $('#pairShadowT').style.fontSize = nameT.style.fontSize;
  // 최대 크기에서는 잉크 한가운데가 NAME_MID, 글자가 작아질수록 블록 한가운데가 NAME_GAP_MID
  const nameFs = parseFloat(nameT.style.fontSize);
  const nameInk = (kr ? CAP_KR : CAP_LAT) * nameFs;
  // 보이는 잉크의 처짐. 호 끝의 기하값을 그대로 쓰면 이름이 9 남짓 아래로 처진다
  const nameSag = arcSag(nameLen(textWidth(nameT))) * (kr ? SAG_KR : SAG_LAT);
  const nameT0 = NAME_MID + nameSag / 2;                       // 지금 자리의 블록 한가운데
  const ramp = clamp((1 - nameFs / (kr ? NAME_KR : NAME_LAT)) / NAME_RAMP, 0, 1);
  const nameBase = Math.max(nameT0 + (NAME_GAP_MID - nameT0) * ramp + (nameInk - nameSag) / 2,
                            ARCH_BOT + NAME_TOP_PAD + nameInk);
  // 글자 길이에 맞춰 반지름을 다시 잡는다. 그래야 짧든 길든 휘는 각도가 같다
  nameArc('#arc-name', textWidth(nameT), nameBase, 0, 0);
  nameArc('#arc-name-s', textWidth(nameT), nameBase, 10, 16);

  const pillT = setText('#pillText', S.pill.trim() || PH.pill);
  pill('#pillBg', '#pillText', CENTER, PILL_CY, 52, 42, 300, 34);
  $('#pillBg').setAttribute('rx', 26);
  pillT.setAttribute('y', PILL_CY + parseFloat(pillT.style.fontSize) * 0.35);

  /* --- 손글씨 덩어리 --- */
  const bd = splitLines(S.badge.trim() || PH.badge, 3);
  const bg = $('#badgeText');
  bg.textContent = '';
  bd.forEach((line, i) => {
    const t = svgEl('text', { x: 872, y: 160 - (bd.length - 1) * 14 + i * 28 + 8, 'text-anchor': 'middle', 'letter-spacing': 1.6 });
    t.textContent = line;
    bg.appendChild(t);
    fitText(t, 118, 21);
  });

  /* --- 캐릭터 --- */
  for (const [key, def] of [['c1', PH.c1], ['c2', PH.c2]]) {
    const n = key === 'c1' ? 1 : 2;
    setText(`#c${n}Name`, S[key].name.trim() || def);
    fitText($(`#c${n}NameT`), 172, 30);   // 호 길이(196)를 넘지 않게
  }

  /* --- 메뉴 --- */
  renderMenu(n1, n2);

  /* --- 가운데 그림 액자 : 물결 매트를 깔고 사진을 그만큼 안으로 넣는다 --- */
  // display 는 반드시 값으로 지정한다. ''(인라인 해제)로 두면 스타일시트 규칙이 이긴다
  const fr = S.frame ? 'inline' : 'none';
  const inset = S.frame ? PHOTO_INSET : 0;
  const box = FRAMES.main.box;
  box.x = PHOTO_BOX.x + inset;
  box.y = PHOTO_BOX.y + inset;
  box.w = PHOTO_BOX.w - inset * 2;
  box.h = PHOTO_BOX.h - inset * 2;
  setRect($('#clip-photo').firstElementChild, box);
  setRect($('#photoHit'), { ...box, h: FRAME_TOP - box.y });   // 메뉴 틀에 가린 데는 끌 수 없다
  setRect($('#photoKey'), box);
  const TOOTH = 10;
  const matD = receiptPath(PHOTO_BOX, 22, TOOTH);
  $('#photoMat').setAttribute('d', matD);
  $('#photoMatSh').setAttribute('d', matD);        // 영수증이 종이에서 떠 보이게 하는 옅은 그림자
  // 뜯긴 자리 바로 아래의 점선 — 영수증이라는 신호는 이 한 줄이 제일 크다
  const py = PHOTO_BOX.y + TOOTH + 11;
  $('#photoPerf').setAttribute('d', `M${PHOTO_BOX.x + 16} ${py} H${PHOTO_BOX.x + PHOTO_BOX.w - 16}`);
  for (const sel of ['#photoMatSh', '#photoMat', '#photoPerf', '#photoKey'])
    $(sel).style.display = fr;

  /* --- 바닥 장식 : 별은 글자 폭을 재서 양옆에 붙인다 --- */
  // 글자 상자를 재서 띠 한가운데에 맞춘다. baseline 을 박아 두면 손글씨의 위아래 여백이 어긋난다
  const foot = $('#footNote');
  foot.setAttribute('y', FOOT_CY);
  const fb = foot.getBBox();
  foot.setAttribute('y', FOOT_CY + (FOOT_CY - (fb.y + fb.height / 2)));
  const footW = textWidth(foot);
  for (const [sel, sgn] of [['#footStarL', -1], ['#footStarR', 1]]) {
    $(sel).setAttribute('transform', `translate(${CENTER + sgn * (footW / 2 + 26)},${FOOT_CY}) scale(.9)`);
  }

  Object.keys(FRAMES).forEach(placeFrame);
  SLOTS.forEach(s => placeSticker(s.k));
  save();
  ensureKrFonts();
}

function renderMenu(n1, n2) {
  const root = $('#menu');
  root.textContent = '';

  MENU.forEach((col, ci) => {
    const g = root;
    const { x0, x1 } = COLS[ci];
    const cx = (x0 + x1) / 2;
    let y = MENU_TOP;

    for (const sec of col) {
      const headCy = y + HEAD_MID;                 // 머리 높이가 달라도 중심은 늘 같다
      const hh = drawHead(g, sec, cx + (sec.dx || 0), x1 - x0 - 48, y, ci);
      y += hh + HEAD_GAP;

      sec.rows.forEach(([name, price], i) => {
        const by = y + i * ROW_PITCH;
        const isPair = name === '@pair';
        const label = isPair ? (S.set.trim() || `${n1} + ${n2}`) : name;
        const cost  = isPair ? (S.setp.trim() || PH.setp) : price;

        const nt = svgEl('text', { class: 'cond ' + (isPair ? 'f-red' : 'f-ink'), x: x0, y: by, 'letter-spacing': .6 });
        nt.textContent = label;
        g.appendChild(nt);
        fitText(nt, x1 - x0 - 70, 19);

        const pt = svgEl('text', { class: 'cond f-red', x: x1, y: by, 'text-anchor': 'end', 'letter-spacing': .6 });
        pt.textContent = cost;
        g.appendChild(pt);
        fitText(pt, 64, 19);

        const l = x0 + textWidth(nt) + 8, r = x1 - textWidth(pt) - 8;
        if (r - l > 14) {
          g.appendChild(svgEl('path', {
            class: 's-red', d: `M${l} ${by - 5} H${r}`, fill: 'none',
            'stroke-width': 1.6, 'stroke-dasharray': '1.5 5', 'stroke-linecap': 'round', opacity: .55,
          }));
        }
      });

      /* 상자는 이 섹션 하나만 두른다. 윗변이 간판 한가운데에서 시작해 마지막 줄 아래로 닫힌다 —
         간판이 상자에 얹힌 것처럼 보인다. 아래 DRINKS 는 상자 밖이다. */
      if (sec.box) {
        const last = y + (sec.rows.length - 1) * ROW_PITCH;
        setRect($('#midBox'), { x: 354, y: headCy, w: 292, h: last + BOX_PAD - headCy });
      }
      y += (sec.rows.length - 1) * ROW_PITCH + SEC_GAP + (sec.box ? BOX_GAP : 0);
    }
  });
}

/** 간판 모양 : 모서리는 둥글고 위아래 변이 bow 만큼 부푼 사각형 */
function plaque(x1, y1, x2, y2, bow) {
  const cx = (x1 + x2) / 2, r = 9;
  return `M${x1} ${y1 + r}` +
    ` Q${x1} ${y1} ${x1 + r} ${y1}` +
    ` Q${cx} ${y1 - bow} ${x2 - r} ${y1}` +
    ` Q${x2} ${y1} ${x2} ${y1 + r}` +
    ` L${x2} ${y2 - r}` +
    ` Q${x2} ${y2} ${x2 - r} ${y2}` +
    ` Q${cx} ${y2 + bow} ${x1 + r} ${y2}` +
    ` Q${x1} ${y2} ${x1} ${y2 - r} Z`;
}

/* 섹션 머리. 모양을 네 가지로 나눠 같은 알약이 여섯 번 반복되지 않게 한다.
   glyph 는 글자 크기에서 baseline 을 잡는다(고정값을 쓰면 두 줄짜리가 위로 뜬다). */
function drawHead(g, sec, cx, maxW, top, ci) {
  const lines = sec.title.split('/').map(t => t.trim());
  const two = lines.length > 1;
  const h = sec.style === 'plaque' ? 76 : sec.style === 'ribbon' ? 42 : 38;
  // 높이가 달라도 중심은 HEAD_MID 로 같다. 안 그러면 큰 머리만 아래로 처져 보인다
  const cy = top + HEAD_MID;
  const base = sec.style === 'plaque' ? 25 : 22;

  const shape = svgEl('path', { class: 'f-red' });
  g.appendChild(shape);

  const texts = lines.map((line, i) => {
    const t = svgEl('text', { class: 'cond f-on-red', x: cx, 'text-anchor': 'middle', 'letter-spacing': 2 });
    t.textContent = line;
    g.appendChild(t);
    fitText(t, maxW, base);
    return t;
  });
  const fs = parseFloat(texts[0].style.fontSize);
  texts.forEach((t, i) => {
    const off = two ? (i - 0.5) * (fs + 9) : 0;
    t.setAttribute('y', cy + off + fs * 0.35);
  });

  const tw = Math.max(...texts.map(textWidth));
  const w = tw + (sec.style === 'plaque' ? 72 : sec.style === 'ribbon' ? 52 : 36);
  const x1 = cx - w / 2, x2 = cx + w / 2, y1 = cy - h / 2, y2 = cy + h / 2;
  const rr = 5;

  if (sec.style === 'plaque') {
    // 위아래가 살짝 부푼 간판. 안쪽에 종이색 괘선을 한 줄 더 둘러 간판처럼 보이게 한다
    shape.setAttribute('d', plaque(x1, y1, x2, y2, 9));
    const inner = svgEl('path', { class: 's-paper', fill: 'none', 'stroke-width': 2.2, opacity: .55 });
    inner.setAttribute('d', plaque(x1 + 7, y1 + 6, x2 - 7, y2 - 6, 7));
    g.appendChild(inner);
    for (const sgn of [-1, 1]) {
      const u = svgEl('use', { class: 'f-accent', transform: `translate(${cx + sgn * (w / 2 - 20)},${cy}) scale(.58)` });
      u.setAttribute('href', '#ic-star');
      g.appendChild(u);
    }
  } else if (sec.style === 'ribbon') {
    const n = 15;
    shape.setAttribute('d',
      `M${x1} ${y1} H${x2} L${x2 + n} ${cy} L${x2} ${y2} H${x1} L${x1 - n} ${cy} Z`);
  } else {
    shape.setAttribute('d',
      `M${x1 + rr} ${y1} H${x2 - rr} q${rr} 0 ${rr} ${rr} V${y2 - rr} q0 ${rr} ${-rr} ${rr} H${x1 + rr} q${-rr} 0 ${-rr} ${-rr} V${y1 + rr} q0 ${-rr} ${rr} ${-rr} Z`);
    if (sec.style === 'slant') {
      const rot = `rotate(${ci === 0 ? -1.4 : 1.4} ${cx} ${cy})`;
      shape.setAttribute('transform', rot);
      texts.forEach(t => t.setAttribute('transform', rot));
    }
  }
  return HEAD_MID + h / 2;
}

function placeFrame(key) {
  const f = FRAMES[key], p = framePic(key);
  const img = $(f.img), hint = $(f.hint), box = f.box;

  // display 는 반드시 값으로 지정한다. ''(인라인 해제)로 두면 스타일시트 규칙이 이겨버린다.
  if (!p.src || !p.nw || !p.nh) {
    img.style.display = 'none';
    img.removeAttribute('href');
    hint.style.display = 'inline';
    return;
  }
  hint.style.display = 'none';
  if (img.getAttribute('href') !== p.src) img.setAttribute('href', p.src);

  const s = Math.max(box.w / p.nw, box.h / p.nh) * p.zoom;
  const w = p.nw * s, h = p.nh * s;
  p.ox = clamp(p.ox, -(w - box.w) / 2, (w - box.w) / 2);
  p.oy = clamp(p.oy, -(h - box.h) / 2, (h - box.h) / 2);

  img.setAttribute('x', box.x + (box.w - w) / 2 + p.ox);
  img.setAttribute('y', box.y + (box.h - h) / 2 + p.oy);
  img.setAttribute('width', w);
  img.setAttribute('height', h);
  img.style.display = 'inline';
}

function placeSticker(k) {
  const st = S.stickers[k], slot = SLOT_BY_K[k], box = slot.box;
  const img = $('#img-' + k), hit = $('#hit-' + k);
  const src = st.src || slot.art;

  if (img.getAttribute('href') !== src) img.setAttribute('href', src);

  st.dx = clamp(st.dx, -box.cx, POSTER_W - box.cx);
  st.dy = clamp(st.dy, -box.cy, POSTER_H - box.cy);

  const w = box.w * st.scale, h = box.h * st.scale;
  const x = box.cx - w / 2 + st.dx, y = box.cy - h / 2 + st.dy;
  for (const el of [img, hit]) {
    el.setAttribute('x', x); el.setAttribute('y', y);
    el.setAttribute('width', w); el.setAttribute('height', h);
  }
  img.style.display = 'inline';
  hit.style.display = 'inline';
}

/* ===================== 저장(로컬) ===================== */

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

function saveNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
  } catch {
    // 이미지까지 넣으면 용량을 넘길 수 있다. 텍스트/색상만이라도 남긴다.
    try {
      const strip = p => ({ ...p, src: null });
      localStorage.setItem(STORE_KEY, JSON.stringify({
        ...S,
        photo: strip(S.photo),
        c1: { ...S.c1, img: strip(S.c1.img) },
        c2: { ...S.c2, img: strip(S.c2.img) },
        stickers: Object.fromEntries(Object.entries(S.stickers).map(([k, v]) => [k, strip(v)])),
      }));
    } catch {}
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw), base = defaults();
    const ch = k => ({ ...newChar(), ...(d[k] || {}), img: { ...newPic(), ...((d[k] || {}).img || {}) } });
    S = {
      ...base, ...d,
      c1: ch('c1'), c2: ch('c2'),
      photo: { ...newPic(), ...(d.photo || {}) },
      stickers: Object.fromEntries(SLOTS.map(s =>
        [s.k, { ...newSticker(), ...((d.stickers || {})[s.k] || {}) }])),
      colors: { ...base.colors, ...(d.colors || {}) },
    };
  } catch {}
}

/* ===================== 이미지 입력 ===================== */

function readImage(file, maxSide, png) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const im = new Image();
      im.onerror = rej;
      im.onload = () => {
        const sc = Math.min(1, maxSide / Math.max(im.width, im.height));
        const w = Math.max(1, Math.round(im.width * sc));
        const h = Math.max(1, Math.round(im.height * sc));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(im, 0, 0, w, h);
        res({ src: cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.92), w, h });
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ===================== 드래그 / 핀치 ===================== */

/* 모바일 사파리는 SVG 요소의 touch-action 을 무시할 때가 있어, 끄는 동안에는
   touchmove 를 직접 막아 화면이 따라 스크롤되지 않게 한다. */
let dragging = false;
poster.addEventListener('touchmove', e => { if (dragging) e.preventDefault(); }, { passive: false });

function svgPoint(e) {
  const r = poster.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * POSTER_W, y: (e.clientY - r.top) / r.height * POSTER_H };
}

function bindGesture(hit, { active, onDrag, onScale, onEnd }) {
  const pts = new Map();
  let last = null, pinch = 0;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

  hit.addEventListener('pointerdown', e => {
    if (!active()) return;
    hit.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, svgPoint(e));
    dragging = true;
    if (pts.size === 1) last = svgPoint(e);
    if (pts.size === 2) pinch = dist();
  });

  hit.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    e.preventDefault();
    pts.set(e.pointerId, svgPoint(e));
    if (pts.size >= 2) {
      const d = dist();
      if (pinch > 0 && d > 0) onScale(d / pinch);
      pinch = d;
      return;
    }
    const p = svgPoint(e);
    onDrag(p.x - last.x, p.y - last.y);
    last = p;
  });

  const end = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    pinch = 0;
    if (pts.size === 1) last = [...pts.values()][0];
    if (pts.size === 0) { dragging = false; onEnd(); }
  };
  hit.addEventListener('pointerup', end);
  hit.addEventListener('pointercancel', end);

  hit.addEventListener('wheel', e => {
    if (!active()) return;
    e.preventDefault();
    onScale(1 - e.deltaY * 0.0015);
    onEnd();
  }, { passive: false });
}

function setZoom(key, z) {
  const p = framePic(key);
  p.zoom = clamp(z, 1, 4);
  const pct = Math.round(p.zoom * 100);
  const sl = key === 'main' ? $('#in-zoom') : $(`[data-zoom="${key}"]`);
  const lb = key === 'main' ? $('#lbl-zoom') : $(`[data-zl="${key}"]`);
  if (sl) sl.value = pct;
  if (lb) lb.textContent = pct + '%';
  placeFrame(key);
  save();
}

function setStickerScale(k, v) {
  const st = S.stickers[k];
  st.scale = clamp(v, 0.3, 3);
  const sl = $(`[data-scale="${k}"]`);
  if (sl) sl.value = Math.round(st.scale * 100);
  placeSticker(k);
  save();
}

function initGestures() {
  for (const key of Object.keys(FRAMES)) {
    bindGesture($(FRAMES[key].hit), {
      active: () => !!framePic(key).src,
      onDrag: (dx, dy) => { const p = framePic(key); p.ox += dx; p.oy += dy; placeFrame(key); },
      onScale: r => setZoom(key, framePic(key).zoom * r),
      onEnd: save,
    });
  }
  for (const { k } of SLOTS) {
    // 기본 그림은 고정. 사용자가 교체한 그림만 끌어 옮길 수 있다
    bindGesture($('#hit-' + k), {
      active: () => !!S.stickers[k].src,
      onDrag: (dx, dy) => { S.stickers[k].dx += dx; S.stickers[k].dy += dy; placeSticker(k); },
      onScale: r => setStickerScale(k, S.stickers[k].scale * r),
      onEnd: save,
    });
  }
}

/* ===================== PNG 저장 ===================== */

const FONT_FILES = {
  PFSlab:      'fonts/AlfaSlabOne-400.woff2',
  PFScript:    'fonts/Yellowtail-400.woff2',
  PFCond:      'fonts/Oswald-600.woff2',
  PFDisplayKR: 'fonts/Jua-KR.woff2',
  PFHandKR:    'fonts/Gaegu-KR.woff2',
  PFSansKR:    'fonts/GothicA1-KR.woff2',
};
const LATIN_FONTS = ['PFSlab', 'PFScript', 'PFCond'];
const fontCache = new Map();
const artCache = new Map();

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function faceCss(fam) {
  if (fontCache.has(fam)) return fontCache.get(fam);
  let css = '';
  try {
    const buf = await (await fetch(FONT_FILES[fam])).arrayBuffer();
    css = `@font-face{font-family:'${fam}';src:url(data:font/woff2;base64,${toBase64(buf)}) format('woff2')}`;
  } catch {}
  fontCache.set(fam, css);
  return css;
}

/** 라틴 3종은 항상, 한글 폰트는 실제로 쓰인 것만 심는다 */
async function fontCss(clone) {
  const fams = [...LATIN_FONTS, ...neededKrFonts(clone)];
  return (await Promise.all(fams.map(faceCss))).join('');
}

/** 기본 음식 그림은 파일 참조라 저장본에 그대로 담기지 않는다. data URI 로 바꿔 심는다 */
async function inlineArt(clone) {
  for (const img of clone.querySelectorAll('image')) {
    const href = img.getAttribute('href') || '';
    if (!href || href.startsWith('data:')) continue;
    if (!artCache.has(href)) {
      try {
        const buf = await (await fetch(href)).arrayBuffer();
        artCache.set(href, 'data:image/png;base64,' + toBase64(buf));
      } catch { artCache.set(href, ''); }
    }
    const d = artCache.get(href);
    if (d) img.setAttribute('href', d); else img.remove();
  }
}

/** XML은 주석 안의 연속 하이픈을 허용하지 않아 직렬화 전에 주석을 걷어낸다 */
function stripComments(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const dead = [];
  while (w.nextNode()) dead.push(w.currentNode);
  dead.forEach(n => n.remove());
}

function loadSvgImage(xml) {
  const tryLoad = url => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('svg load failed'));
    img.src = url;
  });
  const blobUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  return tryLoad(blobUrl)
    .then(img => { URL.revokeObjectURL(blobUrl); return img; })
    .catch(() => {
      URL.revokeObjectURL(blobUrl);
      return tryLoad('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml));
    });
}

async function exportPNG() {
  const btn = $('#btn-save');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '저장 준비 중…';

  try {
    await document.fonts.ready;

    const clone = poster.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('width', POSTER_W * EXPORT_SCALE);
    clone.setAttribute('height', POSTER_H * EXPORT_SCALE);
    clone.querySelectorAll('#photoHit, #c1Hit, #c2Hit, .slot-hit').forEach(n => n.remove());
    await inlineArt(clone);
    $('#theme-style', clone).textContent = await fontCss(clone) + themeCss();
    stripComments(clone);

    const xml = new XMLSerializer().serializeToString(clone);
    const img = await loadSvgImage(xml);

    const cv = document.createElement('canvas');
    cv.width = POSTER_W * EXPORT_SCALE;
    cv.height = POSTER_H * EXPORT_SCALE;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = S.colors.paper;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);

    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    if (!blob) throw new Error('toBlob failed');

    const name = (S.pair.trim() || 'pairframe')
      .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'pairframe';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`저장했어요 (${cv.width}×${cv.height})`);
  } catch (err) {
    console.error(err);
    toast('저장에 실패했어요. 새로고침 후 다시 시도해 주세요.');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

/* ===================== UI ===================== */

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/** 'c1.name' 같은 경로로 상태를 읽고 쓴다 */
const getPath = p => p.split('.').reduce((o, k) => o[k], S);
const setPath = (p, v) => { const ks = p.split('.'); ks.slice(0, -1).reduce((o, k) => o[k], S)[ks.at(-1)] = v; };

function buildCharUI() {
  for (const key of ['c1', 'c2']) {
    const box = $(`[data-char="${key}"]`);
    box.innerHTML = `
      <div class="btn-row">
        <button class="btn" type="button" data-pick-img="${key}">사진 올리기</button>
        <button class="btn ghost" type="button" data-clear-img="${key}">지우기</button>
      </div>
      <label class="fld range"><span>사진 확대 <b data-zl="${key}">100%</b></span>
        <input type="range" min="100" max="400" step="1" value="100" data-zoom="${key}"></label>
      <label class="fld"><span>이름</span>
        <input type="text" maxlength="14" data-f="${key}.name"
               placeholder="${key === 'c1' ? PH.c1 : PH.c2}"></label>`;
  }
}

let pendingSlot = null, pendingChar = null;

function buildStickerUI() {
  const wrap = $('#sticker-list');
  wrap.innerHTML = SLOTS.map(({ k, name, art }) => `
    <div class="sticker">
      <div class="nm">${name}</div>
      <div class="thumb" data-thumb="${k}"><img src="${art}" alt=""></div>
      <label class="szrow" data-sz="${k}">
        <span>크기</span>
        <input type="range" min="30" max="300" step="1" value="100" data-scale="${k}">
      </label>
      <div class="row">
        <button class="btn" type="button" data-slot="${k}">교체</button>
        <button class="btn ghost" type="button" data-reset="${k}">되돌리기</button>
      </div>
    </div>`).join('');

  // 파일 입력은 하나만 두고 눌린 칸을 기억한다. label 안에 input 을 겹쳐 두면
  // 모바일 브라우저에서 선택창이 두 번 열리거나 아예 안 열리는 일이 있다.
  wrap.addEventListener('click', e => {
    const pick = e.target.closest('[data-slot]');
    if (pick) { pendingSlot = pick.dataset.slot; $('#in-sticker').click(); return; }
    const reset = e.target.closest('[data-reset]');
    if (reset) { S.stickers[reset.dataset.reset] = newSticker(); render(); updateStickerCards(); }
  });
  wrap.addEventListener('input', e => {
    const k = e.target.dataset.scale;
    if (k) setStickerScale(k, +e.target.value / 100);
  });

  $('#in-sticker').addEventListener('change', async e => {
    const f = e.target.files[0], k = pendingSlot;
    e.target.value = ''; pendingSlot = null;
    if (!f || !k) return;
    try {
      const { src } = await readImage(f, 900, true);
      S.stickers[k] = { ...newSticker(), src };
      render(); updateStickerCards();
    } catch { toast('이미지를 읽지 못했어요.'); }
  });
}

function updateStickerCards() {
  for (const { k, art } of SLOTS) {
    const st = S.stickers[k];
    $(`[data-thumb="${k}"]`).innerHTML = `<img src="${st.src || art}" alt="">`;
    $(`[data-scale="${k}"]`).value = Math.round(st.scale * 100);
  }
}

function buildColorUI() {
  $('#color-list').innerHTML = COLORS.map(({ k, name }) =>
    `<div class="color"><label for="col-${k}">${name}</label><input id="col-${k}" type="color" data-col="${k}"></div>`).join('');
  $('#color-list').addEventListener('input', e => {
    const k = e.target.dataset.col;
    if (!k) return;
    S.colors[k] = e.target.value;
    render();
  });

  $('#presets').innerHTML = PRESETS.map((p, i) =>
    `<button type="button" class="preset" data-preset="${i}">
       <i style="background:${p.c.red}"></i><i style="background:${p.c.green}"></i><i style="background:${p.c.paper}"></i>${p.name}
     </button>`).join('');
  $('#presets').addEventListener('click', e => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    S.colors = { ...PRESETS[+b.dataset.preset].c };
    syncColorInputs();
    render();
  });
}

const syncColorInputs = () => COLORS.forEach(({ k }) => { $('#col-' + k).value = S.colors[k]; });

const TEXT_FIELDS = ['pair', 'arch', 'pill', 'badge'];

function syncInputs() {
  TEXT_FIELDS.forEach(k => { $('#in-' + k).value = S[k]; });
  $('#in-set').value = S.set;
  $('#in-setp').value = S.setp;
  $('#in-frame').checked = !!S.frame;
  $$('[data-f]').forEach(el => { el.value = getPath(el.dataset.f); });
  ['main', 'c1', 'c2'].forEach(k => setZoom(k, framePic(k).zoom));
  syncColorInputs();
  updateStickerCards();
}

/* ===================== 초기화 ===================== */

function bindText(sel, set) {
  $(sel).addEventListener('input', e => { set(e.target.value); render(); });
}

async function init() {
  load();

  buildCharUI();
  buildStickerUI();
  buildColorUI();
  syncInputs();

  TEXT_FIELDS.forEach(k => bindText('#in-' + k, v => { S[k] = v; }));
  bindText('#in-set',  v => { S.set = v; });
  bindText('#in-setp', v => { S.setp = v; });

  // 캐릭터 입력은 위임으로 한 번에 받는다
  $('.panel').addEventListener('input', e => {
    const f = e.target.dataset.f, z = e.target.dataset.zoom;
    if (f) { setPath(f, e.target.value); render(); }
    else if (z) setZoom(z, +e.target.value / 100);
  });

  // 사진 (가운데 + 캐릭터 2장) : 숨긴 입력 하나를 공유한다
  $('#btn-photo-pick').addEventListener('click', () => { pendingChar = 'main'; $('#in-photo').click(); });
  $('.panel').addEventListener('click', e => {
    const pick = e.target.closest('[data-pick-img]');
    if (pick) { pendingChar = pick.dataset.pickImg; $('#in-photo').click(); return; }
    const clear = e.target.closest('[data-clear-img]');
    if (clear) {
      S[clear.dataset.clearImg].img = newPic();
      setZoom(clear.dataset.clearImg, 1);
      render();
    }
  });
  $('#in-photo').addEventListener('change', async e => {
    const f = e.target.files[0], key = pendingChar || 'main';
    e.target.value = ''; pendingChar = null;
    if (!f) return;
    try {
      const big = key === 'main';
      const { src, w, h } = await readImage(f, big ? 2000 : 1100, true);
      const pic = { ...newPic(), src, nw: w, nh: h };
      if (big) S.photo = pic; else S[key].img = pic;
      setZoom(key, 1);
      render();
    } catch { toast('사진을 읽지 못했어요.'); }
  });
  $('#btn-photo-clear').addEventListener('click', () => { S.photo = newPic(); setZoom('main', 1); render(); });
  $('#btn-photo-reset').addEventListener('click', () => {
    S.photo.ox = S.photo.oy = 0;
    setZoom('main', 1);
  });
  $('#in-zoom').addEventListener('input', e => setZoom('main', +e.target.value / 100));
  $('#in-frame').addEventListener('change', e => { S.frame = e.target.checked; render(); });

  $('#btn-color-reset').addEventListener('click', () => {
    S.colors = defaults().colors;
    syncColorInputs();
    render();
  });
  $('#btn-reset-all').addEventListener('click', () => {
    if (!confirm('모든 입력과 사진을 초기화할까요?')) return;
    S = defaults();
    syncInputs();
    render();
  });
  $('#btn-save').addEventListener('click', exportPNG);

  initGestures();
  addEventListener('pagehide', saveNow);   // 지연 저장이 남아 있으면 떠나기 전에 비운다

  // 라틴 폰트가 준비된 뒤 렌더해야 글자 폭 측정이 정확하다. (한글은 쓰일 때만 받는다)
  try {
    await Promise.all([
      document.fonts.load("140px 'PFSlab'"),
      document.fonts.load("40px 'PFScript'"),
      document.fonts.load("19px 'PFCond'"),
    ]);
  } catch {}
  render();
}

init();

})();
