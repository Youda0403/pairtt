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
const STORE_KEY = 'pairframe.v3';

const poster = $('#poster');

/* ===================== 정의 ===================== */

/* 사진이 들어가는 세 자리. box 는 index.html 의 clip-path / hit 사각형과 같아야 한다. */
const FRAMES = {
  main: { box: { x: 482, y: 280, w: 442, h: 294 }, img: '#photoImg', hint: '#photoHint', hit: '#photoHit' },
  c1:   { box: { x:  64, y: 832, w: 168, h: 236 }, img: '#c1Img',    hint: '#c1Hint',    hit: '#c1Hit'    },
  c2:   { box: { x: 522, y: 832, w: 168, h: 236 }, img: '#c2Img',    hint: '#c2Hint',    hit: '#c2Hit'    },
};
const framePic = k => (k === 'main' ? S.photo : S[k].img);

/* 교체 가능한 일러스트. box = 교체 이미지가 놓이는 기본 자리(중심과 크기) */
const SLOTS = [
  { k: 'shake',  name: '밀크셰이크', box: { cx: 440, cy: 470, w: 130, h: 240 } },
  { k: 'fries',  name: '감자튀김',   box: { cx: 896, cy: 566, w:  84, h: 118 } },
  { k: 'burger', name: '햄버거',     box: { cx: 154, cy: 1324, w: 164, h: 150 } },
];
const SLOT_BY_K = Object.fromEntries(SLOTS.map(s => [s.k, s]));

const COLORS = [
  { k: 'paper',  name: '종이 (크림)',       def: '#F7EEDB' },
  { k: 'red',    name: '메인 레드',         def: '#D9362E' },
  { k: 'green',  name: '서브 그린',         def: '#276B4A' },
  { k: 'p1',     name: '캐릭터 01 (핑크)',  def: '#E56B7D' },
  { k: 'p2',     name: '캐릭터 02 (블루)',  def: '#4E91C9' },
  { k: 'accent', name: '포인트 (옐로)',     def: '#F2B84B' },
];

const PRESETS = [
  { name: '클래식', c: { paper:'#F7EEDB', red:'#D9362E', green:'#276B4A', p1:'#E56B7D', p2:'#4E91C9', accent:'#F2B84B' } },
  { name: '소다',   c: { paper:'#F3F6F2', red:'#E2607B', green:'#2F7E8C', p1:'#E8798F', p2:'#5C93C9', accent:'#F0BE55' } },
  { name: '나이트', c: { paper:'#2A2A33', red:'#EFC7A8', green:'#8FC7A4', p1:'#EE8FA6', p2:'#7FB8E8', accent:'#F0C766' } },
];

/* 캐릭터 한 항목이 쓰는 폭. x 는 항목 시작, dx 는 초상 오른쪽 글자 블록의 시작 */
const COL_W = 414, DET_W = 226;
const CHARS = [
  { key: 'c1', n: 1, x:  64, dx: 252 },
  { key: 'c2', n: 2, x: 522, dx: 710 },
];
const MENU_DEF = ['LOVE', 'LAUGHTER', 'GOOD FOOD', 'YOU & ME'];

const newSticker = () => ({ src: null, scale: 1, dx: 0, dy: 0 });
const newPic     = () => ({ src: null, nw: 0, nh: 0, zoom: 1, ox: 0, oy: 0 });
const newChar    = () => ({ name: '', age: '', job: '', like: '', order: '', img: newPic() });

const defaults = () => ({
  pair: '', sub: '', est: '', tag: '', always: '', foot: '', note: '',
  menu: ['', '', '', ''],
  c1: newChar(),
  c2: newChar(),
  photo: newPic(),
  stickers: Object.fromEntries(SLOTS.map(s => [s.k, newSticker()])),
  colors: Object.fromEntries(COLORS.map(c => [c.k, c.def])),
});

let S = defaults();

