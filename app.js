/* Pairframe — 페어 포스터 메이커
 * 포스터는 index.html 안의 인라인 SVG 하나가 전부다.
 * 화면 표시와 PNG 저장이 같은 SVG를 쓰므로 보이는 그대로 저장된다. */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const POSTER_W = 1000, POSTER_H = 1500;
const FRAME = { x: 196, y: 278, w: 668, h: 590 };
const EXPORT_SCALE = 3;               // 3000 x 4500 px
const STORE_KEY = 'pairframe.v1';

const poster = $('#poster');

/* ===================== 정의 ===================== */

const SLOTS = [
  { k: 'dog',     name: '강아지' },
  { k: 'cup',     name: '음료컵' },
  { k: 'cherry',  name: '체리' },
  { k: 'ketchup', name: '케첩' },
  { k: 'fries',   name: '감자튀김' },
  { k: 'burger',  name: '햄버거' },
];

const COLORS = [
  { k: 'paper',  name: '종이 배경',        def: '#FBF2DF' },
  { k: 'red',    name: '메인 레드 (선·글씨)', def: '#D6392E' },
  { k: 'p1',     name: '캐릭터 1 (핑크)',   def: '#E4707D' },
  { k: 'p2',     name: '캐릭터 2 (블루)',   def: '#4E93D6' },
  { k: 'green',  name: '사진 배경',        def: '#B9DFA6' },
  { k: 'accent', name: '포인트 (별·감자)',  def: '#F2A03C' },
];

const PRESETS = [
  { name: '클래식', c: { paper:'#FBF2DF', red:'#D6392E', p1:'#E4707D', p2:'#4E93D6', green:'#B9DFA6', accent:'#F2A03C' } },
  { name: '민트',   c: { paper:'#F2F7F2', red:'#2E9C86', p1:'#EF8FA0', p2:'#5C8FD6', green:'#FBDFB4', accent:'#EFAF3E' } },
  { name: '나이트', c: { paper:'#2B2733', red:'#F0E2C6', p1:'#EE8FA6', p2:'#7FB8E8', green:'#3F5C48', accent:'#EFBF5C' } },
];

const defaults = () => ({
  pair: '',
  c1: { name: '', age: '', job: '', like: 'LIKE' },
  c2: { name: '', age: '', job: '', like: 'LIKE' },
  photo: { src: null, nw: 0, nh: 0, zoom: 1, ox: 0, oy: 0 },
  stickers: {},
  colors: Object.fromEntries(COLORS.map(c => [c.k, c.def])),
});

let S = defaults();

const PLACEHOLDER = { pair: 'Pairname', c1: 'character 1', c2: 'character 2' };

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
  let [r, g, b] = hex2rgb(hex).map(v => v / 255);
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
  return l > 0.55 ? hsl2hex(h, s, clamp(l - 0.22, 0, 1))    // 밝은 색이면 살짝만 어둡게
                  : hsl2hex(h, Math.min(1, s * 1.05), clamp(l * 0.62, 0, 1));
}
/** 사진 배경색 위에 얹을 잉크색 (안내 문구·아이콘) */
function inkOf(hex) {
  const [h, s] = rgb2hsl(hex);
  return hsl2hex(h, clamp(s * 1.7, 0.35, 0.72), lum(hex) > 0.45 ? 0.31 : 0.78);
}
/** 종이 질감 얼룩색 */
function grainOf(hex) {
  const [h, s] = rgb2hsl(hex);
  return lum(hex) > 0.5 ? hsl2hex(h, clamp(s, 0.15, 0.5), 0.32) : hsl2hex(h, clamp(s, 0.1, 0.4), 0.82);
}

/* ===================== 테마 주입 ===================== */

function themeCss() {
  const c = S.colors;
  const deep = deepOf(c.red), ink = inkOf(c.green), grain = grainOf(c.paper);
  return `
.disp{font-family:'PFDisplay','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',cursive}
.hand{font-family:'PFHand','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',cursive}
.sans{font-family:'PFSans','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif}
.f-paper{fill:${c.paper}}.f-red{fill:${c.red}}.f-deep{fill:${deep}}
.f-p1{fill:${c.p1}}.f-p2{fill:${c.p2}}.f-green{fill:${c.green}}
.f-green-ink{fill:${ink}}.f-accent{fill:${c.accent}}
.f-grain{fill:${grain};opacity:.16}
.s-paper{stroke:${c.paper}}.s-red{stroke:${c.red}}.s-deep{stroke:${deep}}
.s-p1{stroke:${c.p1}}.s-p2{stroke:${c.p2}}.s-green-ink{stroke:${ink}}.s-accent{stroke:${c.accent}}
.lbl{font-size:19px;letter-spacing:1.6px}
.dash{fill:none;stroke-width:1.8;stroke-dasharray:9 7;stroke-linecap:round;opacity:.85}
`;
}

