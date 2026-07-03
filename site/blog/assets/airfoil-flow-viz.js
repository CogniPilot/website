// Field heatmap over the smooth solid mask (gray) with the true NACA 2412
// contour on top. The default field is vorticity, which makes separated shear
// layers and stall visible. The picker can also show pressure q or speed |V|.
// Velocity-direction and streamline overlays are computed from the returned
// u/v states only; they add no solver work or extra readback. Grid size is
// discovered from the result names, so editing NX/NY just works. Only the
// integrated states u/v/q plus the lagged airfoil motor states are read; the
// mask is recomputed below so the overlay follows the same geometry on every
// solver path.
const cell = new Map();
let NX = 0, NY = 0;
names.forEach((n, k) => {
  const m = /^([uvq])\[(\d+),(\d+)\]$/.exec(n);
  if (!m) return;
  cell.set(`${m[1]}:${m[2]},${m[3]}`, data[k]);
  if (m[1] === 'u') {
    NX = Math.max(NX, Number(m[2]));
    NY = Math.max(NY, Number(m[3]));
  }
});
const speed = (i, j, f) => {
  const u = cell.get(`u:${i},${j}`);
  const v = cell.get(`v:${i},${j}`);
  if (!u || !v) return 0;
  return Math.hypot(u[f], v[f]);
};
const press = (i, j, f) => {
  const q = cell.get(`q:${i},${j}`);
  return q ? q[f] : 0;
};
const fieldDx = api.parameter('Lx', 4.0) / NX;
const fieldDy = api.parameter('Ly', 1.5) / NY;
const clippedIndex = (value, hi) => Math.max(1, Math.min(hi, value));
const vorticity = (i, j, f) => {
  const im = clippedIndex(i - 1, NX);
  const ip = clippedIndex(i + 1, NX);
  const jm = clippedIndex(j - 1, NY);
  const jp = clippedIndex(j + 1, NY);
  const dvdx = (cell.get(`v:${ip},${j}`)?.[f] - cell.get(`v:${im},${j}`)?.[f])
    / ((ip - im) * fieldDx);
  const dudy = (cell.get(`u:${i},${jp}`)?.[f] - cell.get(`u:${i},${jm}`)?.[f])
    / ((jp - jm) * fieldDy);
  return Number.isFinite(dvdx) && Number.isFinite(dudy) ? dvdx - dudy : 0;
};
// Velocity arrows use a global speed reference so their visibility does not
// flicker as the colorbar rescales frame-by-frame.
let vMax = 0;
for (let f = 0; f < times.length; f += 5) {
  for (let i = 1; i <= NX; i++) {
    for (let j = 1; j <= NY; j++) {
      vMax = Math.max(vMax, speed(i, j, f));
    }
  }
}
if (vMax <= 0) vMax = 1;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function framePressureRange(frame) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 1; i <= NX; i++) {
    for (let j = 1; j <= NY; j++) {
      const q = press(i, j, frame);
      if (!Number.isFinite(q)) continue;
      lo = Math.min(lo, q);
      hi = Math.max(hi, q);
    }
  }
  if (!(hi > lo)) return { lo: -1, hi: 1 };
  return { lo, hi };
}

function frameSpeedRange(frame) {
  let hi = 0;
  for (let i = 1; i <= NX; i++) {
    for (let j = 1; j <= NY; j++) hi = Math.max(hi, speed(i, j, frame));
  }
  return { lo: 0, hi: hi > 0 ? hi : 1 };
}

function frameVorticityRange(frame) {
  let span = 0;
  for (let i = 1; i <= NX; i++) {
    for (let j = 1; j <= NY; j++) {
      const w = vorticity(i, j, frame);
      if (Number.isFinite(w)) span = Math.max(span, Math.abs(w));
    }
  }
  span = span > 0 ? span : 1;
  return { lo: -span, hi: span };
}

