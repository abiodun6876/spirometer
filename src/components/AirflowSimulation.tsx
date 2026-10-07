import { useEffect, useMemo, useRef, useState } from "react";

/* ---------- Types ---------- */
export type AirflowSimulationProps = { fvc?: number; fev1?: number };
type Sample = { t: number; phase: 0 | 1 | 2; lung: number; flow: number };
type Particle = { path: number; s: number; dir: 1 | -1; jitter: number };

/* ---------- Test timeline (seconds) ---------- */
const DT = 0.02;
const T_IN1 = 1.8; // deep breath in before the blast
const T_EX = 15; // forced exhalation window
const T_IN2 = 2.2; // recovery breath in
const T_TOTAL = T_IN1 + T_EX + T_IN2;

/* ---------- Obstructive flow model ----------
   Flow = fast-decaying component + very slow component (the long tail).
   The slow time constant is solved so volume at 1 s equals FEV1. */
const g = (t: number, tau2: number) =>
  (1 - Math.exp(-t / 0.08)) * (0.55 * Math.exp(-t / 0.5) + 0.45 * Math.exp(-t / tau2));

const integrate = (tau2: number, tMax: number) => {
  const h = 0.005;
  let sum = 0;
  for (let t = h / 2; t < tMax; t += h) sum += g(t, tau2) * h;
  return sum;
};

function buildSamples(fvc: number, fev1: number) {
  const target = Math.max(0.05, Math.min(0.98, fev1 / fvc));
  let lo = 1, hi = 60;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const ratio = integrate(mid, 1) / integrate(mid, T_EX);
    ratio > target ? (lo = mid) : (hi = mid);
  }
  const tau2 = (lo + hi) / 2;
  const k = fvc / integrate(tau2, T_EX);
  const ease = (u: number) => (1 - Math.cos(Math.PI * u)) / 2;
  const insp = (T: number, s: number) => -fvc * (Math.PI / (2 * T)) * Math.sin((Math.PI * s) / T);

  const out: Sample[] = [];
  let exhaled = 0;
  const n = Math.round(T_TOTAL / DT);
  for (let i = 0; i <= n; i++) {
    const t = i * DT;
    if (t < T_IN1) {
      out.push({ t, phase: 0, lung: fvc * ease(t / T_IN1), flow: insp(T_IN1, t) });
    } else if (t < T_IN1 + T_EX) {
      const s = t - T_IN1;
      const f = k * g(s, tau2);
      exhaled += f * DT;
      out.push({ t, phase: 1, lung: Math.max(0, fvc - exhaled), flow: f });
    } else {
      const s = t - T_IN1 - T_EX;
      out.push({ t, phase: 2, lung: fvc * ease(Math.min(1, s / T_IN2)), flow: insp(T_IN2, s) });
    }
  }
  const pef = Math.max(...out.map((o) => o.flow));
  return { samples: out, pef };
}

/* ---------- Airway geometry (canvas coords 360 x 440), mouth = s 0 ---------- */
const PATHS: [number, number][][] = [
  [[180, 26], [180, 150], [130, 215], [105, 300], [95, 380]],
  [[180, 26], [180, 150], [130, 215], [150, 295], [152, 372]],
  [[180, 26], [180, 150], [230, 215], [255, 300], [265, 380]],
  [[180, 26], [180, 150], [230, 215], [210, 295], [208, 372]],
];
const WIDTHS = [13, 8, 4.5, 2.6];