function applyTheme() { $('#theme-style').textContent = themeCss(); }

/* ===================== 텍스트 ===================== */

function fitText(el, maxW, baseSize) {
  el.style.fontSize = baseSize + 'px';
  let w = 0;
  try { w = el.getComputedTextLength(); } catch { return; }
  if (w > maxW && w > 0) el.style.fontSize = Math.max(9, baseSize * maxW / w) + 'px';
}

function layoutRow(id, label, value, labelX, rightX) {
  const g     = $('#' + id);
  const lbl   = $('.lbl:not(.colon)', g);
  const colon = $('.colon', g);
  const dash  = $('.dash', g);
  const val   = $('.val', g);

  lbl.textContent = label;
  let lw = 0;
  try { lw = lbl.getComputedTextLength(); } catch {}
  const colonX = labelX + lw + 12;
  const startX = colonX + 18;
  const y = parseFloat(lbl.getAttribute('y'));

  colon.setAttribute('x', colonX);
  dash.setAttribute('d', `M${startX} ${y + 8} H${rightX}`);
  val.setAttribute('x', startX + 6);
  val.textContent = value;
  fitText(val, rightX - startX - 14, 30);
}

/* ===================== 렌더 ===================== */

function render() {
  applyTheme();

  const pair = S.pair.trim() || PLACEHOLDER.pair;
  const n1   = S.c1.name.trim() || PLACEHOLDER.c1;
  const n2   = S.c2.name.trim() || PLACEHOLDER.c2;

  const main = $('#pairName'), shadow = $('#pairShadow');
  main.textContent = shadow.textContent = pair;
  fitText(main, 690, 122);
  shadow.style.fontSize = main.style.fontSize;

  // 별은 이름 길이에 따라 마지막 글자 오른쪽에 붙인다.
  let half = 300;
  try { half = main.getComputedTextLength() / 2; } catch {}
  const starX = clamp(500 + half + 34, 620, 848);
  $('#pairStar').setAttribute('transform', `translate(${starX},214) scale(2.2)`);

  const t1 = $('#c1Name'), t2 = $('#c2Name');
  t1.textContent = n1; fitText(t1, 240, 34);
  t2.textContent = n2; fitText(t2, 202, 34);

  layoutRow('row-1a', 'AGE',      S.c1.age, 98, 449);
  layoutRow('row-1j', 'JOB',      S.c1.job, 98, 449);
  layoutRow('row-1l', S.c1.like,  n2,       98, 449);

  // 오른쪽 끝은 'You + Me = Perfect' 세로 문구와 겹치지 않도록 928에서 끊는다
  layoutRow('row-2a', 'AGE',      S.c2.age, 566, 928);
  layoutRow('row-2j', 'JOB',      S.c2.job, 566, 928);
  layoutRow('row-2l', S.c2.like,  n1,       566, 928);

  placePhoto();
  renderStickers();
  save();
}

function placePhoto() {
  const p = S.photo, img = $('#photoImg'), hint = $('#photoHint');

  if (!p.src || !p.nw || !p.nh) {
    img.style.display = 'none';
    img.removeAttribute('href');
    hint.style.display = '';
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
  img.style.display = '';
}

function renderStickers() {
  for (const { k } of SLOTS) {
    const art = $('#art-' + k), img = $('#img-' + k), src = S.stickers[k];
    if (src) {
      art.style.display = 'none';
      img.setAttribute('href', src);
      img.style.display = '';
    } else {
      art.style.display = '';
      img.removeAttribute('href');
      img.style.display = 'none';
    }
  }
}

/* ===================== 저장(로컬) ===================== */

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

function saveNow() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
  } catch {
    // 이미지까지 넣으면 용량을 넘길 수 있다. 텍스트/색상만이라도 남긴다.
    try {
      const light = { ...S, photo: { ...S.photo, src: null }, stickers: {} };
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
      stickers: d.stickers || {},
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

/* ===================== 사진 조작 ===================== */

function svgPoint(e) {
  const r = poster.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * POSTER_W, y: (e.clientY - r.top) / r.height * POSTER_H };
}

function setZoom(z) {
  S.photo.zoom = clamp(z, 1, 4);
  $('#in-zoom').value = Math.round(S.photo.zoom * 100);
  $('#lbl-zoom').textContent = Math.round(S.photo.zoom * 100) + '%';
  placePhoto();
  save();
}

function initPhotoGestures() {
  const hit = $('#photoHit');
  const pts = new Map();
  let last = null, pinch = 0;

  hit.addEventListener('pointerdown', e => {
    if (!S.photo.src) return;
    hit.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, svgPoint(e));
    if (pts.size === 1) last = svgPoint(e);
    if (pts.size === 2) pinch = dist();
  });

  hit.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    e.preventDefault();
    pts.set(e.pointerId, svgPoint(e));

    if (pts.size >= 2) {
      const d = dist();
      if (pinch > 0 && d > 0) setZoom(S.photo.zoom * (d / pinch));
      pinch = d;
      return;
    }
    const p = svgPoint(e);
    S.photo.ox += p.x - last.x;
    S.photo.oy += p.y - last.y;
    last = p;
    placePhoto();
  });

  const end = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    pinch = 0;
    if (pts.size === 1) last = [...pts.values()][0];
    if (pts.size === 0) save();
  };
  hit.addEventListener('pointerup', end);
  hit.addEventListener('pointercancel', end);

  hit.addEventListener('wheel', e => {
    if (!S.photo.src) return;
    e.preventDefault();
    setZoom(S.photo.zoom * (1 - e.deltaY * 0.0015));
  }, { passive: false });

  function dist() {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}