// Available fields. `norm` maps a cell value into [0,1] for the heat colormap.
const fields = {
  vorticity: {
    label: 'Vorticity',
    range: frameVorticityRange,
    value: vorticity,
  },
  q: {
    label: 'Pressure q',
    range: framePressureRange,
    value: press,
  },
  speed: {
    label: 'Speed |V|',
    range: frameSpeedRange,
    value: speed,
  },
};
let mode = 'vorticity';   // default to the field that shows stall/separation.
let refreshColorbar = () => {};
// Geometry for the overlay — keep in sync with the model parameters.
// The command inputs seed the run; the lagged motor states drive the moving
// contour and mask frame-by-frame.
const mc0 = api.parameter('mc', api.parameter('mc0', 0.02));
const pc0 = api.parameter('pc', api.parameter('pc0', 0.4));
const tk0 = api.parameter('tk', api.parameter('tk0', 0.12));
const geo = {
  Lx: api.parameter('Lx', 4.0),
  Ly: api.parameter('Ly', 1.5),
  xle: api.parameter('xle', 1.0),
  mc: mc0,
  pc: pc0,
  tk: tk0,
};
const aoa = api.parameter('aoa', 8.0);
const aoaSeries = api.series('aoa_motor') || [aoa];
const mcSeries = api.series('mc_motor') || [mc0];
const pcSeries = api.series('pc_motor') || [pc0];
const tkSeries = api.series('tk_motor') || [tk0];
const frameSeriesValue = (series, frame, fallback) => {
  const value = series[Math.min(frame, series.length - 1)];
  return Number.isFinite(value) ? value : fallback;
};
const frameAoa = (frame) => frameSeriesValue(aoaSeries, frame, aoa);
function refreshGeometryParameters(frame) {
  geo.xle = api.parameter('xle', 1.0);
  geo.mc = frameSeriesValue(mcSeries, frame, mc0);
  geo.pc = Math.max(1e-3, Math.min(0.999, frameSeriesValue(pcSeries, frame, pc0)));
  geo.tk = Math.max(1e-6, frameSeriesValue(tkSeries, frame, tk0));
};
const camber = (sc) => sc < geo.pc
  ? geo.mc / geo.pc ** 2 * (2 * geo.pc * sc - sc ** 2)
  : geo.mc / (1 - geo.pc) ** 2 * ((1 - 2 * geo.pc) + 2 * geo.pc * sc - sc ** 2);
const halfThick = (sc) => 5 * geo.tk * (0.2969 * Math.sqrt(sc) - 0.1260 * sc
  - 0.3516 * sc ** 2 + 0.2843 * sc ** 3 - 0.1036 * sc ** 4);

// Smooth solid fraction sig(i, j) in [0, 1], recomputed here exactly as the
// model does so the overlay never depends on the solver returning algebraics.
// The grid spacing and tanh band widths mirror the AirfoilFlow parameters.
const dx = geo.Lx / NX, dy = geo.Ly / NY;
const epsn = api.parameter('epsn', 0.6 * dy);
const epss = api.parameter('epss', 0.8 * dx);
const tmin = api.parameter('tmin', 0.6 * dy);
function maskAt(i, j, angleDeg) {
  const ca = Math.cos(angleDeg * Math.PI / 180);
  const sa = Math.sin(angleDeg * Math.PI / 180);
  const xa = (i - 0.5) * dx - geo.xle;        // chord-frame offsets, pitched
  const ya = (j - 0.5) * dy - geo.Ly / 2;     // about the leading edge
  const sc = xa * ca - ya * sa;               // chordwise coordinate
  const nc = xa * sa + ya * ca;               // chord-normal coordinate
  const s = Math.max(sc, 0);
  const traw = 5 * geo.tk * (0.2969 * Math.sqrt(s) - 0.1260 * sc
    - 0.3516 * sc ** 2 + 0.2843 * sc ** 3 - 0.1036 * sc ** 4);
  const teff = Math.sqrt(traw ** 2 + tmin ** 2);   // softly floored half-thick
  const dthick = Math.abs(nc - camber(sc)) - teff; // signed distance to surface
  return 0.5 * (1 - Math.tanh(dthick / epsn))      // inside the thickness band
    * 0.5 * (1 + Math.tanh(sc / epss))             // past the leading edge
    * 0.5 * (1 + Math.tanh((1 - sc) / epss));      // before the trailing edge
}
const solidCache = new Map();
function solidFracFor(angleDeg) {
  const key = [
    angleDeg.toFixed(3),
    geo.xle.toFixed(4),
    geo.mc.toFixed(4),
    geo.pc.toFixed(4),
    geo.tk.toFixed(4),
  ].join(':');
  const cached = solidCache.get(key);
  if (cached) return cached;

  const solidFrac = new Map();
  for (let i = 1; i <= NX; i++) {
    for (let j = 1; j <= NY; j++) solidFrac.set(`${i},${j}`, maskAt(i, j, angleDeg));
  }
  solidCache.set(key, solidFrac);
  return solidFrac;
}

