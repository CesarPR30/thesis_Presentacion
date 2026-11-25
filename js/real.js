/* Figuras construidas solo con datos reales del pipeline (data/deck-data.js).
   Nada se simula: cada trazo sale de un artefacto publicado. */
"use strict";

/** Metros del recorte (x al este, y al sur) → lienzo 0–600 de las lentes. */
const T600 = (x, y) => [(x + MAP.R) * MAP.s, (y + MAP.R) * MAP.s];
const bg600 = g => el(g, "rect", { x: -40, y: -40, width: 680, height: 680, fill: "#fbfbfc" });
const streets600 = (g, col = "#cfd4db", w = 1.3) => { const eg = el(g, "g", { stroke: col }); MAP.paths.forEach(d => el(eg, "path", { d, fill: "none", "stroke-width": w })); return eg; };
const polyline600 = (g, pts, attrs) => el(g, "polyline", { points: pts.map(p => T600(p[0], p[1]).map(v => v.toFixed(1)).join(",")).join(" "), fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round", ...attrs });

/* ═══ C1 · Cinco representaciones del mismo mes real ══════════════════ */
function drawReps(svg) {
  const R = window.DECK.real.districts;
  // Conteo por intersección: cada denuncia a su nodo más cercano.
  const cnt = new Array(MAP.nodes.length).fill(0);
  MAP.crimes.forEach(p => { let b = 0, bd = Infinity; MAP.nodes.forEach((n, i) => { const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2; if (d < bd) { bd = d; b = i; } }); cnt[b]++; });
  const cmax = Math.max(...cnt);
  // Grilla de 200 m alineada al lienzo.
  const cell = 200 * MAP.s, n = Math.ceil(600 / cell), gc = new Array(n * n).fill(0);
  MAP.crimes.forEach(p => { const i = Math.floor(p.x / cell), j = Math.floor(p.y / cell); if (i >= 0 && j >= 0 && i < n && j < n) gc[j * n + i]++; });
  const gmax = Math.max(...gc);
  // Distritos: el distrito mayoritario de cada celda de 200 m del recorte (crimes.bin).
  const dmax = Math.max(...Object.values(R.places).map(p => p.crimes));
  const dcell = R.cell_m * MAP.s, key = (x, y) => Math.round(x) + "," + Math.round(y);
  const dmap = new Map(R.cells.map(c => [key(c[0], c[1]), c[2]]));
  const districts = g => {
    bg600(g);
    R.cells.forEach(([x, y, p]) => { const [cx, cy] = T600(x, y);
      el(g, "rect", { x: cx - dcell / 2, y: cy - dcell / 2, width: dcell + .6, height: dcell + .6, fill: ramp(.15 + .85 * Math.pow(R.places[p].crimes / dmax, .6)) }); });
    const bd = el(g, "g", { stroke: "#fff", "stroke-width": 6, "stroke-linecap": "round" });
    R.cells.forEach(([x, y, p]) => {
      const [cx, cy] = T600(x, y), right = dmap.get(key(x + R.cell_m, y)), down = dmap.get(key(x, y + R.cell_m));
      if (right !== undefined && right !== p) el(bd, "line", { x1: cx + dcell / 2, x2: cx + dcell / 2, y1: cy - dcell / 2, y2: cy + dcell / 2 });
      if (down !== undefined && down !== p) el(bd, "line", { x1: cx - dcell / 2, x2: cx + dcell / 2, y1: cy + dcell / 2, y2: cy + dcell / 2 });
    });
    streets600(g, "#5d6470", 1);
  };
  const reps = [
    ["Mapa de calor", "distancia plana", g => { bg600(g); const hg = el(g, "g");
      MAP.crimes.forEach(p => el(hg, "circle", { cx: p.x, cy: p.y, r: 34, fill: C.orange, opacity: .06 })); streets600(g, "#9aa1ac", 1.1); }, false],
    ["Distritos", "fronteras administrativas", districts, false],
    ["Grilla regular", "depende de la celda", g => { bg600(g);
      gc.forEach((c, k) => { if (c) el(g, "rect", { x: (k % n) * cell, y: Math.floor(k / n) * cell, width: cell, height: cell, fill: ramp(Math.pow(c / gmax, .6)) }); });
      streets600(g, "#5d6470", 1); const lg = el(g, "g", { stroke: "#fff", "stroke-width": 2 });
      for (let i = 0; i <= n; i++) { el(lg, "line", { x1: i * cell, x2: i * cell, y1: 0, y2: 600 }); el(lg, "line", { y1: i * cell, y2: i * cell, x1: 0, x2: 600 }); } }, false],
    ["Intersección", "unidades aisladas", g => { bg600(g); streets600(g);
      cnt.forEach((c, i) => { if (c) el(g, "circle", { cx: MAP.nodes[i].x, cy: MAP.nodes[i].y, r: 4 + 14 * Math.sqrt(c / cmax), fill: C.orange, opacity: .85 }); }); }, false],
    ["Subgrafo conexo", "esta tesis", g => drawCity(g, "hotspots"), true],
  ];
  const X = [100, 300, 500, 700, 900], Y = 250, RR = 92;
  reps.forEach(([t, s, draw, ours], i) => {
    lens(svg, { cx: X[i], cy: Y, r: RR, draw });
    if (ours) el(svg, "circle", { cx: X[i], cy: Y, r: RR + 7, fill: "none", stroke: C.orange, "stroke-width": 3 });
    el(svg, "text", { x: X[i], y: Y + RR + 38, "text-anchor": "middle", "font-size": 16, "font-weight": 750, fill: ours ? C.orangeDeep : C.ink }, t);
    el(svg, "text", { x: X[i], y: Y + RR + 60, "text-anchor": "middle", "font-size": 13.5, fill: ours ? C.tealDeep : C.muted }, (ours ? "✓ " : "✗ ") + s);
  });
  const names = Object.values(R.places).filter(p => p.crimes > 0).map(p => p.name === "LIMA" ? "Cercado" : p.name.charAt(0) + p.name.slice(1).toLowerCase());
  el(svg, "text", { x: 500, y: 80, "text-anchor": "middle", "font-size": 17, "font-weight": 700, fill: C.ink2 }, `Las mismas ${fmtN(MAP.crimes.length)} denuncias de ${mesLargo(MAP.month)}, cinco hotspots distintos`);
  el(svg, "text", { x: 500, y: 560, "text-anchor": "middle", "font-size": 12, fill: C.faint }, `Recorte real del centro de Lima · distritos: ${names.join(", ")} (celdas de 200 m)`);
}

/* ═══ C2 · Una trayectoria real que cambia, desaparece y reaparece ════ */
function drawEvo(svg) {
  const Tr = window.DECK.real.trajectory; if (!Tr) return;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  Tr.frames.forEach(f => f.lines.forEach(l => l.forEach(([x, y]) => { const [a, b] = T600(x, y);
    x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); })));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = 480 / Math.max(x1 - x0, y1 - y0, 60);
  const X = [130, 375, 625, 870], Y = 290, R = 108;
  const labs = ["aparece", "cambia su topología", "no detectado", "reaparece"];
  Tr.frames.forEach((f, i) => {
    lens(svg, { cx: X[i], cy: Y, r: R, draw: g => {
      bg600(g);
      const z = el(g, "g", { transform: `translate(300,300) scale(${k}) translate(${-cx},${-cy})` });
      const eg = el(z, "g", { stroke: "#d5d9e0" }); MAP.paths.forEach(d => el(eg, "path", { d, fill: "none", "stroke-width": 1.6 / k }));
      f.lines.forEach(l => polyline600(z, l, { stroke: C.orange, "stroke-width": 5 / k }));
    } });
    el(svg, "text", { x: X[i], y: Y - R - 40, "text-anchor": "middle", "font-size": 20, "font-weight": 800, fill: C.ink2 }, mesLargo(f.month));
    el(svg, "text", { x: X[i], y: Y - R - 18, "text-anchor": "middle", "font-size": 12.5, fill: C.muted }, f.id ? `${f.id} · ${f.crimes} delitos` : "ninguna región pasa el test");
    el(svg, "text", { x: X[i], y: Y + R + 34, "text-anchor": "middle", "font-size": 15, "font-weight": 650, fill: f.id ? C.orangeDeep : C.muted }, labs[i]);
    if (i < 3) curve(svg, X[i] + R + 6, Y, X[i + 1] - R - 10, Y, 0, "ah").setAttribute("class", "fade");
  });
  el(svg, "text", { x: 500, y: 520, "text-anchor": "middle", "font-size": 12.5, fill: C.muted },
    `Trayectoria real ${Tr.id}: ${Tr.k} apariciones · estabilidad ${comma(Tr.stability.toFixed(2))} · desplazamiento ${fmtN(Tr.movement_m)} m`);
}

/* ═══ Join tree y persistencia sobre la densidad real del recorte ═════ */
function drawJoinTree(svg) {
  const f = MAP.f, N = f.length, fmax = Math.max(...f), tau = .3 * fmax, fmin = .1 * fmax;
  // Barrido descendente con union-find: pares (nacimiento, muerte) de cada máximo.
  const order = [...f.keys()].filter(v => f[v] >= fmin).sort((a, b) => f[b] - f[a]);
  const par = new Int32Array(N).fill(-1), peak = new Int32Array(N).map((_, i) => i);
  const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const pairs = [];
  for (const v of order) {
    par[v] = v;
    for (const [u] of MAP.adj[v]) {
      if (par[u] < 0) continue;
      const a = find(v), b = find(u); if (a === b) continue;
      const [hi, lo] = f[peak[a]] >= f[peak[b]] ? [a, b] : [b, a];
      if (peak[lo] !== v) pairs.push({ m: peak[lo], birth: f[peak[lo]], death: f[v] });
      par[lo] = hi;
    }
  }
  new Set(order.map(find)).forEach(r => pairs.push({ m: peak[r], birth: f[peak[r]], death: fmin, root: true }));
  pairs.forEach(p => p.keep = p.birth - p.death >= tau);
  const survivors = pairs.filter(p => p.keep).sort((a, b) => b.birth - a.birth);
  const ZONE = ["#f5733f", "#3b82c4", "#7c6bd6", "#d99a00", "#d4537e", "#5b8c3a"];
  const colOf = new Map(survivors.map((p, i) => [p.m, ZONE[i % ZONE.length]]));

  // Lente con la red real; cada arista se recolorea según la isla a la que pertenece.
  const paths = [];
  lens(svg, { cx: 290, cy: 320, r: 255, draw: g => {
    bg600(g);
    MAP.edges.forEach((e, i) => paths.push(el(g, "path", { d: MAP.paths[i], fill: "none", stroke: "#dde1e6", "stroke-width": 1.4, "stroke-linecap": "round" })));
  } });
  el(svg, "text", { x: 290, y: 46, "text-anchor": "middle", "font-size": 15, "font-weight": 650, fill: C.ink2 }, `Densidad real del recorte, ${mesLargo(MAP.month)}`);
  // Termómetro del nivel del agua.
  const TX = 575, TY0 = 110, TY1 = 530, ty = v => TY1 - v / fmax * (TY1 - TY0);
  el(svg, "rect", { x: TX - 6, y: TY0, width: 12, height: TY1 - TY0, rx: 6, fill: "#eef0f3" });
  const water = el(svg, "rect", { x: TX - 6, width: 12, rx: 6, fill: C.teal, opacity: .5 });
  const wl = el(svg, "line", { x1: TX - 14, x2: TX + 14, stroke: C.tealDeep, "stroke-width": 2.5 });
  el(svg, "text", { x: TX, y: TY0 - 12, "text-anchor": "middle", "font-size": 12, fill: C.muted }, "nivel f");
  el(svg, "line", { x1: TX - 12, x2: TX + 12, y1: ty(fmin), y2: ty(fmin), stroke: C.ink2, "stroke-dasharray": "3 3" });
  el(svg, "text", { x: TX + 16, y: ty(fmin) + 4, "font-size": 11, fill: C.ink2 }, "f_min");
  // Diagrama de persistencia (nacimiento vs muerte).
  const DX = 660, DY = 110, DW = 300, DH = 300, dx = v => DX + v / fmax * DW, dy = v => DY + DH - v / fmax * DH;
  el(svg, "rect", { x: DX, y: DY, width: DW, height: DH, fill: "#fff", stroke: C.line });
  el(svg, "path", { d: `M${dx(0)} ${dy(0)}L${dx(fmax)} ${dy(fmax)}L${dx(fmax)} ${dy(fmax - tau)}L${dx(tau)} ${dy(0)}Z`, fill: "#eef0f3" });
  el(svg, "line", { x1: dx(0), y1: dy(0), x2: dx(fmax), y2: dy(fmax), stroke: "#c7ccd4" });
  el(svg, "line", { x1: dx(tau), y1: dy(0), x2: dx(fmax), y2: dy(fmax - tau), stroke: C.ink2, "stroke-dasharray": "5 4" });
  el(svg, "text", { x: dx(fmax) - 6, y: dy(fmax - tau) + 16, "text-anchor": "end", "font-size": 12, fill: C.ink2 }, "π = τ");
  el(svg, "text", { x: DX + DW / 2, y: DY + DH + 30, "text-anchor": "middle", "font-size": 12.5, fill: C.muted }, "nacimiento f(m)");
  el(svg, "text", { x: DX - 14, y: DY + DH / 2, "text-anchor": "middle", "font-size": 12.5, fill: C.muted, transform: `rotate(-90 ${DX - 14} ${DY + DH / 2})` }, "muerte f(sₘ)");
  el(svg, "text", { x: DX, y: DY - 14, "font-size": 15, "font-weight": 650, fill: C.ink2 }, "Diagrama de persistencia");
  pairs.forEach(p => el(svg, "circle", { cx: dx(p.birth), cy: dy(p.death), r: p.keep ? 7 : 4, fill: p.keep ? colOf.get(p.m) : "#9aa1ac", stroke: "#fff", "stroke-width": 1.5, opacity: p.keep ? 1 : .8 }));
  el(svg, "text", { x: DX, y: DY + DH + 56, "font-size": 13, fill: C.ink2 },
    `${pairs.length} máximos · ${survivors.length} con π ≥ τ = 0,3·máx f · el resto se absorbe`);
  el(svg, "text", { x: DX, y: DY + DH + 78, "font-size": 12, fill: C.muted }, "Calculado aquí solo sobre el recorte. Con la ciudad completa,");
  el(svg, "text", { x: DX, y: DY + DH + 95, "font-size": 12, fill: C.muted }, `el pipeline extrae en esta zona: ${MAP.hotspots.length} regiones (${EX.clip.hotspots.map(h => h.id.slice(8)).join(", ")}).`);

  function paint(L) {
    const lv = Math.max(L, fmin), p2 = new Int32Array(N).fill(-1), fd = i => { while (p2[i] !== i) { p2[i] = p2[p2[i]]; i = p2[i]; } return i; };
    const top = new Map();
    order.forEach(v => { if (f[v] >= lv) p2[v] = v; });
    order.forEach(v => { if (p2[v] < 0) return; MAP.adj[v].forEach(([u]) => { if (p2[u] >= 0) { const a = fd(v), b = fd(u); if (a !== b) p2[a] = b; } }); });
    // Color de cada isla: el de su máximo superviviente más alto (gris si solo tiene ruido).
    survivors.forEach(s => { if (p2[s.m] >= 0) { const r = fd(s.m); if (!top.has(r)) top.set(r, colOf.get(s.m)); } });
    const islands = new Set();
    MAP.edges.forEach(([a, b], i) => {
      const on = p2[a] >= 0 && p2[b] >= 0 && fd(a) === fd(b);
      if (on) islands.add(fd(a));
      const col = on ? (top.get(fd(a)) || "#9aa1ac") : "#dde1e6";
      paths[i].setAttribute("stroke", col); paths[i].setAttribute("stroke-width", on ? 3.4 : 1.4);
    });
    water.setAttribute("y", ty(lv)); water.setAttribute("height", TY1 - ty(lv));
    wl.setAttribute("y1", ty(lv)); wl.setAttribute("y2", ty(lv));
    const w = document.getElementById("water-n"); if (w) w.textContent = [...islands].filter(r => top.has(r)).length;
  }
  let t0 = null, raf = 0;
  function frame(ts) {
    if (!isOn(svg)) { raf = 0; return; }
    if (t0 === null) t0 = ts;
    const t = ((ts - t0) % 8000) / 8000;
    paint(t < .8 ? fmax * (1 - t / .8) : fmin);
    raf = requestAnimationFrame(frame);
  }
  paint(.5 * fmax);
  return () => { if (REDUCED) { paint(fmin); return; } if (!raf) { t0 = null; raf = requestAnimationFrame(frame); } };
}

/* ═══ Monte Carlo con el nulo real del mes ═══════════════════════════ */
function drawMCReal(svg) {
  const month = MAP.month, d = window.DECK.selection[month];
  const nObs = MAP.crimes.length, R0 = rng(7);
  // Izquierda: denuncias reales del mes. Derecha: una réplica del nulo, uniforme sobre los nodos reales.
  lens(svg, { cx: 170, cy: 190, r: 140, draw: g => { bg600(g); streets600(g);
    const cg = el(g, "g", { fill: C.orange }); MAP.crimes.forEach(p => el(cg, "circle", { cx: p.x, cy: p.y, r: 5, opacity: .85 })); } });
  let repG = null;
  lens(svg, { cx: 480, cy: 190, r: 140, draw: g => { bg600(g); streets600(g); repG = el(g, "g", { fill: "#7b8494" }); } });
  const shuffle = () => { repG.textContent = ""; for (let i = 0; i < nObs; i++) { const v = Math.floor(R0() * MAP.nodes.length); el(repG, "circle", { cx: MAP.nodes[v].x, cy: MAP.nodes[v].y, r: 5, opacity: .75 }); } };
  shuffle();
  el(svg, "text", { x: 170, y: 30, "text-anchor": "middle", "font-size": 15, "font-weight": 650, fill: C.orangeDeep }, `Observado: ${fmtN(nObs)} denuncias`);
  el(svg, "text", { x: 480, y: 30, "text-anchor": "middle", "font-size": 15, "font-weight": 650, fill: C.muted }, "Nulo: uniforme sobre los nodos");
  const counter = el(svg, "text", { x: 790, y: 180, "text-anchor": "middle", "font-size": 52, "font-weight": 800, fill: C.ink2 }, "0");
  el(svg, "text", { x: 790, y: 208, "text-anchor": "middle", "font-size": 14, fill: C.muted }, `réplicas de ${mesLargo(month)} (B = 99)`);
  // Abajo: Λ de las regiones del mes frente al máximo del nulo (valores reales de la selección).
  const X0 = 60, X1 = 950, Y = 470, vmax = Math.max(d.llr[0] || 0, d.nMax) * 1.05, x = v => X0 + Math.sqrt(v / vmax) * (X1 - X0);
  el(svg, "text", { x: X0, y: 360, "font-size": 15, "font-weight": 650, fill: C.ink }, `${mesLargo(month)}: ${d.cand} regiones candidatas · Λ en escala raíz`);
  el(svg, "line", { x1: X0, x2: X1, y1: Y, y2: Y, stroke: "#c7ccd4", "stroke-width": 1.5 });
  const band = el(svg, "g", { class: "fade", style: "--d:.2s" });
  el(band, "rect", { x: x(d.nMean), y: Y - 34, width: x(d.nMax) - x(d.nMean), height: 34, fill: "#e6e8ec", rx: 4 });
  el(band, "text", { x: x(d.nMean), y: Y - 42, "font-size": 12, fill: C.muted }, `Λ máx. del nulo: media ${comma(d.nMean.toFixed(0))} … máx. ${comma(d.nMax.toFixed(0))}`);
  el(band, "line", { x1: x(d.thr), x2: x(d.thr), y1: Y - 60, y2: Y + 8, stroke: C.teal, "stroke-width": 3 });
  el(band, "text", { x: x(d.thr), y: Y + 26, "text-anchor": "middle", "font-size": 12.5, "font-weight": 700, fill: C.tealDeep }, `umbral p95 = ${comma(d.thr.toFixed(1))}`);
  const tg = el(svg, "g", { class: "fade", style: "--d:.5s" });
  d.llr.forEach(v => el(tg, "line", { x1: x(v), x2: x(v), y1: Y - 22, y2: Y + 6, stroke: C.orange, "stroke-width": 2, opacity: .75 }));
  el(tg, "text", { x: x(d.llr[0]), y: Y + 26, "text-anchor": "end", "font-size": 12.5, "font-weight": 700, fill: C.orangeDeep }, `Λ = ${Math.round(d.llr[0])}`);
  el(svg, "text", { x: X0, y: Y + 56, "font-size": 13, fill: C.ink2 }, `${d.kept} regiones superan el umbral (marcas naranjas) · el resto lo iguala el azar`);
  const pv = el(svg, "g", { opacity: 0 });
  el(pv, "rect", { x: 650, y: 236, width: 280, height: 46, rx: 8, fill: C.teal });
  el(pv, "text", { x: 790, y: 265, "text-anchor": "middle", "font-size": 16, "font-weight": 700, fill: "#fff" }, d.llr[0] > d.nMax ? "región más fuerte: p = 1/100 = 0,01" : "");
  let timer = 0;
  return () => {
    clearInterval(timer); pv.setAttribute("opacity", 0);
    let b = 0;
    if (REDUCED) { counter.textContent = 99; pv.setAttribute("opacity", 1); return; }
    timer = setInterval(() => {
      if (!isOn(svg) || b >= 99) { clearInterval(timer); if (b >= 99) pv.setAttribute("opacity", 1); return; }
      b++; counter.textContent = b; shuffle();
    }, 45);
  };
}

/* ═══ Coseno: el hotspot y sus 5 vecinos reales, con su forma ═════════ */
function drawCosReal(svg) {
  const items = window.DECK.real.similar.items;
  const shape = (g, it, x, y, w, h, col, sw) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    it.lines.forEach(l => l.forEach(([a, b]) => { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }));
    const k = Math.min(w / (x1 - x0 || 1), h / (y1 - y0 || 1)), ox = x + (w - (x1 - x0) * k) / 2, oy = y + (h - (y1 - y0) * k) / 2;
    it.lines.forEach(l => el(g, "polyline", { points: l.map(([a, b]) => `${(ox + (a - x0) * k).toFixed(1)},${(oy + (b - y0) * k).toFixed(1)}`).join(" "),
      fill: "none", stroke: col, "stroke-width": sw, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    // Escala de 100 m.
    const px = 100 * k; el(g, "path", { d: `M${x + w - px} ${y + h + 6}v4h${px}v-4`, fill: "none", stroke: C.faint, "stroke-width": 1.2 });
    el(g, "text", { x: x + w - px / 2, y: y + h + 22, "text-anchor": "middle", "font-size": 10.5, fill: C.faint }, "100 m");
  };
  const q = items[0];
  el(svg, "rect", { x: 20, y: 20, width: 210, height: 250, rx: 12, fill: "#fff", stroke: C.orange, "stroke-width": 2 });
  el(svg, "text", { x: 36, y: 46, "font-size": 14, "font-weight": 700, fill: C.orangeDeep }, "Consulta");
  el(svg, "text", { x: 36, y: 64, "font-size": 12, fill: C.muted }, q.id);
  shape(svg, q, 40, 80, 170, 150, C.orangeDeep, 2.6);
  items.slice(1).forEach((it, i) => {
    const x = 250 + (i < 3 ? i : i - 3) * 75, y = i < 3 ? 20 : 150;
    const W = 70, H = 125, g = el(svg, "g", { class: "fade", style: `--d:${(.2 + i * .1).toFixed(1)}s` });
    el(g, "rect", { x, y, width: W, height: H, rx: 10, fill: "#fff", stroke: C.line });
    shape(g, it, x + 8, y + 28, W - 16, H - 60, C.ink2, 1.6);
    el(g, "text", { x: x + W / 2, y: y + 18, "text-anchor": "middle", "font-size": 13, "font-weight": 800, fill: C.orangeDeep }, comma(it.score.toFixed(2)));
  });
  el(svg, "text", { x: 250, y: 300, "font-size": 12.5, fill: C.muted }, "cos con la consulta · formas reales");
  el(svg, "text", { x: 20, y: 330, "font-size": 15, "font-weight": 650, fill: C.ink2 }, "Los 5 más parecidos son de otros meses y lugares:");
  items.slice(1).forEach((it, i) => el(svg, "text", { x: 20, y: 356 + i * 22, "font-size": 13, fill: C.ink2 }, `${it.id} · ${mesLargo(it.id.slice(0, 7))} · cos = ${comma(it.score.toFixed(3))}`));
  // Derecha: proyección real de todos los hotspots (UMAP), como en figures.js.
  const E = EX.embedding, X0 = 480, Y0 = 60, W = 480, H = 480;
  el(svg, "rect", { x: X0, y: Y0, width: W, height: H, rx: 14, fill: "#fff", stroke: C.line });
  el(svg, "text", { x: X0 + 16, y: Y0 + 28, "font-size": 15, "font-weight": 600, fill: C.ink2 }, `Los ${fmtN(E.pts.length)} hotspots de Lima (UMAP)`);
  const P = embScale(E.pts, X0 + 24, Y0 + 50, W - 48, H - 110);
  const pg = el(svg, "g");
  E.pts.forEach(p => { const [x, y] = P(p); el(pg, "circle", { cx: x, cy: y, r: 2, fill: p[2] < 0 ? "#d3d7dd" : "#8f96a2", opacity: .65 }); });
  const [qx, qy] = P(E.pts[E.query]), hg = el(svg, "g");
  E.similar.forEach(([i], j) => { const [x, y] = P(E.pts[i]);
    el(hg, "line", { x1: qx, y1: qy, x2: x, y2: y, stroke: C.orange, "stroke-width": 2, class: "fade", style: `--d:${(.8 + j * .1).toFixed(1)}s` });
    el(hg, "circle", { cx: x, cy: y, r: 6, fill: "#fff", stroke: C.orange, "stroke-width": 2.5, class: "fade", style: `--d:${(.8 + j * .1).toFixed(1)}s` }); });
  el(hg, "circle", { cx: qx, cy: qy, r: 8, fill: C.orangeDeep, stroke: "#fff", "stroke-width": 2 });
  el(svg, "text", { x: X0 + 16, y: Y0 + H - 20, "font-size": 13, fill: C.ink2 }, `● ${q.id} y sus 5 vecinos por coseno`);
}
