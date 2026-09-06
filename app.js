/* Pairframe — 페어 포스터 메이커
 * 포스터는 index.html 안의 인라인 SVG 하나가 전부다.
 * 화면 표시와 PNG 저장이 같은 SVG를 쓰므로 보이는 그대로 저장된다. */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const POSTER_W = 1000, POSTER_H = 1500;
const CENTER = 500;
/* 사진 프레임. index.html 의 #clip-photo / #photoHit 과 같은 값이어야 한다. */
const FRAME = { x: 170, y: 278, w: 660, h: 590 };
const EXPORT_SCALE = 3;               // 3000 x 4500 px
const STORE_KEY = 'pairframe.v2';

const poster = $('#poster');

/* ===================== 정의 ===================== */

/* box = 스티커를 교체했을 때 기본으로 놓이는 자리(중심과 크기) */
const SLOTS = [
  { k: 'dog',     name: '곰',       box: { cx:  81, cy: 276, w: 150, h: 180 } },
  { k: 'cup',     name: '음료컵',   box: { cx: 905, cy: 277, w: 126, h: 176 } },
  { k: 'cherry',  name: '체리',     box: { cx: 920, cy: 395, w:  76, h:  76 } },
  { k: 'ketchup', name: '케첩',     box: { cx:  86, cy: 751, w:  98, h: 186 } },
  { k: 'fries',   name: '감자튀김', box: { cx: 754, cy: 750, w: 108, h: 154 } },
  { k: 'burger',  name: '햄버거',   box: { cx: 871, cy: 758, w: 184, h: 170 } },
];
const SLOT_BY_K = Object.fromEntries(SLOTS.map(s => [s.k, s]));

const COLORS = [
  { k: 'paper',  name: '종이 배경',           def: '#FBF2DF' },
  { k: 'red',    name: '메인 레드 (선·글씨)',  def: '#D6392E' },
  { k: 'p1',     name: '캐릭터 1 (핑크)',      def: '#E4707D' },
  { k: 'p2',     name: '캐릭터 2 (블루)',      def: '#4E93D6' },
  { k: 'green',  name: '사진 배경',           def: '#B9DFA6' },
  { k: 'accent', name: '포인트 (별·감자)',     def: '#F2A03C' },
];

const PRESETS = [
  { name: '클래식', c: { paper:'#FBF2DF', red:'#D6392E', p1:'#E4707D', p2:'#4E93D6', green:'#B9DFA6', accent:'#F2A03C' } },
  { name: '민트',   c: { paper:'#F2F7F2', red:'#2E9C86', p1:'#EF8FA0', p2:'#5C8FD6', green:'#FBDFB4', accent:'#EFAF3E' } },
  { name: '나이트', c: { paper:'#2B2733', red:'#F0E2C6', p1:'#EE8FA6', p2:'#7FB8E8', green:'#3F5C48', accent:'#EFBF5C' } },
];

/* 사원증 행(AGE/JOB/LIKE)의 라벨 시작 x 와 점선 끝 x */
const ROW_X = { c1: { left: 84, right: 432 }, c2: { left: 568, right: 916 } };

const newSticker = () => ({ src: null, scale: 1, dx: 0, dy: 0 });

const defaults = () => ({
  tag: '',
  pair: '',
  c1: { name: '', age: '', job: '', like: 'LIKE' },
  c2: { name: '', age: '', job: '', like: 'LIKE' },
  photo: { src: null, nw: 0, nh: 0, zoom: 1, ox: 0, oy: 0 },
  stickers: Object.fromEntries(SLOTS.map(s => [s.k, newSticker()])),
  colors: Object.fromEntries(COLORS.map(c => [c.k, c.def])),
});

let S = defaults();

const PLACEHOLDER = { tag: 'Better Together !', pair: 'Pairname', c1: 'character 1', c2: 'character 2' };

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