const W = 600;
const H = Math.round(W * (geo.Ly / geo.Lx));
const { ctx2d } = api.makeCanvas(W, H);
const cw = W / NX;
const ch = H / NY;
const px = (x) => (x / geo.Lx) * W;                    // physical x -> canvas
const py = (y) => H - ((y + geo.Ly / 2) / geo.Ly) * H; // physical y -> canvas

function airfoilFrame(angleDeg) {
  const ca = Math.cos(angleDeg * Math.PI / 180);
  const sa = Math.sin(angleDeg * Math.PI / 180);
  return {
    fx: (sc, h) => geo.xle + sc * ca + h * sa,
    fy: (sc, h) => -sc * sa + h * ca,
  };
}

function drawAirfoil(angleDeg) {
  const { fx, fy } = airfoilFrame(angleDeg);
  ctx2d.beginPath();
  for (let k = 0; k <= 60; k++) {            // upper surface, LE -> TE
    const sc = k / 60;
    const h = camber(sc) + halfThick(sc);
    const fn = k === 0 ? 'moveTo' : 'lineTo';
    ctx2d[fn](px(fx(sc, h)), py(fy(sc, h)));
  }
  for (let k = 60; k >= 0; k--) {            // lower surface, TE -> LE
    const sc = k / 60;
    const h = camber(sc) - halfThick(sc);
    ctx2d.lineTo(px(fx(sc, h)), py(fy(sc, h)));
  }
  ctx2d.closePath();
  ctx2d.fillStyle = '#111';
  ctx2d.fill();
  ctx2d.strokeStyle = '#fff';
  ctx2d.lineWidth = 1;
  ctx2d.stroke();
}

let showVelocityDirections = true;