/* ===================== PNG 저장 ===================== */

const FONT_FILES = [
  ['PFDisplay', 'fonts/Pacifico-400.woff2'],
  ['PFHand',    'fonts/Caveat-700.woff2'],
  ['PFSans',    'fonts/Nunito-800.woff2'],
];
let fontCssCache = null;

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

async function fontCss() {
  if (fontCssCache !== null) return fontCssCache;
  const out = [];
  for (const [fam, url] of FONT_FILES) {
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      out.push(`@font-face{font-family:'${fam}';src:url(data:font/woff2;base64,${toBase64(buf)}) format('woff2')}`);
    } catch {}
  }
  fontCssCache = out.join('');
  return fontCssCache;
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
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = '저장 준비 중…';

  try {
    await document.fonts.ready;
    const css = await fontCss();

    const clone = poster.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', POSTER_W * EXPORT_SCALE);
    clone.setAttribute('height', POSTER_H * EXPORT_SCALE);
    $('#theme-style', clone).textContent = css + themeCss();
    clone.querySelector('#photoHit')?.remove();
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

function buildStickerUI() {
  const wrap = $('#sticker-list');
  wrap.innerHTML = '';
  for (const { k, name } of SLOTS) {
    const el = document.createElement('div');
    el.className = 'sticker';
    el.innerHTML = `
      <div class="nm">${name}</div>
      <div class="thumb" data-thumb="${k}"><span class="none">기본 일러스트</span></div>
      <div class="row">
        <label class="btn file">교체<input type="file" accept="image/png,image/webp,image/*" data-slot="${k}"></label>
        <button class="btn ghost" type="button" data-reset="${k}">되돌리기</button>
      </div>`;
    wrap.appendChild(el);
  }

  wrap.addEventListener('change', async e => {
    const k = e.target.dataset.slot;
    if (!k || !e.target.files[0]) return;
    try {
      const { src } = await readImage(e.target.files[0], 800, true);
      S.stickers[k] = src;
      render();
      updateStickerThumbs();
    } catch { toast('이미지를 읽지 못했어요.'); }
    e.target.value = '';
  });

  wrap.addEventListener('click', e => {
    const k = e.target.dataset.reset;
    if (!k) return;
    delete S.stickers[k];
    render();
    updateStickerThumbs();
  });
}

function updateStickerThumbs() {
  for (const { k } of SLOTS) {
    const box = $(`[data-thumb="${k}"]`);
    box.innerHTML = S.stickers[k]
      ? `<img src="${S.stickers[k]}" alt="">`
      : '<span class="none">기본 일러스트</span>';
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
  updateStickerThumbs();
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

  bindText('#in-pair',    v => S.pair = v);
  bindText('#in-c1-name', v => S.c1.name = v);
  bindText('#in-c2-name', v => S.c2.name = v);
  bindText('#in-c1-age',  v => S.c1.age = v);
  bindText('#in-c1-job',  v => S.c1.job = v);
  bindText('#in-c2-age',  v => S.c2.age = v);
  bindText('#in-c2-job',  v => S.c2.job = v);
  bindToggle('tg-c1', 'c1');
  bindToggle('tg-c2', 'c2');

  $('#in-photo').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const { src, w, h } = await readImage(f, 2200, false);
      S.photo = { src, nw: w, nh: h, zoom: 1, ox: 0, oy: 0 };
      setZoom(1);
      render();
    } catch { toast('사진을 읽지 못했어요.'); }
    e.target.value = '';
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

  initPhotoGestures();
  addEventListener('pagehide', saveNow);   // 지연 저장이 남아 있으면 떠나기 전에 비운다

  // 폰트가 준비된 뒤 렌더해야 글자 폭 측정이 정확하다.
  try {
    await Promise.all([
      document.fonts.load("152px 'PFDisplay'"),
      document.fonts.load("34px 'PFHand'"),
      document.fonts.load("19px 'PFSans'"),
    ]);
  } catch {}
  render();
}

init();

})();