/** 메인 레드의 그림자용 진한 톤 */
function deepOf(hex) {
  const [h, s, l] = rgb2hsl(hex);
  return l > 0.55 ? hsl2hex(h, s, clamp(l - 0.22, 0, 1))
                  : hsl2hex(h, Math.min(1, s * 1.05), clamp(l * 0.62, 0, 1));
}
/** 사진 배경색 위에 얹을 잉크색 (안내 문구·아이콘) */
function inkOf(hex) {
  const [h, s] = rgb2hsl(hex);
  return hsl2hex(h, clamp(s * 1.7, 0.35, 0.72), lum(hex) > 0.45 ? 0.31 : 0.78);
}
/** 영수증·사원증에 쓰는, 배경보다 한 톤 밝은 종이색 */
function sheetOf(hex) {
  const [h, s, l] = rgb2hsl(hex);
  return lum(hex) > 0.5 ? hsl2hex(h, clamp(s * 0.7, 0, 1), clamp(l + 0.06, 0, 0.985))
                        : hsl2hex(h, clamp(s * 0.9, 0, 1), clamp(l + 0.07, 0, 1));
}
/** 종이 얼룩·그림자에 쓰는 대비색 */
function grainOf(hex) {
  const [h, s] = rgb2hsl(hex);
  return lum(hex) > 0.5 ? hsl2hex(h, clamp(s, 0.15, 0.5), 0.32) : hsl2hex(h, clamp(s, 0.1, 0.4), 0.82);
}
/** 색이 칠해진 띠 위에 올릴 글자색: 띠가 밝으면 진하게, 어두우면 종이색으로 */
function onColor(bg, sheet) {
  const [h, s] = rgb2hsl(bg);
  return lum(bg) > 0.62 ? hsl2hex(h, clamp(s * 1.1, 0, 1), 0.24) : sheet;
}

/* ===================== 테마 주입 ===================== */

/* 한글은 라틴 폰트에 글리프가 없어 자동으로 뒤쪽 한글 폰트로 넘어간다. */
const F_DISP = "'PFDisplay','PFDisplayKR','Apple SD Gothic Neo','Malgun Gothic',cursive";
const F_HAND = "'PFHand','PFHandKR','Apple SD Gothic Neo','Malgun Gothic',cursive";
const F_SANS = "'PFSans','PFSansKR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";

function themeCss() {
  const c = S.colors;
  const deep  = deepOf(c.red);
  const ink   = inkOf(c.green);
  const sheet = sheetOf(c.paper);
  const grain = grainOf(c.paper);
  return `
.disp{font-family:${F_DISP}}
.hand{font-family:${F_HAND}}
.sans{font-family:${F_SANS}}
.f-paper{fill:${c.paper}}.f-red{fill:${c.red}}.f-deep{fill:${deep}}
.f-p1{fill:${c.p1}}.f-p2{fill:${c.p2}}.f-green{fill:${c.green}}
.f-green-ink{fill:${ink}}.f-accent{fill:${c.accent}}.f-sheet{fill:${sheet}}
.f-on-p1{fill:${onColor(c.p1, sheet)}}.f-on-p2{fill:${onColor(c.p2, sheet)}}
.f-grain{fill:${grain};opacity:.16}
.s-paper{stroke:${c.paper}}.s-red{stroke:${c.red}}.s-deep{stroke:${deep}}
.s-p1{stroke:${c.p1}}.s-p2{stroke:${c.p2}}.s-green-ink{stroke:${ink}}.s-accent{stroke:${c.accent}}
.lbl{font-size:19px;letter-spacing:1.6px}
.dash{fill:none;stroke-width:1.8;stroke-dasharray:9 7;stroke-linecap:round;opacity:.85}
`;
}

function applyTheme() { $('#theme-style').textContent = themeCss(); }

/* ===================== 텍스트 ===================== */

const textWidth = el => { try { return el.getComputedTextLength(); } catch { return 0; } };