function drawVelocityDirections(frame, solidFrac) {
  if (!showVelocityDirections || !NX || !NY || !Number.isFinite(vMax)) return;

  const stride = Math.max(1, Math.ceil(Math.max(NX, NY) / 28));
  const len = Math.max(4, 0.65 * stride * Math.min(cw, ch));

  function sampledVelocity(i0, j0) {
    let su = 0, sv = 0, sw = 0;
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const i = i0 + di, j = j0 + dj;
        if (i < 1 || i > NX || j < 1 || j > NY) continue;

        const m = solidFrac.get(`${i},${j}`) ?? 0;

        const uArr = cell.get(`u:${i},${j}`);
        const vArr = cell.get(`v:${i},${j}`);
        if (!uArr || !vArr) continue;

        const u = uArr[frame];
        const v = vArr[frame];
        if (!Number.isFinite(u) || !Number.isFinite(v)) continue;

        const w = (di === 0 && dj === 0 ? 2 : 1) * Math.max(0.05, 1 - m);
        su += w * u;
        sv += w * v;
        sw += w;
      }
    }
    return sw > 0 ? [su / sw, sv / sw] : [NaN, NaN];
  }

  ctx2d.save();
  ctx2d.lineCap = 'round';
  ctx2d.lineJoin = 'round';

  for (let i = 1; i <= NX; i += stride) {
    for (let j = 1; j <= NY; j += stride) {
      const [u, v] = sampledVelocity(i, j);
      const sp = Math.hypot(u, v);
      if (!Number.isFinite(sp) || sp <= 0) continue;

      const ux = u / sp;
      const uy = v / sp;
      const cx = (i - 0.5) * cw;
      const cy = (NY - j + 0.5) * ch;
      const dxp = ux * len;
      const dyp = -uy * len; // Physical +v points up; canvas +y points down.
      const x1 = cx - 0.5 * dxp;
      const y1 = cy - 0.5 * dyp;
      const x2 = cx + 0.5 * dxp;
      const y2 = cy + 0.5 * dyp;
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const head = Math.max(3, 0.25 * len);
      const alpha = 0.35 + 0.55 * clamp01(sp / (0.45 * vMax));

      ctx2d.strokeStyle = `rgba(0,0,0,${0.55 * alpha})`;
      ctx2d.lineWidth = 3.5;
      ctx2d.beginPath();
      ctx2d.moveTo(x1, y1);
      ctx2d.lineTo(x2, y2);
      ctx2d.lineTo(
        x2 - head * Math.cos(ang - Math.PI / 6),
        y2 - head * Math.sin(ang - Math.PI / 6)
      );
      ctx2d.moveTo(x2, y2);
      ctx2d.lineTo(
        x2 - head * Math.cos(ang + Math.PI / 6),
        y2 - head * Math.sin(ang + Math.PI / 6)
      );
      ctx2d.stroke();

      ctx2d.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx2d.lineWidth = 1.3;
      ctx2d.beginPath();
      ctx2d.moveTo(x1, y1);
      ctx2d.lineTo(x2, y2);
      ctx2d.lineTo(
        x2 - head * Math.cos(ang - Math.PI / 6),
        y2 - head * Math.sin(ang - Math.PI / 6)
      );
      ctx2d.moveTo(x2, y2);
      ctx2d.lineTo(
        x2 - head * Math.cos(ang + Math.PI / 6),
        y2 - head * Math.sin(ang + Math.PI / 6)
      );
      ctx2d.stroke();
    }
  }

  ctx2d.restore();
}

let showStreamlines = true;

function sampleGridValue(getValue, x, y, frame) {
  const fi = x / dx + 0.5;
  const fj = (y + geo.Ly / 2) / dy + 0.5;
  if (fi < 1 || fi > NX || fj < 1 || fj > NY) return NaN;

  const i0 = Math.max(1, Math.min(NX - 1, Math.floor(fi)));
  const j0 = Math.max(1, Math.min(NY - 1, Math.floor(fj)));
  const tx = clamp01(fi - i0);
  const ty = clamp01(fj - j0);

  const v00 = getValue(i0, j0, frame);
  const v10 = getValue(i0 + 1, j0, frame);
  const v01 = getValue(i0, j0 + 1, frame);
  const v11 = getValue(i0 + 1, j0 + 1, frame);
  if (![v00, v10, v01, v11].every(Number.isFinite)) return NaN;

  const a = v00 * (1 - tx) + v10 * tx;
  const b = v01 * (1 - tx) + v11 * tx;
  return a * (1 - ty) + b * ty;
}

function sampleVelocityAt(x, y, frame) {
  const u = sampleGridValue((i, j, f) => cell.get(`u:${i},${j}`)?.[f], x, y, frame);
  const v = sampleGridValue((i, j, f) => cell.get(`v:${i},${j}`)?.[f], x, y, frame);
  return Number.isFinite(u) && Number.isFinite(v) ? [u, v] : null;
}

function sampleSolidAt(x, y, solidFrac) {
  return sampleGridValue((i, j) => solidFrac.get(`${i},${j}`) ?? 0, x, y, 0);
}