const PH = {
  pair: 'Pairname', sub: 'DINER & GRILL', est: '20XX',
  tag: 'GOOD FOOD • GOOD FRIENDS • BETTER DAYS',
  always: 'ALWAYS TOGETHER', foot: 'ALWAYS TOGETHER, ALWAYS HUNGRY',
  note: 'Same table / Different worlds / One story',
  c1: 'character 1', c2: 'character 2',
  demo: {
    c1: { age: '26', job: 'BARISTA',  like: 'Cheeseburger' },
    c2: { age: '28', job: 'DESIGNER', like: 'Strawberry shake' },
  },
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

/** 사진 자리에 깔리는 연한 그린 (서브 그린에서 뽑는다) */
function lightOf(hex) {
  const [h, s] = rgb2hsl(hex);
  return lum(hex) > 0.6 ? hsl2hex(h, clamp(s, 0.15, 0.5), 0.34)
                        : hsl2hex(h, clamp(s * 0.75, 0.2, 0.45), 0.77);
}
/** 카드·티켓에 쓰는, 배경보다 한 톤 밝은 종이색 */
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
const F_DISP = "'PFDisplay','PFDisplayKR','Apple SD Gothic Neo','Malgun Gothic',cursive";
const F_HAND = "'PFHand','PFHandKR','Apple SD Gothic Neo','Malgun Gothic',cursive";
const F_SANS = "'PFSans','PFSansKR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";

function themeCss() {
  const c = S.colors;
  const sheet  = sheetOf(c.paper);
  const glight = lightOf(c.green);
  return `
.disp{font-family:${F_DISP}}
.hand{font-family:${F_HAND}}
.sans{font-family:${F_SANS}}
.f-paper{fill:${c.paper}}.f-sheet{fill:${sheet}}.f-ink{fill:${inkOf(c.paper)}}
.f-red{fill:${c.red}}.f-green{fill:${c.green}}.f-glight{fill:${glight}}
.f-p1{fill:${c.p1}}.f-p2{fill:${c.p2}}.f-accent{fill:${c.accent}}
.f-on-red{fill:${onColor(c.red, sheet)}}.f-on-green{fill:${onColor(c.green, sheet)}}
.f-on-p1{fill:${onColor(c.p1, sheet)}}.f-on-p2{fill:${onColor(c.p2, sheet)}}
.f-bun{fill:#EFB85C}.f-patty{fill:#8A4A29}.f-cheese{fill:#F5C33F}
.f-lettuce{fill:#8AC169}.f-sesame{fill:#FFF4E0}.f-fry{fill:#F3BE4A}
.s-food{stroke:#9C552A}
.f-grain{fill:${grainOf(c.paper)};opacity:.13}
.s-paper{stroke:${c.paper}}.s-red{stroke:${c.red}}.s-green{stroke:${c.green}}
.s-p1{stroke:${c.p1}}.s-p2{stroke:${c.p2}}
`;
}

function applyTheme() { $('#theme-style').textContent = themeCss(); }

/* ===================== 텍스트 / 배너 ===================== */

const textWidth = el => { try { return el.getComputedTextLength(); } catch { return 0; } };

function fitText(el, maxW, baseSize) {
  el.style.fontSize = baseSize + 'px';
  const w = textWidth(el);
  if (w > maxW && w > 0) el.style.fontSize = Math.max(8, baseSize * maxW / w) + 'px';
}

const setText = (sel, str) => { $(sel).textContent = str; return $(sel); };

/** 왼쪽 기둥에 물려 오른쪽 끝만 뾰족한 깃발 */
function tab(pathSel, x1, cy, w, h) {
  const x2 = x1 + w, n = h * 0.45;
  $(pathSel).setAttribute('d',
    `M${x1} ${cy - h / 2} H${x2} L${x2 + n} ${cy} L${x2} ${cy + h / 2} H${x1} Z`);
}

/** 글자 폭에 맞춰 깃발을 그린다. minW 를 주면 그만큼은 반드시 뻗는다(사진에 닿게) */
function tabLabel(pathSel, textSel, x1, cy, h, textX, minW = 0) {
  tab(pathSel, x1, cy, Math.max(textX - x1 + textWidth($(textSel)) + 16, minW), h);
}

/* ===================== 한글 폰트 ===================== */

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

function roleOf(el) {
  for (let n = el; n && n !== poster; n = n.parentNode) {
    const c = n.getAttribute && n.getAttribute('class');
    if (c) {
      if (/\bdisp\b/.test(c)) return 'PFDisplayKR';
      if (/\bhand\b/.test(c)) return 'PFHandKR';
      if (/\bsans\b/.test(c)) return 'PFSansKR';
    }
  }
  return 'PFSansKR';
}

function neededKrFonts(root = poster) {
  const need = new Set();
  for (const t of root.querySelectorAll('text')) {
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

  const pair = S.pair.trim() || PH.pair;
  const n1   = S.c1.name.trim() || PH.c1;
  const n2   = S.c2.name.trim() || PH.c2;

  /* --- 머리 괘선 + 로고 락업 --- */
  fitText(setText('#tagLine', S.tag.trim() || PH.tag), 600, 16);
  fitText(setText('#estYear', S.est.trim() || PH.est), 84, 30);

  const main = $('#pairName'), shadow = $('#pairShadow');
  main.textContent = shadow.textContent = pair;
  fitText(main, 640, 104);
  shadow.style.fontSize = main.style.fontSize;

  // 부제 뒤로 괘선이 오른쪽 끝까지 이어져 머리 덩어리를 한 장으로 묶는다
  const sub = setText('#bn-sub-t', S.sub.trim() || PH.sub);
  fitText(sub, 420, 17);
  const subEnd = 68 + textWidth(sub) + 20;
  $('#bn-sub-r').setAttribute('d', subEnd < 900 ? `M${subEnd} 244 H936` : '');

  // TODAY'S SPECIAL 깃발은 최소 388 을 뻗어 끝이 사진 테두리(470)에 닿는다
  tabLabel('#bn-sp-p', '#bn-sp-t', 64, 318, 44, 110, 388);
  tabLabel('#bn-pr-p', '#bn-pr-t', 64, 640, 40, 110);
  tabLabel('#bn-mn-p', '#bn-mn-t', 64, 1140, 38, 110);

  /* --- 캐릭터 : 메뉴판의 한 항목처럼 --- */
  for (const { key, n, x, dx } of CHARS) {
    const c = S[key], demo = PH.demo[key];
    const self  = key === 'c1' ? n1 : n2;
    const other = key === 'c1' ? n2 : n1;

    tabLabel(`#bn-c${n}-p`, `#bn-c${n}-t`, x, 700, 32, x + 32);
    fitText(setText(`#c${n}Name`, self), COL_W, 44);

    // 나이와 직업은 한 줄로 붙인다. 둘 다 비면 예시를 보여 준다
    const meta = [c.age.trim(), c.job.trim()].filter(Boolean).join('  ·  ');
    fitText(setText(`#c${n}Meta`, meta || `${demo.age}  ·  ${demo.job}`), COL_W, 15);

    fitText(setText(`#c${n}Like`, c.like.trim() || demo.like), DET_W, 27);
    // TODAY'S PICK: 값이 비면 상대 이름이 들어간다
    fitText(setText(`#c${n}Pick`, c.order.trim() || other), DET_W, 27);
  }

  /* --- 오늘의 메뉴 --- */
  renderMenu();
  renderNote();

  // 가운데 문구는 바닥 괘선 위에 앉는다. 종이색 판을 글자 폭에 맞춰 깔아 괘선을 끊는다
  const always = setText('#atText', S.always.trim() || PH.always);
  fitText(always, 420, 17);
  const aHalf = textWidth(always) / 2;
  $('#atL').setAttribute('transform', `translate(${CENTER - aHalf - 20},1300) scale(1.1)`);
  $('#atR').setAttribute('transform', `translate(${CENTER + aHalf + 20},1300) scale(1.1)`);
  const aBg = $('#atBg');
  aBg.setAttribute('x', CENTER - aHalf - 44);
  aBg.setAttribute('width', aHalf * 2 + 88);

  fitText(setText('#footText', S.foot.trim() || PH.foot), 440, 15);

  Object.keys(FRAMES).forEach(placeFrame);
  SLOTS.forEach(s => placeSticker(s.k));
  save();
  ensureKrFonts();
}

/* 메뉴 4개를 하트로 이어 한 줄에 놓는다. 카드(상자)를 쓰지 않는다. */
const MENU_Y = 1204, MENU_SEP = 36, MENU_MAX = 856, MENU_SIZE = 25;

function renderMenu() {
  const g = $('#menu-rows');
  g.textContent = '';

  const els = MENU_DEF.map((def, i) => {
    const t = svgEl('text', { class: 'sans f-green', y: MENU_Y, 'letter-spacing': 2 });
    t.textContent = (S.menu[i] || '').trim() || def;
    t.style.fontSize = MENU_SIZE + 'px';
    g.appendChild(t);
    return t;
  });

  const measure = () => els.map(textWidth);
  let w = measure();
  let total = w.reduce((a, b) => a + b, 0) + MENU_SEP * (els.length - 1);
  if (total > MENU_MAX) {                       // 긴 문구는 줄 전체를 함께 줄인다
    const size = Math.max(11, MENU_SIZE * MENU_MAX / total);
    els.forEach(t => { t.style.fontSize = size + 'px'; });
    w = measure();
    total = w.reduce((a, b) => a + b, 0) + MENU_SEP * (els.length - 1);
  }

  let x = CENTER - total / 2;
  els.forEach((t, i) => {
    t.setAttribute('x', x);
    x += w[i];
    if (i < els.length - 1) {
      const u = svgEl('use', { class: 'f-red', transform: `translate(${x + MENU_SEP / 2},${MENU_Y - 6}) scale(1.1)` });
      u.setAttribute('href', '#ic-heart');
      g.appendChild(u);
      x += MENU_SEP;
    }
  });
}

/* 손글씨 메모는 사진 왼쪽 빈 열에 놓는다 */
function renderNote() {
  const g = $('#noteLines');
  g.textContent = '';
  const lines = (S.note.trim() || PH.note).split('/').map(s => s.trim()).filter(Boolean).slice(0, 3);
  lines.forEach((line, i) => {
    const t = svgEl('text', { x: 68, y: 440 + i * 40 });
    t.textContent = line;
    g.appendChild(t);
    fitText(t, 300, 30);
  });
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
  const st = S.stickers[k], box = SLOT_BY_K[k].box;
  const art = $('#art-' + k), img = $('#img-' + k), hit = $('#hit-' + k);

  if (!st || !st.src) {
    art.style.display = 'inline';
    img.style.display = 'none';
    img.removeAttribute('href');
    hit.style.display = 'none';
    return;
  }
  art.style.display = 'none';
  if (img.getAttribute('href') !== st.src) img.setAttribute('href', st.src);

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
      menu: MENU_DEF.map((_, i) => (d.menu || [])[i] || ''),
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
  PFDisplay:   'fonts/Pacifico-400.woff2',
  PFHand:      'fonts/Caveat-700.woff2',
  PFSans:      'fonts/Nunito-800.woff2',
  PFDisplayKR: 'fonts/Jua-KR.woff2',
  PFHandKR:    'fonts/Gaegu-KR.woff2',
  PFSansKR:    'fonts/GothicA1-KR.woff2',
};
const LATIN_FONTS = ['PFDisplay', 'PFHand', 'PFSans'];
const fontCache = new Map();

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
    clone.setAttribute('width', POSTER_W * EXPORT_SCALE);
    clone.setAttribute('height', POSTER_H * EXPORT_SCALE);
    clone.querySelectorAll('#photoHit, #c1Hit, #c2Hit, .slot-hit').forEach(n => n.remove());
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

const CHAR_FIELDS = [
  ['name',  '이름 (NAME)',        16, 'character 1'],
  ['age',   '나이 (AGE)',         12, '26'],
  ['job',   '직업 (JOB)',         18, 'Barista'],
  ['like',  '좋아하는 것 (LIKE)', 18, 'Cheeseburger'],
  ['order', "오늘의 픽 (TODAY'S PICK)", 18, '비우면 상대 이름이 들어갑니다'],
];

function buildCharUI() {
  for (const key of ['c1', 'c2']) {
    const box = $(`[data-char="${key}"]`);
    const no = key === 'c1' ? '01' : '02';
    box.innerHTML = `
      <div class="btn-row">
        <button class="btn" type="button" data-pick-img="${key}">사진 올리기</button>
        <button class="btn ghost" type="button" data-clear-img="${key}">지우기</button>
      </div>
      <label class="fld range"><span>사진 확대 <b data-zl="${key}">100%</b></span>
        <input type="range" min="100" max="400" step="1" value="100" data-zoom="${key}"></label>
      ${CHAR_FIELDS.map(([f, label, max, ph]) => `
        <label class="fld"><span>${label}</span>
          <input type="text" maxlength="${max}" data-f="${key}.${f}"
                 placeholder="${f === 'name' ? (key === 'c1' ? 'character 1' : 'character 2') : ph}"></label>`).join('')}
    `;
  }
}

function buildMenuUI() {
  $('#menu-inputs').innerHTML = MENU_DEF.map((d, i) => `
    <label class="fld"><span>메뉴 ${i + 1}</span>
      <input type="text" maxlength="16" data-menu="${i}" placeholder="${d}"></label>`).join('');
}

let pendingSlot = null, pendingChar = null;

function buildStickerUI() {
  const wrap = $('#sticker-list');
  wrap.innerHTML = SLOTS.map(({ k, name }) => `
    <div class="sticker">
      <div class="nm">${name}</div>
      <div class="thumb" data-thumb="${k}"><span class="none">기본 일러스트</span></div>
      <label class="szrow" data-sz="${k}" hidden>
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
  for (const { k } of SLOTS) {
    const st = S.stickers[k];
    $(`[data-thumb="${k}"]`).innerHTML = st.src ? `<img src="${st.src}" alt="">` : '<span class="none">기본 일러스트</span>';
    $(`[data-sz="${k}"]`).hidden = !st.src;
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

function syncInputs() {
  $('#in-pair').value = S.pair;
  $('#in-sub').value  = S.sub;
  $('#in-est').value  = S.est;
  $('#in-tag').value  = S.tag;
  $('#in-note').value = S.note;
  $('#in-always').value = S.always;
  $('#in-foot').value = S.foot;
  $$('[data-menu]').forEach(el => { el.value = S.menu[+el.dataset.menu] || ''; });
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
  buildMenuUI();
  buildStickerUI();
  buildColorUI();
  syncInputs();

  bindText('#in-pair',   v => S.pair = v);
  bindText('#in-sub',    v => S.sub = v);
  bindText('#in-est',    v => S.est = v);
  bindText('#in-tag',    v => S.tag = v);
  bindText('#in-note',   v => S.note = v);
  bindText('#in-always', v => S.always = v);
  bindText('#in-foot',   v => S.foot = v);

  // 캐릭터 텍스트 / 메뉴 문구는 위임으로 한 번에 받는다
  $('.panel').addEventListener('input', e => {
    const f = e.target.dataset.f, m = e.target.dataset.menu, z = e.target.dataset.zoom;
    if (f) { setPath(f, e.target.value); render(); }
    else if (m !== undefined) { S.menu[+m] = e.target.value; render(); }
    else if (z) setZoom(z, +e.target.value / 100);
  });

  // 사진 (메인 + 캐릭터 2장) : 숨긴 입력 하나를 공유한다
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
      const { src, w, h } = await readImage(f, big ? 2200 : 1100, false);
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
      document.fonts.load("168px 'PFDisplay'"),
      document.fonts.load("27px 'PFHand'"),
      document.fonts.load("17px 'PFSans'"),
    ]);
  } catch {}
  render();
}

init();

})();