const lens = PATHS.map((p) => {
  const c = [0];
  for (let i = 1; i < p.length; i++)
    c.push(c[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return c;
});

function pointAt(pi: number, s: number): [number, number] {
  const p = PATHS[pi], c = lens[pi];
  const d = Math.min(1, Math.max(0, s)) * c[c.length - 1];
  let i = 1;
  while (i < c.length - 1 && c[i] < d) i++;
  const u = (d - c[i - 1]) / (c[i] - c[i - 1] || 1);
  return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * u, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * u];
}

const sampleAt = (samples: Sample[], t: number): Sample => {
  const i = Math.floor(t / DT);
  return samples[Number.isFinite(i) ? Math.min(samples.length - 1, Math.max(0, i)) : 0];
};

/* ---------- Chart helpers ---------- */
const M = { l: 46, r: 14, t: 14, b: 36 };
const W = 420, H = 250;
const scale = (v: number, a: number, b: number, o0: number, o1: number) =>
  o0 + ((v - a) / (b - a)) * (o1 - o0);
const toPath = (pts: [number, number][]) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");

function Axes({ xs, ys, xl, yl, xf, yf }: {
  xs: number[]; ys: number[]; xl: string; yl: string;
  xf: (v: number) => number; yf: (v: number) => number;
}) {
  return (
    <g>
      {xs.map((v) => (
        <g key={"x" + v}>
          <line x1={xf(v)} x2={xf(v)} y1={M.t} y2={H - M.b} className="grid" />
          <text x={xf(v)} y={H - M.b + 15} textAnchor="middle" className="tick">{v}</text>
        </g>
      ))}
      {ys.map((v) => (
        <g key={"y" + v}>
          <line x1={M.l} x2={W - M.r} y1={yf(v)} y2={yf(v)} className={v === 0 ? "grid zero" : "grid"} />
          <text x={M.l - 7} y={yf(v) + 3.5} textAnchor="end" className="tick">{v}</text>
        </g>
      ))}
      <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" className="axis">{xl}</text>
      <text transform={`translate(11 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" className="axis">{yl}</text>
    </g>
  );
}

/* ---------- Component ---------- */
export function AirflowSimulation({ fvc = 2.31, fev1 = 0.456 }: AirflowSimulationProps) {
  const safeFvc = fvc > 0 ? fvc : 2.31;
  const safeFev1 = fev1 > 0 ? Math.min(fev1, safeFvc * 0.99) : 0.456;

  const { samples, pef } = useMemo(() => buildSamples(safeFvc, safeFev1), [safeFvc, safeFev1]);
  const exStart = Math.round(T_IN1 / DT);
  const exEnd = Math.round((T_IN1 + T_EX) / DT);

  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [time, setTime] = useState(reduced ? T_TOTAL : 0);
  const [playing, setPlaying] = useState(!reduced);
  const [speed, setSpeed] = useState(2);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const clock = useRef({ t: reduced ? T_TOTAL : 0, last: 0 });

  /* chart geometry */
  const maxVol = Math.max(safeFvc * 1.1, 2.5);
  const loopX = (v: number) => scale(v, 0, maxVol, M.l, W - M.r);
  const loopY = (v: number) => scale(v, -2, Math.max(pef * 1.1, 1), H - M.b, M.t);
  const vtX = (v: number) => scale(v, 0, T_EX, M.l, W - M.r);
  const vtY = (v: number) => scale(v, 0, maxVol, H - M.b, M.t);

  const loopPts = useMemo(
    () => samples.slice(exStart).map((s): [number, number] => [loopX(safeFvc - s.lung), loopY(s.flow)]),
    [samples, safeFvc, maxVol, pef] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const vtPts = useMemo(
    () => samples.slice(exStart, exEnd + 1).map((s): [number, number] => [vtX(s.t - T_IN1), vtY(safeFvc - s.lung)]),
    [samples, safeFvc, maxVol] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const idx = Math.min(samples.length - 1, Math.max(0, Math.floor(time / DT) || 0));
  const cur = samples[idx] || samples[0];
  const done = time >= T_TOTAL - DT;
  const status = done ? "TEST COMPLETE" : cur.phase === 1 ? "EXHALING..." : "INHALING...";

  /* animation loop */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    clock.current.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - clock.current.last) / 1000)) * speed;
      clock.current.last = now;
      clock.current.t = Math.min(T_TOTAL, clock.current.t + dt);
      stepParticles(dt);
      draw();
      setTime(clock.current.t);
      if (clock.current.t >= T_TOTAL) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, samples]);

  useEffect(() => { draw(); /* static redraw on mount / pause */ }); // eslint-disable-line

  function stepParticles(dt: number) {
    const sm = sampleAt(samples, clock.current.t);
    const f = Math.abs(sm.flow);
    const list = particles.current;
    const dir: 1 | -1 = sm.flow >= 0 ? -1 : 1; // exhale moves toward mouth (s down)
    if (f > 0.01 && list.length < 420) {
      const n = Math.random() < (110 * f * dt) % 1 ? 1 : 0;
      const count = Math.floor(110 * f * dt) + n;
      for (let i = 0; i < count; i++) {
        list.push({
          path: Math.floor(Math.random() * PATHS.length),
          s: dir === -1 ? 0.45 + Math.random() * 0.55 : 0,
          dir,
          jitter: (Math.random() - 0.5) * 2,
        });
      }
    }
    const v = 0.1 + 0.5 * f;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.s += p.dir * v * dt * (0.8 + 0.4 * Math.abs(p.jitter));
      if (p.s < 0 || p.s > 1) list.splice(i, 1);
    }
  }

  function draw() {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== 360 * dpr) { cv.width = 360 * dpr; cv.height = 440 * dpr; }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 360, 440);

    const sm = sampleAt(samples, clock.current.t);
    const fill = sm.lung / safeFvc; // 1 = full
    const sc = 0.86 + 0.14 * fill;

    // lungs, scaling with volume
    for (const cx of [110, 250]) {
      ctx.save();
      ctx.translate(cx, 285);
      ctx.scale(sc, sc);
      ctx.beginPath();
      ctx.ellipse(0, 0, 76, 122, cx < 180 ? 0.07 : -0.07, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(70,130,170,${0.07 + 0.1 * fill})`;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(40,90,125,0.45)";
      ctx.stroke();
      ctx.restore();
    }

    // airway walls (inflamed rim) then lumen
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const pass of [0, 1]) {
      PATHS.forEach((p) => {
        for (let i = 1; i < p.length; i++) {
          const w = WIDTHS[Math.min(i - 1, 3)] * 0.82; // narrowed lumen
          ctx.beginPath();
          ctx.moveTo(p[i - 1][0], p[i - 1][1]);
          ctx.lineTo(p[i][0], p[i][1]);
          ctx.lineWidth = pass === 0 ? w + 5 : w;
          ctx.strokeStyle = pass === 0 ? "rgba(196,120,60,0.38)" : "#F4F0E8";
          ctx.stroke();
        }
      });
    }

    // mouthpiece
    ctx.fillStyle = "#23364d";
    ctx.beginPath();
    ctx.roundRect(158, 4, 44, 20, 5);
    ctx.fill();

    // particles
    for (const p of particles.current) {
      const [x, y] = pointAt(p.path, p.s);
      const spread = (1 - p.s) * 0 + p.jitter * (p.s < 0.3 ? 3.5 : 1.6);
      ctx.beginPath();
      ctx.arc(x + spread, y, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = p.dir === -1 ? "rgba(214,126,36,0.85)" : "rgba(34,118,178,0.85)";
      ctx.fill();
    }
  }

  function replay() {
    clock.current.t = 0;
    particles.current = [];
    setTime(0);
    setPlaying(true);
  }

  const fvcShown = safeFvc - cur.lung > 0 ? (safeFvc - cur.lung) : 0;
  const ratio = (safeFev1 / safeFvc) * 100;
  const pattern = ratio >= 70 ? (safeFvc >= 3.0 ? "Normal" : "Restrictive") : "Obstructive";
  const n = Math.max(0, idx - exStart);
  const loopVisible = loopPts.slice(0, n + 1);
  const vtN = Math.min(vtPts.length - 1, n);
  const vtVisible = vtPts.slice(0, vtN + 1);
  const head = loopVisible[loopVisible.length - 1];
  const vhead = vtVisible[vtVisible.length - 1];

  const xsLoop = [0, 0.5, 1, 1.5, 2, 2.5];

  return (
    <section className="aw">
      <style>{css}</style>
      <header className="aw-head">
        <div>
          <h2>Airflow Simulation</h2>
          <p className={"status " + (done ? "done" : "")} role="status" aria-live="polite">{status}</p>
        </div>
        <div className="controls">
          <button onClick={() => (done ? replay() : setPlaying((p) => !p))}>
            {done ? "Replay" : playing ? "Pause" : "Play"}
          </button>
          <div className="seg" role="group" aria-label="Playback speed">
            {[1, 2, 4].map((s) => (
              <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>
            ))}
          </div>
        </div>
      </header>

      <p className="caption">
        Visualizing the most recent test (FVC: {safeFvc.toFixed(2)}L, FEV1: {safeFev1.toFixed(3)}L). {pattern === "Obstructive" ? "Notice the prolonged exhalation phase typical of an obstructive pattern." : "Flow and volume curves illustrate physiological respiratory mechanics."}
      </p>

      <div className="grid-wrap">
        <div className="panel airway">
          <canvas ref={canvasRef} style={{ width: 360, height: 440 }} aria-label="Animated airway with airflow particles" />
          <dl className="live">
            <div><dt>Flow</dt><dd>{cur.flow.toFixed(2)} L/s</dd></div>
            <div><dt>Exhaled</dt><dd>{(cur.phase === 1 ? fvcShown : cur.phase === 2 ? safeFvc : 0).toFixed(2)} L</dd></div>
            <div><dt>Time</dt><dd>{cur.phase === 1 ? (cur.t - T_IN1).toFixed(1) : "0.0"} s</dd></div>
          </dl>
        </div>

        <div className="charts">
          <div className="panel">
            <h3>Flow–volume loop</h3>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Flow volume loop">
              <Axes xs={xsLoop} ys={[-2, -1, 0, 1]} xl="Volume (L)" yl="Flow (L/s)" xf={loopX} yf={loopY} />
              <path d={toPath(loopPts)} className="ghost" />
              <path d={toPath(loopVisible)} className="trace" />
              {n > 0 && head && cur.phase > 0 && <circle cx={head[0]} cy={head[1]} r={4.5} className="dot" />}
              <text x={loopX(0.12) } y={loopY(pef) - 8} className="note">PEF {pef.toFixed(2)} L/s</text>
            </svg>
          </div>

          <div className="panel">
            <h3>Volume–time curve</h3>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Volume time curve">
              <Axes xs={[0, 3, 6, 9, 12, 15]} ys={[0, 0.5, 1, 1.5, 2, 2.5]} xl="Time (s)" yl="Volume (L)" xf={vtX} yf={vtY} />
              <line x1={vtX(1)} x2={vtX(1)} y1={M.t} y2={H - M.b} className="guide" />
              <line x1={M.l} x2={vtX(1)} y1={vtY(safeFev1)} y2={vtY(safeFev1)} className="guide" />
              <line x1={M.l} x2={W - M.r} y1={vtY(safeFvc)} y2={vtY(safeFvc)} className="guide" />
              <text x={vtX(1) + 6} y={vtY(safeFev1) - 6} className="note">FEV1 {safeFev1.toFixed(3)} L @ 1 s</text>
              <text x={W - M.r - 4} y={vtY(safeFvc) - 6} textAnchor="end" className="note">FVC {safeFvc.toFixed(2)} L</text>
              <path d={toPath(vtPts)} className="ghost" />
              <path d={toPath(vtVisible)} className="trace" />
              {cur.phase === 1 && vhead && <circle cx={vhead[0]} cy={vhead[1]} r={4.5} className="dot" />}
            </svg>
          </div>
        </div>
      </div>

      <ul className="stats">
        <li><span>FVC</span><b>{safeFvc.toFixed(2)} L</b></li>
        <li><span>FEV1</span><b>{safeFev1.toFixed(3)} L</b></li>
        <li><span>FEV1 / FVC</span><b>{ratio.toFixed(1)}%</b></li>
        <li><span>Pattern</span><b>{pattern}</b></li>
      </ul>
    </section>
  );
}

/* ---------- Styles ---------- */
const css = `
.aw{--paper:#ECEFEA;--card:#FBFAF6;--ink:#1D2B3F;--muted:#5C6B7C;--rule:#CBD3CF;--exh:#D67E24;--inh:#2276B2;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper);
  padding:28px;border-radius:14px;max-width:100%;box-sizing:border-box;margin:28px 0}
.aw h2{font-family:Charter,"Iowan Old Style",Georgia,serif;font-size:26px;font-weight:600;margin:0;letter-spacing:-.01em;color:var(--ink)}
.aw h3{font-size:13px;font-weight:600;margin:0 0 6px;color:var(--muted)}
.aw-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.status{margin:6px 0 0;font-weight:700;letter-spacing:.04em;color:var(--exh);min-height:1.4em}
.status.done{color:var(--muted)}
.caption{max-width:62ch;line-height:1.5;color:var(--muted);margin:10px 0 20px}
.controls{display:flex;gap:10px;align-items:center}
.aw button{font:inherit;font-size:14px;padding:7px 14px;border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:8px;cursor:pointer}
.aw button:focus-visible{outline:3px solid var(--inh);outline-offset:2px}
.seg{display:flex;border:1px solid var(--ink);border-radius:8px;overflow:hidden}
.seg button{background:transparent;color:var(--ink);border:0;border-radius:0;padding:7px 11px}
.seg button[aria-pressed=true]{background:var(--ink);color:#fff}
.grid-wrap{display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:18px;align-items:start}
.panel{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:12px}
.airway canvas{display:block;max-width:100%;height:auto!important;margin:0 auto}
.live{display:flex;justify-content:space-between;margin:8px 4px 0;font-variant-numeric:tabular-nums}
.live div{display:flex;flex-direction:column;gap:2px}
.live dt{font-size:12px;color:var(--muted)}.live dd{margin:0;font-weight:600}
.charts{display:grid;gap:14px}
.charts svg{width:100%;height:auto;display:block}
.grid{stroke:#D7DDD9;stroke-width:1}.grid.zero{stroke:#8795A3;stroke-width:1.2}
.tick{font-size:10px;fill:var(--muted);font-variant-numeric:tabular-nums}
.axis{font-size:11px;fill:var(--muted)}
.ghost{fill:none;stroke:#AEB9C3;stroke-width:1.2;stroke-dasharray:3 4}
.trace{fill:none;stroke:var(--ink);stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}
.dot{fill:var(--exh);stroke:#fff;stroke-width:2}
.guide{stroke:var(--inh);stroke-width:1;stroke-dasharray:5 4}
.note{font-size:11px;fill:var(--ink);font-weight:600}
.stats{list-style:none;display:flex;gap:28px;flex-wrap:wrap;padding:16px 4px 0;margin:16px 0 0;border-top:1px solid var(--rule)}
.stats li{display:flex;flex-direction:column;gap:2px}
.stats span{font-size:12px;color:var(--muted)}
.stats b{font-size:20px;font-variant-numeric:tabular-nums}
@media (max-width:760px){.grid-wrap{grid-template-columns:1fr}.aw{padding:16px}}
`;

export default AirflowSimulation;