function traceStreamline(seed, frame, solidFrac) {
  const ds = geo.Lx / 120;
  const pts = [];
  let x = seed.x, y = seed.y;

  for (let step = 0; step < 170; step++) {
    if (x < 0 || x > geo.Lx || y < -geo.Ly / 2 || y > geo.Ly / 2) break;
    if (sampleSolidAt(x, y, solidFrac) > 0.85) break;

    const vel = sampleVelocityAt(x, y, frame);
    if (!vel) break;

    const sp = Math.hypot(vel[0], vel[1]);
    if (!Number.isFinite(sp) || sp <= 0) break;

    pts.push([px(x), py(y)]);

    let ux = vel[0] / sp;
    let uy = vel[1] / sp;
    const midVel = sampleVelocityAt(x + 0.5 * ds * ux, y + 0.5 * ds * uy, frame);
    const midSpeed = midVel ? Math.hypot(midVel[0], midVel[1]) : 0;
    if (Number.isFinite(midSpeed) && midSpeed > 0) {
      ux = midVel[0] / midSpeed;
      uy = midVel[1] / midSpeed;
    }

    x += ds * ux;
    y += ds * uy;
  }

  return pts;
}

function streamlineSeeds() {
  const seeds = [];
  const inletX = 0.5 * dx;
  for (let k = 1; k <= 13; k++) {
    seeds.push({
      x: inletX,
      y: -geo.Ly / 2 + (k / 14) * geo.Ly,
    });
  }
  return seeds;
}