function fitText(el, maxW, baseSize) {
  el.style.fontSize = baseSize + 'px';
  const w = textWidth(el);
  if (w > maxW && w > 0) el.style.fontSize = Math.max(9, baseSize * maxW / w) + 'px';
}

function layoutRow(id, label, value, labelX, rightX) {
  const g     = $('#' + id);
  const lbl   = $('.lbl:not(.colon)', g);
  const colon = $('.colon', g);
  const dash  = $('.dash', g);
  const val   = $('.val', g);

  lbl.textContent = label;
  const colonX = labelX + textWidth(lbl) + 12;
  const startX = colonX + 18;
  const y = parseFloat(lbl.getAttribute('y'));

  colon.setAttribute('x', colonX);
  dash.setAttribute('d', `M${startX} ${y + 8} H${rightX}`);
  val.setAttribute('x', startX + 6);
  val.textContent = value;
  fitText(val, rightX - startX - 14, 30);
}

/** 하단 가운데 줄을 500 기준 좌우 대칭으로 배치한다 */
function layoutFooter() {
  const a = $('#ft-a'), b = $('#ft-b'), c = $('#ft-c');
  const wa = textWidth(a), wb = textWidth(b), wc = textWidth(c);
  const GAP = 46;                              // 글자 사이(별이 놓이는) 간격
  const total = wa + wb + wc + GAP * 2;
  const left = CENTER - total / 2;

  let x = left;
  a.setAttribute('x', x + wa / 2);  x += wa;
  $('#ft-star-l').setAttribute('transform', `translate(${x + GAP / 2},1396) rotate(-14) scale(.9)`);
  x += GAP;
  b.setAttribute('x', x + wb / 2);  x += wb;
  $('#ft-star-r').setAttribute('transform', `translate(${x + GAP / 2},1396) rotate(14) scale(.9)`);
  x += GAP;
  c.setAttribute('x', x + wc / 2);

  $('#ft-rule-l').setAttribute('d', `M${left - 74} 1396 H${left - 20}`);
  $('#ft-rule-r').setAttribute('d', `M${left + total + 20} 1396 H${left + total + 74}`);
}

/* ===================== 한글 폰트 ===================== */

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

/** 글자가 속한 역할(disp/hand/sans)을 조상까지 훑어 찾는다 */
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

/** 지금 포스터에서 실제로 한글이 쓰인 역할의 폰트만 고른다 */
function neededKrFonts(root = poster) {
  const need = new Set();
  for (const t of root.querySelectorAll('text')) {
    if (HANGUL.test(t.textContent)) need.add(roleOf(t));
  }
  return need;
}

const krLoaded = new Set();
/** 한글 폰트는 1MB에 가까워 미리 받지 않는다. 실제로 쓰일 때만 받고 다시 그린다. */
async function ensureKrFonts() {
  let loadedSomething = false;
  for (const fam of neededKrFonts()) {
    if (krLoaded.has(fam)) continue;
    krLoaded.add(fam);
    try {
      await document.fonts.load(`32px '${fam}'`);
      loadedSomething = true;
    } catch {}
  }
  if (loadedSomething) render();          // 폭을 다시 재야 배치가 맞는다
}

/* ===================== 렌더 ===================== */