function drawStreamlines(frame, solidFrac) {
  if (!showStreamlines || !NX || !NY) return;

  ctx2d.save();
  ctx2d.lineCap = 'round';
  ctx2d.lineJoin = 'round';

  for (const seed of streamlineSeeds()) {
    const pts = traceStreamline(seed, frame, solidFrac);
    if (pts.length < 2) continue;

    ctx2d.beginPath();
    pts.forEach(([x, y], index) => {
      if (index === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    });
    ctx2d.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx2d.lineWidth = 3;
    ctx2d.stroke();

    ctx2d.beginPath();
    pts.forEach(([x, y], index) => {
      if (index === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    });
    ctx2d.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx2d.lineWidth = 1.15;
    ctx2d.stroke();
  }

  ctx2d.restore();
}

let lastFrame = 0;
const anim = api.addAnimation(times, (frame) => {
  lastFrame = frame;
  refreshGeometryParameters(frame);
  const fld = fields[mode];
  const range = fld.range(frame);
  const span = Math.max(1e-12, range.hi - range.lo);
  const angle = frameAoa(frame);
  const solidFrac = solidFracFor(angle);
  refreshColorbar(range);
  for (let i = 1; i <= NX; i++) {
    for (let j = 1; j <= NY; j++) {
      // The mask is smooth (sig in [0,1]); shade the selected field, then
      // overlay gray with opacity = sig so the differentiable boundary band
      // shows as a soft halo rather than a hard on/off cell edge.
      const m = solidFrac.get(`${i},${j}`);
      // j = 1 is the bottom row: flip the y axis for drawing.
      const rx = (i - 1) * cw, ry = (NY - j) * ch;
      ctx2d.fillStyle = api.heatColor(clamp01((fld.value(i, j, frame) - range.lo) / span));
      ctx2d.fillRect(rx, ry, cw + 1, ch + 1);
      if (m > 0.01) {
        ctx2d.fillStyle = `rgba(70,70,70,${Math.min(1, m)})`;
        ctx2d.fillRect(rx, ry, cw + 1, ch + 1);
      }
    }
  }
  try {
    drawStreamlines(frame, solidFrac);
    drawVelocityDirections(frame, solidFrac);
  } catch (e) {
    console.warn('Velocity overlay failed:', e);
    showStreamlines = false;
    showVelocityDirections = false;
  }
  drawAirfoil(angle);
  return `t = ${times[frame].toFixed(1)} s · ${fld.label} `
    + `∈ [${api.formatTick(range.lo)}, ${api.formatTick(range.hi)}]`;
}, 10000);

// Colorbar we can relabel when the field changes (api.addColorbar is static).
const bar = document.createElement('div');
bar.className = 'rumoca-live-radial-colorbar';
const grad = document.createElement('span');
grad.className = 'rumoca-live-radial-gradient';
const stops = [];
for (let i = 0; i <= 10; i++) stops.push(api.heatColor(i / 10));
grad.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
const loEl = document.createElement('span'), hiEl = document.createElement('span');
bar.append(loEl, grad, hiEl);
container.appendChild(bar);
refreshColorbar = (range = fields[mode].range(lastFrame)) => {
  loEl.textContent = api.formatTick(range.lo);
  hiEl.textContent = api.formatTick(range.hi);
};
refreshColorbar();

// Field picker: pressure (default) or speed. Switching repaints the current
// frame and relabels the colorbar; no recompile or re-run needed.
const fieldRow = document.createElement('div');
fieldRow.className = 'rumoca-live-tuner';
const fieldLabel = document.createElement('span');
fieldLabel.textContent = 'Field';
const fieldSel = document.createElement('select');
[
  ['vorticity', 'Vorticity'],
  ['q', 'Pressure'],
  ['speed', 'Speed |V|'],
].forEach(([value, text]) => {
  const opt = document.createElement('option');
  opt.value = value; opt.textContent = text;
  fieldSel.appendChild(opt);
});
fieldSel.value = mode;
fieldSel.addEventListener('change', () => {
  mode = fieldSel.value;
  refreshColorbar();
  anim.redraw(lastFrame);
});
const dirLabel = document.createElement('label');
dirLabel.style.display = 'inline-flex';
dirLabel.style.alignItems = 'center';
dirLabel.style.gap = '0.35rem';
dirLabel.style.marginLeft = '0.75rem';
const dirCheck = document.createElement('input');
dirCheck.type = 'checkbox';
dirCheck.checked = showVelocityDirections;
dirCheck.addEventListener('change', () => {
  showVelocityDirections = dirCheck.checked;
  anim.redraw(lastFrame);
});
dirLabel.append(dirCheck, document.createTextNode('Velocity direction'));

const streamLabel = document.createElement('label');
streamLabel.style.display = 'inline-flex';
streamLabel.style.alignItems = 'center';
streamLabel.style.gap = '0.35rem';
streamLabel.style.marginLeft = '0.75rem';
const streamCheck = document.createElement('input');
streamCheck.type = 'checkbox';
streamCheck.checked = showStreamlines;
streamCheck.addEventListener('change', () => {
  showStreamlines = streamCheck.checked;
  anim.redraw(lastFrame);
});
streamLabel.append(streamCheck, document.createTextNode('Streamlines'));

fieldRow.append(fieldLabel, fieldSel, dirLabel, streamLabel);
container.appendChild(fieldRow);

// Pitch the airfoil. With Interactive off this is a normal pre-run `aoa`
// parameter override. With Interactive on, the same slider drives the named
// model input `aoa_cmd`; the model's `aoa_motor` state follows it with a
// first-order lag.
api.addTuner('aoa', {
  min: -45,
  max: 45,
  step: 1,
  value: aoa,
  label: 'AoA °',
  interactiveInput: 'aoa_cmd',
});

api.addTuner('mc', {
  min: 0,
  max: 0.08,
  step: 0.005,
  value: mc0,
  label: 'Camber',
  interactiveInput: 'mc',
});

api.addTuner('pc', {
  min: 0.2,
  max: 0.8,
  step: 0.05,
  value: pc0,
  label: 'Camber pos',
  interactiveInput: 'pc',
});

api.addTuner('tk', {
  min: 0.06,
  max: 0.24,
  step: 0.01,
  value: tk0,
  label: 'Thickness',
  interactiveInput: 'tk',
});