function render() {
  applyTheme();

  const tag  = S.tag.trim()     || PLACEHOLDER.tag;
  const pair = S.pair.trim()    || PLACEHOLDER.pair;
  const n1   = S.c1.name.trim() || PLACEHOLDER.c1;
  const n2   = S.c2.name.trim() || PLACEHOLDER.c2;

  // 상단 문구: 길이에 따라 양옆 장식을 다시 붙인다
  const tagEl = $('#tagLine');
  tagEl.textContent = tag;
  fitText(tagEl, 420, 42);
  const th = textWidth(tagEl) / 2;
  $('#tagNote')  .setAttribute('transform', `translate(${CENTER - th - 32},96) rotate(-8) scale(1.05)`);
  $('#tagSpark') .setAttribute('transform', `translate(${CENTER - th - 60},116) rotate(12) scale(.85)`);
  $('#tagHeart1').setAttribute('transform', `translate(${CENTER + th + 26},90) rotate(14) scale(1.25)`);
  $('#tagHeart2').setAttribute('transform', `translate(${CENTER + th + 52},110) rotate(-10) scale(.9)`);

  const main = $('#pairName'), shadow = $('#pairShadow');
  main.textContent = shadow.textContent = pair;
  fitText(main, FRAME.w, 122);                 // 사진 프레임과 같은 폭 안에 들어오게
  shadow.style.fontSize = main.style.fontSize;

  // 별은 이름 길이에 따라 마지막 글자 오른쪽에 붙인다 (음료컵과 겹치지 않게 상한을 둔다).
  const starX = clamp(CENTER + textWidth(main) / 2 + 32, 640, 848);
  $('#pairStar').setAttribute('transform', `translate(${starX},204) rotate(-12) scale(2.1)`);

  const t1 = $('#c1Name'), t2 = $('#c2Name');
  t1.textContent = n1; fitText(t1, 222, 32);
  t2.textContent = n2; fitText(t2, 222, 32);

  layoutRow('row-1a', 'AGE',     S.c1.age, ROW_X.c1.left, ROW_X.c1.right);
  layoutRow('row-1j', 'JOB',     S.c1.job, ROW_X.c1.left, ROW_X.c1.right);
  layoutRow('row-1l', S.c1.like, n2,       ROW_X.c1.left, ROW_X.c1.right);

  layoutRow('row-2a', 'AGE',     S.c2.age, ROW_X.c2.left, ROW_X.c2.right);
  layoutRow('row-2j', 'JOB',     S.c2.job, ROW_X.c2.left, ROW_X.c2.right);
  layoutRow('row-2l', S.c2.like, n1,       ROW_X.c2.left, ROW_X.c2.right);

  layoutFooter();
  placePhoto();
  SLOTS.forEach(s => placeSticker(s.k));
  save();
  ensureKrFonts();
}

function placePhoto() {
  const p = S.photo, img = $('#photoImg'), hint = $('#photoHint');

  // display 는 반드시 값으로 지정한다. ''(인라인 해제)로 두면 스타일시트 규칙이 이겨버린다.
  if (!p.src || !p.nw || !p.nh) {
    img.style.display = 'none';
    img.removeAttribute('href');
    hint.style.display = 'inline';
    return;
  }
  hint.style.display = 'none';
  if (img.getAttribute('href') !== p.src) img.setAttribute('href', p.src);

  const base = Math.max(FRAME.w / p.nw, FRAME.h / p.nh);
  const s = base * p.zoom;
  const w = p.nw * s, h = p.nh * s;
  const maxX = Math.max(0, (w - FRAME.w) / 2), maxY = Math.max(0, (h - FRAME.h) / 2);
  p.ox = clamp(p.ox, -maxX, maxX);
  p.oy = clamp(p.oy, -maxY, maxY);

  img.setAttribute('x', FRAME.x + (FRAME.w - w) / 2 + p.ox);
  img.setAttribute('y', FRAME.y + (FRAME.h - h) / 2 + p.oy);
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

  // 포스터 밖으로 완전히 사라지지만 않게 중심만 느슨하게 잡아 둔다.
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
      const light = {
        ...S,
        photo: { ...S.photo, src: null },
        stickers: Object.fromEntries(Object.entries(S.stickers).map(([k, v]) => [k, { ...v, src: null }])),
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(light));
    } catch {}
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    const base = defaults();
    S = {
      ...base, ...d,
      c1: { ...base.c1, ...(d.c1 || {}) },
      c2: { ...base.c2, ...(d.c2 || {}) },
      photo: { ...base.photo, ...(d.photo || {}) },
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

/** hit 위에서의 끌기와 두 손가락 확대를 잡아 콜백으로 넘긴다 */
function bindGesture(hit, { active, onDrag, onScale, onEnd }) {
  const pts = new Map();
  let last = null, pinch = 0;
  const dist = () => {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

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

function setZoom(z) {
  S.photo.zoom = clamp(z, 1, 4);
  $('#in-zoom').value = Math.round(S.photo.zoom * 100);
  $('#lbl-zoom').textContent = Math.round(S.photo.zoom * 100) + '%';
  placePhoto();
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
  bindGesture($('#photoHit'), {
    active: () => !!S.photo.src,
    onDrag: (dx, dy) => { S.photo.ox += dx; S.photo.oy += dy; placePhoto(); },
    onScale: r => setZoom(S.photo.zoom * r),
    onEnd: save,
  });

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
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
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

/** 라틴 3종은 항상, 한글 폰트는 실제로 쓰인 것만 심는다 (한 벌에 200~450KB) */
async function fontCss(clone) {
  const fams = [...LATIN_FONTS, ...neededKrFonts(clone)];
  return (await Promise.all(fams.map(faceCss))).join('');
}

/** XML은 주석 안의 연속 하이픈을 허용하지 않아 직렬화 전에 주석을 걷어낸다. */
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
    clone.querySelector('#photoHit')?.remove();
    clone.querySelectorAll('.slot-hit').forEach(n => n.remove());
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

let pendingSlot = null;

function buildStickerUI() {
  const wrap = $('#sticker-list');
  wrap.innerHTML = '';
  for (const { k, name } of SLOTS) {
    const el = document.createElement('div');
    el.className = 'sticker';
    el.innerHTML = `
      <div class="nm">${name}</div>
      <div class="thumb" data-thumb="${k}"><span class="none">기본 일러스트</span></div>
      <label class="szrow" data-sz="${k}" hidden>
        <span>크기</span>
        <input type="range" min="30" max="300" step="1" value="100" data-scale="${k}">
      </label>
      <div class="row">
        <button class="btn" type="button" data-slot="${k}">교체</button>
        <button class="btn ghost" type="button" data-reset="${k}">되돌리기</button>
      </div>`;
    wrap.appendChild(el);
  }

  // 파일 입력은 하나만 두고 눌린 칸을 기억한다. label 안에 input 을 겹쳐 두면
  // 모바일 브라우저에서 선택창이 두 번 열리거나 아예 안 열리는 일이 있다.
  wrap.addEventListener('click', e => {
    const pick = e.target.closest('[data-slot]');
    if (pick) {
      pendingSlot = pick.dataset.slot;
      $('#in-sticker').click();
      return;
    }
    const reset = e.target.closest('[data-reset]');
    if (reset) {
      S.stickers[reset.dataset.reset] = newSticker();
      render();
      updateStickerCards();
    }
  });

  wrap.addEventListener('input', e => {
    const k = e.target.dataset.scale;
    if (k) setStickerScale(k, +e.target.value / 100);
  });

  $('#in-sticker').addEventListener('change', async e => {
    const f = e.target.files[0];
    const k = pendingSlot;
    e.target.value = '';
    pendingSlot = null;
    if (!f || !k) return;
    try {
      const { src } = await readImage(f, 900, true);
      S.stickers[k] = { ...newSticker(), src };
      render();
      updateStickerCards();
    } catch { toast('이미지를 읽지 못했어요.'); }
  });
}

function updateStickerCards() {
  for (const { k } of SLOTS) {
    const st = S.stickers[k];
    const box = $(`[data-thumb="${k}"]`);
    box.innerHTML = st.src ? `<img src="${st.src}" alt="">` : '<span class="none">기본 일러스트</span>';
    $(`[data-sz="${k}"]`).hidden = !st.src;
    $(`[data-scale="${k}"]`).value = Math.round(st.scale * 100);
  }
}

function buildColorUI() {
  const list = $('#color-list');
  list.innerHTML = '';
  for (const { k, name } of COLORS) {
    const row = document.createElement('div');
    row.className = 'color';
    row.innerHTML = `<label for="col-${k}">${name}</label><input id="col-${k}" type="color" data-col="${k}">`;
    list.appendChild(row);
  }
  list.addEventListener('input', e => {
    const k = e.target.dataset.col;
    if (!k) return;
    S.colors[k] = e.target.value;
    render();
  });

  const pre = $('#presets');
  pre.innerHTML = '';
  PRESETS.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.dataset.preset = i;
    b.innerHTML = `<i style="background:${p.c.red}"></i><i style="background:${p.c.p2}"></i><i style="background:${p.c.paper}"></i>${p.name}`;
    pre.appendChild(b);
  });
  pre.addEventListener('click', e => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    S.colors = { ...PRESETS[+b.dataset.preset].c };
    syncColorInputs();
    render();
  });
}

function syncColorInputs() {
  for (const { k } of COLORS) $('#col-' + k).value = S.colors[k];
}

function syncInputs() {
  $('#in-tag').value     = S.tag;
  $('#in-pair').value    = S.pair;
  $('#in-c1-name').value = S.c1.name;
  $('#in-c2-name').value = S.c2.name;
  $('#in-c1-age').value  = S.c1.age;
  $('#in-c1-job').value  = S.c1.job;
  $('#in-c2-age').value  = S.c2.age;
  $('#in-c2-job').value  = S.c2.job;
  $('#in-zoom').value    = Math.round(S.photo.zoom * 100);
  $('#lbl-zoom').textContent = Math.round(S.photo.zoom * 100) + '%';
  syncToggle('tg-c1', S.c1.like);
  syncToggle('tg-c2', S.c2.like);
  syncColorInputs();
  updateStickerCards();
}

function syncToggle(id, v) {
  $$('#' + id + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
}

function bindText(sel, set) {
  $(sel).addEventListener('input', e => { set(e.target.value); render(); });
}

function bindToggle(id, key) {
  $('#' + id).addEventListener('click', e => {
    const v = e.target.dataset.v;
    if (!v) return;
    S[key].like = v;          // S는 전체 초기화 때 새 객체로 바뀌므로 매번 다시 읽는다
    syncToggle(id, v);
    render();
  });
}

/* ===================== 초기화 ===================== */

async function init() {
  load();

  buildStickerUI();
  buildColorUI();
  syncInputs();

  bindText('#in-tag',     v => S.tag = v);
  bindText('#in-pair',    v => S.pair = v);
  bindText('#in-c1-name', v => S.c1.name = v);
  bindText('#in-c2-name', v => S.c2.name = v);
  bindText('#in-c1-age',  v => S.c1.age = v);
  bindText('#in-c1-job',  v => S.c1.job = v);
  bindText('#in-c2-age',  v => S.c2.age = v);
  bindText('#in-c2-job',  v => S.c2.job = v);
  bindToggle('tg-c1', 'c1');
  bindToggle('tg-c2', 'c2');

  $('#btn-photo-pick').addEventListener('click', () => $('#in-photo').click());
  $('#in-photo').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const { src, w, h } = await readImage(f, 2200, false);
      S.photo = { src, nw: w, nh: h, zoom: 1, ox: 0, oy: 0 };
      setZoom(1);
      render();
    } catch { toast('사진을 읽지 못했어요.'); }
  });
  $('#btn-photo-clear').addEventListener('click', () => {
    S.photo = defaults().photo;
    setZoom(1);
    render();
  });
  $('#btn-photo-reset').addEventListener('click', () => {
    S.photo.ox = S.photo.oy = 0;
    setZoom(1);
  });
  $('#in-zoom').addEventListener('input', e => setZoom(+e.target.value / 100));

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
      document.fonts.load("122px 'PFDisplay'"),
      document.fonts.load("32px 'PFHand'"),
      document.fonts.load("19px 'PFSans'"),
    ]);
  } catch {}
  render();
}

init();

})();
