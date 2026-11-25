/* Motor de la sustentación: scrollytelling por pasos + figuras propias de la presentación.
   Las figuras del método (red, densidad, agua, Monte Carlo, gemelos…) están en figures.js. */
"use strict";
const D = window.DECK;
const pct = (v, nd = 1) => comma((v * 100).toFixed(nd)) + " %";

/** ¿Está activo el capítulo que contiene este nodo? Lo usan las animaciones de figures.js. */
function isOn(node) { const ch = node && node.closest(".ch, .panel"); return !!ch && ch.classList.contains("on"); }

/* ═══ Cifras ═════════════════════════════════════════════════════════ */
function fillNumbers() {
  const ev = D.eval, t = ev.methods.topo, f = D.funnel;
  K.nCrimes = fmtN(D.dataset.n); K.months = D.dataset.months;
  K.fTotal = fmtN(f.total); K.fKept = fmtN(f.kept); K.fTop = fmtN(f.top_fallback);
  K.fRec = fmtN(f.recovered); K.fErr = Math.round(f.holdout_p50) + " m";
  K.nodes = fmtN(ev.network.nodes); K.edges = fmtN(ev.network.edges);
  K.sigma = ev.params.sigma_m + " m"; K.hotspots = fmtN(t.hotspots);
  const s = ev.selection;
  K.kmin = s.hotspots_min; K.kmax = s.hotspots_max; K.B = s.replicates; K.kmean = comma(Math.round(s.hotspots_mean));
  const cityPerNode = ev.crimes_snapped / ev.months / ev.network.nodes;
  K.lift = comma((t.density / cityPerNode).toFixed(1)) + "×";
  K.gain = "+" + comma(((t.captured / ev.methods.greedy.captured - 1) * 100).toFixed(1)) + " %";
  K.gain2 = "+" + comma(((t.captured / ev.methods.bfs.captured - 1) * 100).toFixed(1)) + " %";
  K.coverage = pct(t.coverage); K.netShare = pct(t.nodes / ev.months / ev.network.nodes);
  const B = D.bench;
  K.bParents = B.params.parents;
  K.f1topo = comma(B.methods.topologico.f1.toFixed(2));
  K.f1greedy = comma(Math.max(B.methods.voraz.f1, B.methods.anchura.f1).toFixed(2));
  K.twinRatio = Math.round(D.explainer.twins.pair.ratio) + "×";
  const q = D.cs.quadrants;
  K.sigTraj = fmtN(D.cs.persistence.n_significant); K.nTraj = fmtN(D.cs.persistence.n_tested);
  K.moving = Math.round(q.frecuente_movil / (q.frecuente_movil + q.frecuente_estable) * 100) + " %";
  K.focusK = D.focus_hotspots.polys.length; K.focusMonth = mesLargo(D.focus_hotspots.month);
  const cells = D.city.cells.map(c => c[2]).sort((a, b) => b - a), tot = cells.reduce((a, b) => a + b, 0);
  let acc = 0, k = 0; while (acc < tot / 2) acc += cells[k++];
  K.half = pct(k / cells.length);
}
function bindNumbers() {
  document.querySelectorAll("[data-k]").forEach(e => { if (K[e.dataset.k] !== undefined) e.textContent = K[e.dataset.k]; });
}

/* ═══ Mapa de Lima en canvas ═════════════════════════════════════════
   Celdas de 200 m con su conteo 2018–2025 (crimes.bin agregado por
   tools/build_data.py). Varias capas apiladas que se cruzan con opacidad. */
function LimaMap(host, layers) {
  const C0 = D.city, [a0, o0, a1, o1] = C0.bbox, Q = C0.q, kx = Math.cos((a0 + a1) / 2 * Math.PI / 180);
  const cvs = {};
  layers.forEach(name => {
    const c = document.createElement("canvas");
    c.style.opacity = 0; c.style.transition = "opacity .7s ease";
    host.appendChild(c); cvs[name] = c;
  });
  const max = Math.log(C0.cells[C0.cells.length - 1][2] + 1);
  const color = C0.cells.map(c => ramp(.18 + .82 * Math.log(c[2] + 1) / max));
  // Celdas que suman la mitad de las denuncias.
  const tot = C0.cells.reduce((a, c) => a + c[2], 0), top = new Uint8Array(C0.cells.length);
  for (let i = C0.cells.length - 1, acc = 0; i >= 0 && acc < tot / 2; i--) { acc += C0.cells[i][2]; top[i] = 1; }
  let P = null;
  function fit() {
    const w = host.clientWidth, h = host.clientHeight, pad = 24;
    const wd = (o1 - o0) * kx, hd = a1 - a0, s = Math.min((w - 2 * pad) / wd, (h - 2 * pad) / hd);
    const ox = (w - wd * s) / 2, oy = (h - hd * s) / 2;
    P = { w, h, s, x: lon => ox + (lon - o0) * kx * s, y: lat => oy + (a1 - lat) * s,
          cx: q => ox + q / Q * wd * s, cy: q => oy + (1 - q / Q) * hd * s, px: Math.max(1.6, 200 / 111320 * s) };
  }
  function ctxOf(c) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(P.w * dpr); c.height = Math.round(P.h * dpr);
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, P.w, P.h); return g;
  }
  function cells(g, fill) {
    const r = P.px;
    C0.cells.forEach((c, i) => { const f = fill(i); if (!f) return; g.fillStyle = f; g.fillRect(P.cx(c[0]) - r / 2, P.cy(c[1]) - r / 2, r, r); });
  }
  function decor(g) {
    g.save();
    g.fillStyle = "#8f96a2"; g.font = "italic 500 13px Inter, sans-serif"; g.textAlign = "center";
    g.translate(P.x(-77.16), P.y(-12.2)); g.rotate(-Math.PI / 2.6); g.fillText("Océano Pacífico", 0, 0); g.restore();
    // Escala de 10 km.
    const km = 10000 / 111320 * P.s, x0 = P.w - km - 40, y0 = P.h - 34;
    g.strokeStyle = "#3d434d"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, y0 - 6); g.lineTo(x0, y0); g.lineTo(x0 + km, y0); g.lineTo(x0 + km, y0 - 6); g.stroke();
    g.fillStyle = "#3d434d"; g.font = "500 12px Inter, sans-serif"; g.textAlign = "center"; g.fillText("10 km", x0 + km / 2, y0 - 8);
    // Centro histórico.
    const cx = P.x(-77.0428), cy = P.y(-12.0464);
    g.strokeStyle = "#14161a"; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.stroke();
    g.fillStyle = "#14161a"; g.textAlign = "left"; g.font = "600 12.5px Inter, sans-serif";
    g.lineWidth = 4; g.strokeStyle = "rgba(251,251,252,.9)"; g.strokeText("Centro de Lima", cx + 11, cy + 4); g.fillText("Centro de Lima", cx + 11, cy + 4);
  }
  const painters = {
    all(g) { cells(g, i => color[i]); decor(g); },
    top(g) { cells(g, i => top[i] ? null : "#d9dde3"); cells(g, i => top[i] ? "#c2410c" : null); decor(g); },
    hs(g) {
      cells(g, () => "#dfe2e7");
      g.fillStyle = "rgba(245,115,63,.85)"; g.strokeStyle = "#c2410c"; g.lineWidth = 1.2;
      D.focus_hotspots.polys.forEach(h => {
        g.beginPath(); h.ring.forEach(([lo, la], j) => j ? g.lineTo(P.x(lo), P.y(la)) : g.moveTo(P.x(lo), P.y(la)));
        g.closePath(); g.fill(); g.stroke();
        // Halo para que los polígonos pequeños se vean a escala de ciudad.
        const [lo, la] = h.ring[0]; g.save(); g.globalAlpha = .18; g.beginPath(); g.arc(P.x(lo), P.y(la), 9, 0, 7); g.fill(); g.restore();
      });
      decor(g);
    },
  };
  let current = null;
  function draw() { fit(); layers.forEach(n => painters[n](ctxOf(cvs[n]))); }
  function show(name, dim) {
    current = name;
    layers.forEach(n => cvs[n].style.opacity = n === name ? (dim ? .28 : 1) : 0);
  }
  new ResizeObserver(() => { if (host.clientWidth) { draw(); if (current) show(current); } }).observe(host);
  return { show };
}

/* ═══ Serie mensual ══════════════════════════════════════════════════ */
function drawSeries(svg) {
  const months = Object.keys(D.months).sort(), v = months.map(m => D.months[m]);
  const X0 = 40, X1 = 890, Yb = 200, H = 128, n = months.length, bw = (X1 - X0) / n, vmax = Math.max(...v);
  const cut = (D.caveat && D.caveat.from) || "9999";
  el(svg, "text", { x: X0, y: 22, "font-size": 16, "font-weight": 700, fill: C.ink }, "Denuncias con ubicación válida, por mes");
  const ci = months.indexOf(cut);
  if (ci > 0) {
    el(svg, "rect", { x: X0 + ci * bw, y: Yb - H - 24, width: X1 - X0 - ci * bw, height: H + 24, fill: "#f0f2f5" });
    el(svg, "text", { x: X1 - 4, y: Yb - H - 10, "text-anchor": "end", "font-size": 12, fill: C.muted }, "geocodificación < 10 %");
  }
  months.forEach((m, i) => {
    const h = v[i] / vmax * H, covid = m >= "2020-03" && m <= "2020-06";
    el(svg, "rect", { x: X0 + i * bw + .8, y: Yb - h, width: bw - 1.6, height: h, rx: 1.2,
      fill: covid ? C.teal : m >= cut ? "#c9ced6" : C.orange, class: "grow-y", style: `--d:${(i * .008).toFixed(3)}s` });
    if (m.endsWith("-01")) el(svg, "text", { x: X0 + i * bw, y: Yb + 18, "font-size": 12, fill: C.muted }, m.slice(0, 4));
  });
  const ic = months.indexOf("2020-04");
  const qx = X0 + ic * bw + bw / 2;
  el(svg, "line", { x1: qx, x2: qx, y1: Yb - H - 14, y2: Yb - D.months["2020-04"] / vmax * H - 4, stroke: C.teal, "stroke-dasharray": "3 3", class: "fade", style: "--d:.9s" });
  el(svg, "text", { x: qx, y: Yb - H - 20, "text-anchor": "middle", "font-size": 12.5, "font-weight": 650, fill: C.tealDeep, class: "fade", style: "--d:.9s" }, "cuarentena 2020");
  el(svg, "line", { x1: X0, x2: X1, y1: Yb, y2: Yb, stroke: "#c7ccd4" });
  el(svg, "text", { x: X0 - 6, y: Yb - H + 4, "text-anchor": "end", "font-size": 11, fill: C.muted }, (vmax / 1000).toFixed(0) + " k");
}

/* ═══ Problema ═══════════════════════════════════════════════════════ */
const POI_COL = ["#f5733f", "#7c6bd6", "#d99a00", "#3b82c4", "#d4537e", "#1d7f81", "#5b8c3a", "#14161a"];
function drawFactors(svg) {
  const streets = g => {
    el(g, "rect", { x: -40, y: -40, width: 680, height: 680, fill: "#fbfbfc" });
    [...MAP.edges.keys()].sort((a, b) => RW[MAP.cls[a]][3] - RW[MAP.cls[b]][3]).forEach(i => {
      const r = RW[MAP.cls[i]]; el(g, "path", { d: MAP.paths[i], fill: "none", stroke: r[2], "stroke-width": r[3] * .9, "stroke-linecap": "round" });
    });
  };
  const pois = g => {
    el(g, "rect", { x: -40, y: -40, width: 680, height: 680, fill: "#fbfbfc" });
    const eg = el(g, "g", { stroke: "#e1e4e9" }); MAP.paths.forEach(d => el(eg, "path", { d, fill: "none", "stroke-width": 1.4 }));
    MAP.pois.forEach(p => {
      const m = el(g, "g", { transform: `translate(${p.x},${p.y}) scale(1.1)` });
      el(m, "path", { d: "M0 0c-2.6-3-4.2-5-4.2-7.1a4.2 4.2 0 0 1 8.4 0c0 2.1-1.6 4.1-4.2 7.1z", fill: POI_COL[p.cat % 8], stroke: "#fff", "stroke-width": .8 });
    });
  };
  lens(svg, { cx: 230, cy: 250, r: 190, draw: streets });
  lens(svg, { cx: 770, cy: 250, r: 190, draw: pois });
  const lab = (x, t, s, col) => {
    el(svg, "text", { x, y: 478, "text-anchor": "middle", "font-size": 22, "font-weight": 750, fill: col }, t);
    el(svg, "text", { x, y: 502, "text-anchor": "middle", "font-size": 14, fill: C.muted }, s);
  };
  lab(230, "Topología vial", "cómo se conecta y jerarquiza la red", C.ink2);
  lab(770, "Puntos de interés", "bancos, bares, comercio, colegios…", C.tealDeep);
  el(svg, "line", { x1: 500, x2: 500, y1: 90, y2: 420, stroke: "#c7ccd4", "stroke-width": 2, "stroke-dasharray": "6 6" });
  el(svg, "rect", { x: 440, y: 232, width: 120, height: 36, rx: 18, fill: "#fff", stroke: C.line });
  el(svg, "text", { x: 500, y: 255, "text-anchor": "middle", "font-size": 13.5, "font-weight": 650, fill: C.muted }, "por separado");
  const cg = el(svg, "g", { class: "fade", style: "--d:.5s" });
  el(cg, "rect", { x: 400, y: 545, width: 200, height: 50, rx: 10, fill: C.orange });
  el(cg, "text", { x: 500, y: 577, "text-anchor": "middle", "font-size": 19, "font-weight": 750, fill: "#fff" }, "Crimen");
  curve(cg, 300, 520, 398, 566, -.2, "ah-o", C.orange, "5 4");
  curve(cg, 700, 520, 602, 566, .2, "ah-o", C.orange, "5 4");
  el(cg, "text", { x: 330, y: 585, "text-anchor": "middle", "font-size": 22, "font-weight": 800, fill: C.orange }, "?");
  el(cg, "text", { x: 670, y: 585, "text-anchor": "middle", "font-size": 22, "font-weight": 800, fill: C.orange }, "?");
}

function drawCells(svg) {
  const cell = 200 * MAP.s, n = Math.ceil(600 / cell), cnt = new Array(n * n).fill(0);
  MAP.crimes.forEach(p => { const i = Math.floor(p.x / cell), j = Math.floor(p.y / cell); if (i >= 0 && j >= 0 && i < n && j < n) cnt[j * n + i]++; });
  const mx = Math.max(...cnt);
  const grid = g => {
    el(g, "rect", { x: -40, y: -40, width: 680, height: 680, fill: "#fbfbfc" });
    cnt.forEach((c, k) => { if (!c) return; el(g, "rect", { x: (k % n) * cell, y: Math.floor(k / n) * cell, width: cell, height: cell, fill: ramp(Math.pow(c / mx, .6)), opacity: .9 }); });
    const eg = el(g, "g", { stroke: "#5d6470", opacity: .55 }); MAP.paths.forEach(d => el(eg, "path", { d, fill: "none", "stroke-width": 1.1 }));
    const lg = el(g, "g", { stroke: "#fff", "stroke-width": 1.4, opacity: .9 });
    for (let i = 0; i <= n; i++) { el(lg, "line", { x1: i * cell, x2: i * cell, y1: 0, y2: 600 }); el(lg, "line", { y1: i * cell, y2: i * cell, x1: 0, x2: 600 }); }
  };
  lens(svg, { cx: 230, cy: 270, r: 200, draw: grid });
  lens(svg, { cx: 770, cy: 270, r: 200, draw: g => drawCity(g, "density") });
  const lab = (x, t, s1, s2, col, good) => {
    el(svg, "text", { x, y: 512, "text-anchor": "middle", "font-size": 21, "font-weight": 750, fill: col }, t);
    el(svg, "text", { x, y: 538, "text-anchor": "middle", "font-size": 14, fill: good ? C.tealDeep : C.muted }, (good ? "✓ " : "✗ ") + s1);
    el(svg, "text", { x, y: 558, "text-anchor": "middle", "font-size": 14, fill: good ? C.tealDeep : C.muted }, (good ? "✓ " : "✗ ") + s2);
  };
  lab(230, "Celdas de 200 m", "depende del tamaño de celda", "mezcla calles que no se conectan", C.ink2, false);
  lab(770, "Sobre la red vial", "el calor sigue las calles", "cada zona es un trozo conexo", C.orangeDeep, true);
  el(svg, "text", { x: 500, y: 600, "text-anchor": "middle", "font-size": 12, fill: C.faint }, `El mismo recorte real de Lima, ${mesLargo(MAP.month)}.`);
}

function drawQuestion(svg) {
  const T = EX.twins, pair = T.pair;
  let ext = 1; [T.high, T.low].forEach(sh => sh.nodes.forEach(([x, y]) => ext = Math.max(ext, Math.hypot(x, y))));
  const k = 160 / ext;
  [[250, T.high, pair.crimes_high, C.orangeDeep], [750, T.low, pair.crimes_low, C.teal]].forEach(([cx, sh, n, col], s) => {
    const id = "Q" + (UID++), g = el(svg, "g");
    const cp = el(el(svg, "defs"), "clipPath", { id }); el(cp, "circle", { cx, cy: 300, r: 200 });
    el(g, "circle", { cx, cy: 300, r: 201, fill: "#fff", class: "lens-ring" });
    const inner = el(g, "g", { "clip-path": `url(#${id})` });
    sh.edges.forEach(([a, b]) => el(inner, "line", { x1: cx + sh.nodes[a][0] * k, y1: 300 + sh.nodes[a][1] * k, x2: cx + sh.nodes[b][0] * k, y2: 300 + sh.nodes[b][1] * k,
      stroke: C.ink2, "stroke-width": 3.4, "stroke-linecap": "round" }));
    el(g, "circle", { cx, cy: 300, r: 200, fill: "none", stroke: "#d5d9e2", "stroke-width": 2 });
    el(svg, "text", { x: cx, y: 70, "text-anchor": "middle", "font-size": 17, "font-weight": 650, fill: C.muted }, s ? "Zona B" : "Zona A");
    el(svg, "text", { x: cx, y: 552, "text-anchor": "middle", "font-size": 38, "font-weight": 800, fill: col, class: "fade", style: `--d:${.6 + s * .3}s` }, `${n} delitos`);
  });
  const b = el(svg, "g");
  el(b, "rect", { x: 425, y: 270, width: 150, height: 60, rx: 30, fill: "#fff", stroke: "#dfe2e8", "stroke-width": 1.5, class: "lens-ring" });
  el(b, "text", { x: 500, y: 297, "text-anchor": "middle", "font-size": 16, "font-weight": 750, fill: C.ink2 }, "misma forma");
  el(b, "text", { x: 500, y: 316, "text-anchor": "middle", "font-size": 12.5, fill: C.muted }, "estructura vial");
  el(svg, "text", { x: 500, y: 605, "text-anchor": "middle", "font-size": 24, "font-weight": 800, fill: C.ink, class: "fade", style: "--d:1.3s" }, "¿Por qué?");
}

/* ═══ Embudo de datos ════════════════════════════════════════════════ */
function drawFunnel(svg) {
  const f = D.funnel, X0 = 300, W = 640, x = v => X0 + v / f.total * W;
  const rows = [
    ["Archivo completo", f.total, 0, "base", "filas de denuncias PNP, 2018–2025"],
    ["Duplicados", f.duplicates, f.total - f.duplicates, "drop", ""],
    ["Sin datos o fuera de ventana", f.discarded + f.window, 0, "drop", ""],
    ["Geo forzada a la comisaría", f.flagged, 0, "fake", "marcadas por la propia fuente"],
    ["Centroides de relleno", f.filler, 0, "fake", "muchos hechos, muchas direcciones"],
    ["Entran al análisis", f.kept, 0, "kept", ""],
  ];
  let rest = f.total;
  el(svg, "text", { x: X0, y: 36, "font-size": 16, "font-weight": 700, fill: C.ink }, "Del archivo a lo que se analiza");
  const G = { drop: [], fake: [], kept: [], base: [] };
  rows.forEach(([lab, v, , kind, sub], i) => {
    const y = 70 + i * 82, g = el(svg, "g", { class: "fade", style: `--d:${(i * .1).toFixed(1)}s` });
    G[kind].push(g); g.style.transition = "opacity .5s ease";
    let a, b;
    if (kind === "base") { a = 0; b = v; }
    else if (kind === "kept") { a = 0; b = v; }
    else { a = rest - v; b = rest; rest -= v; }
    const col = kind === "base" ? "#9aa1ac" : kind === "kept" ? C.orange : kind === "fake" ? C.orangeDeep : "#c9ced6";
    el(g, "text", { x: X0 - 16, y: y + 24, "text-anchor": "end", "font-size": 16, "font-weight": kind === "kept" ? 750 : 550, fill: kind === "kept" ? C.orangeDeep : C.ink }, lab);
    if (sub) el(g, "text", { x: X0 - 16, y: y + 43, "text-anchor": "end", "font-size": 12.5, fill: C.muted }, sub);
    if (kind !== "base" && kind !== "kept") el(g, "rect", { x: x(0), y: y + 4, width: x(a) - X0, height: 30, fill: "#f0f2f5", rx: 3 });
    el(g, "rect", { x: x(a), y: y + 4, width: Math.max(2, x(b) - x(a)), height: 30, rx: 3, fill: col, opacity: kind === "fake" ? .9 : 1 });
    const label = (kind === "base" || kind === "kept" ? "" : "−") + fmtN(v);
    const inside = x(b) - x(a) > 120;
    el(g, "text", { x: inside ? x(a) + 10 : x(b) + 8, y: y + 25, "font-size": 14.5, "font-weight": 700,
      fill: inside ? "#fff" : (kind === "fake" ? C.orangeDeep : C.ink2) }, label);
    if (kind === "kept") {
      const r = f.recovered, rg = el(g, "g", { class: "rec" });
      el(rg, "rect", { x: x(v - r), y: y + 4, width: x(r) - X0, height: 30, rx: 3, fill: C.teal });
      el(rg, "text", { x: x(v) + 8, y: y + 25, "font-size": 13.5, "font-weight": 650, fill: C.tealDeep }, `de ellas ${fmtN(r)} recuperadas por dirección`);
      G.rec = rg;
    }
  });
  el(svg, "text", { x: X0, y: 590, "font-size": 13, fill: C.muted },
    `${f.columns_in} columnas en el archivo → ${f.columns_kept} usadas · la suma cuadra fila a fila con validation_report.json`);
  return k => {
    const focus = k === 1 ? ["fake"] : k === 2 ? ["kept"] : null;
    Object.entries(G).forEach(([kind, gs]) => { if (kind === "rec") return;
      gs.forEach(g => g.style.opacity = !focus || focus.includes(kind) || kind === "base" ? 1 : .3); });
    if (G.rec) G.rec.style.opacity = k === 2 || k === -1 ? 1 : 0;
  };
}

/* ═══ Barrido de σ ═══════════════════════════════════════════════════ */
function drawSweep(svg) {
  const S = D.bench.sweep; if (!S.length) return;
  const X0 = 90, X1 = 720, Yb = 520, Yt = 90, smin = S[0].sigma, smax = S[S.length - 1].sigma;
  const x = s => X0 + (s - smin) / (smax - smin) * (X1 - X0), y = v => Yb - v * (Yb - Yt);
  el(svg, "text", { x: X0, y: 50, "font-size": 16, "font-weight": 700, fill: C.ink }, "Validación sintética según el ancho de banda σ");
  [0, .25, .5, .75, 1].forEach(t => {
    el(svg, "line", { x1: X0, x2: X1, y1: y(t), y2: y(t), stroke: t ? "#eceef1" : "#c7ccd4" });
    el(svg, "text", { x: X0 - 10, y: y(t) + 4, "text-anchor": "end", "font-size": 12.5, fill: C.muted }, comma(t.toFixed(2)));
  });
  S.forEach(p => el(svg, "text", { x: x(p.sigma), y: Yb + 22, "text-anchor": "middle", "font-size": 12.5, fill: C.muted }, p.sigma + " m"));
  el(svg, "text", { x: (X0 + X1) / 2, y: Yb + 46, "text-anchor": "middle", "font-size": 13, fill: C.ink2 }, "ancho de banda σ");
  const sel = D.eval.params.sigma_m;
  el(svg, "line", { x1: x(sel), x2: x(sel), y1: Yt - 10, y2: Yb, stroke: C.ink2, "stroke-dasharray": "5 5", "stroke-width": 1.5 });
  el(svg, "text", { x: x(sel) + 6, y: Yt - 14, "font-size": 12.5, "font-weight": 650, fill: C.ink2 }, `σ usado = ${sel} m`);
  const series = [
    ["topologico", "f1", C.orange, 4.5, null, "F1 · topológico"],
    ["topologico", "ppv", C.orange, 2.2, "7 5", "precisión · topológico"],
    ["topologico", "sensitivity", C.orangeDeep, 2.2, "2 4", "sensibilidad · topológico"],
    ["voraz", "f1", "#6b7380", 3, null, "F1 · BFS voraz"],
    ["anchura", "f1", "#b9bfc9", 3, null, "F1 · BFS anchura"],
  ];
  series.forEach(([m, k, col, w, dash, lab], i) => {
    const pts = S.filter(p => p[m]).map(p => [x(p.sigma), y(p[m][k])]);
    const d = "M" + pts.map(p => p.join(" ")).join("L");
    let len = 0; for (let j = 1; j < pts.length; j++) len += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
    el(svg, "path", { d, fill: "none", stroke: col, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round",
      "stroke-dasharray": dash || undefined, class: dash ? "fade" : "draw", style: `--len:${len.toFixed(0)};--d:${(.1 + i * .15).toFixed(2)}s` });
    if (!dash) pts.forEach(([px, py]) => el(svg, "circle", { cx: px, cy: py, r: 4, fill: "#fff", stroke: col, "stroke-width": 2, class: "fade", style: `--d:${(.6 + i * .15).toFixed(2)}s` }));
    const ly = 120 + i * 30;
    el(svg, "line", { x1: 760, x2: 796, y1: ly, y2: ly, stroke: col, "stroke-width": w, "stroke-dasharray": dash || undefined, "stroke-linecap": "round" });
    el(svg, "text", { x: 806, y: ly + 5, "font-size": 13.5, fill: C.ink2 }, lab);
  });
  const g = el(svg, "g", { transform: "translate(760,300)", class: "fade", style: "--d:1.2s" });
  el(g, "rect", { width: 220, height: 128, rx: 10, fill: C.orangeDim || "#fde9df" });
  [["σ pequeño", "zonas precisas, se escapan focos"], ["σ grande", "encuentra todo, lo dibuja ancho"]].forEach(([a, b], i) => {
    el(g, "text", { x: 14, y: 30 + i * 52, "font-size": 14, "font-weight": 750, fill: C.orangeDeep }, a);
    el(g, "text", { x: 14, y: 50 + i * 52, "font-size": 12.5, fill: C.orangeDeep }, b);
  });
}

/* ═══ Trayectorias: frecuente / episódico × estable / móvil ══════════ */
function drawQuad(svg) {
  const q = D.cs.quadrants, P = D.cs.persistence;
  const cells = [["frecuente_estable", "Frecuente y estable", 0, 0], ["frecuente_movil", "Frecuente y móvil", 1, 0],
                 ["episodico_estable", "Episódico y estable", 0, 1], ["episodico_movil", "Episódico y móvil", 1, 1]];
  const mx = Math.max(...Object.values(q)), X0 = 120, Y0 = 110, S = 210;
  el(svg, "rect", { x: 40, y: 40, width: 920, height: 560, rx: 18, fill: "#fff", stroke: C.line });
  el(svg, "text", { x: X0, y: 82, "font-size": 16, "font-weight": 700, fill: C.ink }, "Sitios recurrentes según cuánto vuelven y cuánto se mueven");
  el(svg, "text", { x: X0 + S / 2, y: Y0 + 2 * S + 30, "text-anchor": "middle", "font-size": 13, fill: C.muted }, "estable");
  el(svg, "text", { x: X0 + 1.5 * S, y: Y0 + 2 * S + 30, "text-anchor": "middle", "font-size": 13, fill: C.muted }, "se desplaza");
  el(svg, "text", { x: X0 - 14, y: Y0 + S / 2, "text-anchor": "end", "font-size": 13, fill: C.muted }, "frecuente");
  el(svg, "text", { x: X0 - 14, y: Y0 + 1.5 * S, "text-anchor": "end", "font-size": 13, fill: C.muted }, "episódico");
  cells.forEach(([key, lab, i, j], n) => {
    const v = q[key], side = Math.sqrt(v / mx) * (S - 24), cx = X0 + i * S + S / 2, cy = Y0 + j * S + S / 2;
    el(svg, "rect", { x: X0 + i * S + 2, y: Y0 + j * S + 2, width: S - 4, height: S - 4, rx: 10, fill: "#f6f7f9" });
    const hot = key === "frecuente_movil";
    el(svg, "rect", { x: cx - side / 2, y: cy - side / 2, width: side, height: side, rx: 8, fill: hot ? C.orange : j ? "#c9ced6" : C.teal,
      class: "fade", style: `--d:${(.15 + n * .12).toFixed(2)}s` });
    el(svg, "text", { x: cx, y: cy + 8, "text-anchor": "middle", "font-size": 28, "font-weight": 800, fill: "#fff", class: "fade", style: `--d:${(.3 + n * .12).toFixed(2)}s` }, v);
    el(svg, "text", { x: cx, y: Y0 + j * S + 24, "text-anchor": "middle", "font-size": 12.5, "font-weight": 650, fill: C.ink2 }, lab);
  });
  // Persistencia significativa frente a lo esperado por azar.
  const bx = 600, by = 150, bw = 320;
  el(svg, "text", { x: bx, y: by - 12, "font-size": 15, "font-weight": 700, fill: C.ink }, "Trayectorias que vuelven más que el azar");
  el(svg, "rect", { x: bx, y: by, width: bw, height: 34, rx: 6, fill: "#e6e8ec" });
  el(svg, "rect", { x: bx, y: by, width: bw * P.n_significant / P.n_tested, height: 34, rx: 6, fill: C.orange, class: "grow-x", style: "--d:.5s" });
  el(svg, "text", { x: bx, y: by + 60, "font-size": 30, "font-weight": 800, fill: C.orangeDeep }, `${fmtN(P.n_significant)} de ${fmtN(P.n_tested)}`);
  el(svg, "text", { x: bx, y: by + 82, "font-size": 13, fill: C.muted }, "nulo Poisson-binomial por cobertura mensual, α = 0,05");
  const g = el(svg, "g", { transform: `translate(${bx},${by + 130})`, class: "fade", style: "--d:.9s" });
  el(g, "rect", { width: bw, height: 150, rx: 12, fill: "#fde9df" });
  el(g, "text", { x: 18, y: 42, "font-size": 34, "font-weight": 800, fill: C.orangeDeep }, K.moving);
  el(g, "text", { x: 18, y: 70, "font-size": 14, fill: C.orangeDeep }, "de los sitios frecuentes se mueve");
  el(g, "text", { x: 18, y: 90, "font-size": 14, fill: C.orangeDeep }, "dentro de su zona: persistir no es");
  el(g, "text", { x: 18, y: 110, "font-size": 14, fill: C.orangeDeep }, "quedarse quieto.");
  el(g, "text", { x: 18, y: 136, "font-size": 12, fill: C.orangeDeep, opacity: .8 }, "enlace mes a mes por solape (IoU ≥ 0,2)");
}

/* ═══ Motor de pasos ═════════════════════════════════════════════════ */
const deckEl = document.getElementById("deck");
const beats = [...deckEl.querySelectorAll(".step, .panel")];
const chapters = [...deckEl.children].filter(c => c.matches(".ch, .panel"));
const hooks = {};
let cur = -1;

const toc = document.getElementById("toc");
chapters.forEach(ch => {
  const b = document.createElement("button");
  b.innerHTML = `<span>${ch.dataset.title || ""}</span><i></i>`;
  b.addEventListener("click", () => go(beats.indexOf(ch.matches(".panel") ? ch : ch.querySelector(".step"))));
  toc.appendChild(b); ch._toc = b;
});

function setBeat(i) {
  if (i === cur || i < 0) return;
  const prevCh = cur >= 0 ? (beats[cur].closest(".ch") || beats[cur]) : null;
  if (cur >= 0) beats[cur].classList.remove("on");
  cur = i;
  const beat = beats[i], ch = beat.closest(".ch") || beat;
  beat.classList.add("on");
  if (prevCh !== ch) { if (prevCh) prevCh.classList.remove("on"); void ch.offsetWidth; ch.classList.add("on"); }
  let k = 0;
  if (ch.matches(".ch")) {
    k = [...ch.querySelectorAll(".step")].indexOf(beat);
    ch.dataset.s = k;
    ch.querySelectorAll("[data-show]").forEach(e => e.classList.toggle("vis", e.dataset.show.split(",").map(Number).includes(k)));
  }
  if (hooks[ch.id]) hooks[ch.id](k, prevCh !== ch);
  document.getElementById("count").textContent = `${i + 1} / ${beats.length}`;
  document.getElementById("progress").style.width = (i / (beats.length - 1) * 100) + "%";
  const ci = chapters.indexOf(ch);
  chapters.forEach((c, j) => { c._toc.classList.toggle("on", j === ci); c._toc.classList.toggle("done", j < ci); });
  history.replaceState(null, "", "#" + (i + 1));
}
function pick() {
  const line = innerHeight * .55;
  let best = 0;
  beats.forEach((b, i) => { if (b.getBoundingClientRect().top <= line) best = i; });
  setBeat(best);
}
let ticking = false;
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; pick(); }); } }, { passive: true });
addEventListener("resize", pick);

function go(i) {
  i = Math.max(0, Math.min(beats.length - 1, i));
  const b = beats[i], r = b.getBoundingClientRect();
  const top = scrollY + r.top - Math.max(0, (innerHeight - r.height) / 2);
  scrollTo({ top: b.matches(".panel") && r.height > innerHeight ? scrollY + r.top : top, behavior: REDUCED ? "auto" : "smooth" });
}
addEventListener("keydown", e => {
  if (e.target.closest("input, textarea, select")) return;
  const k = e.key;
  if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(k)) { e.preventDefault(); go(cur + 1); }
  else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(k)) { e.preventDefault(); go(cur - 1); }
  else if (k === "Home") { e.preventDefault(); go(0); }
  else if (k === "End") { e.preventDefault(); go(beats.length - 1); }
  else if (k === "f" || k === "F") toggleFs();
});
function toggleFs() {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
}
document.getElementById("fs").addEventListener("click", toggleFs);

/* ═══ Arranque ═══════════════════════════════════════════════════════ */
(function init() {
  EX = D.explainer; MAP = toMap(EX);
  fillNumbers();
  // Lima: portada y contexto.
  const lima = LimaMap(document.getElementById("lima-map"), ["all", "top"]);
  hooks["c-lima"] = k => lima.show(k === 1 ? "top" : "all");
  // Problema.
  drawCells($("g-cells")); drawQuestion($("g-question"));
  // Propuesta y cierre.
  drawStrip($("g-close"), false);
  // Datos.
  const funnel = drawFunnel($("g-funnel")); hooks["c-datos"] = () => funnel(-1);
  // Fase 1.
  drawNet(); drawDens(); drawHs();
  const water = drawWater(); hooks["c-agua"] = (k, entered) => { if (entered) water(); };
  const mc = drawMC();
  TOPK.cut = (D.caveat && D.caveat.from) || "9999"; TOPK.detail = D.selection;
  drawTopK({ monthly: D.eval.monthly.map(r => ({ month: r.m, topo_hotspots: r.k })), meta: { selection: D.eval.selection } });
  let mcRan = false;
  hooks["c-mc"] = (k, entered) => { if (entered) mcRan = false; if (k === 0 && !mcRan) { mcRan = true; mc(); } };
  // Validación.
  drawSyn(D.bench); drawFoot(D.eval, D.bench); drawSweep($("g-sweep"));
  // Fases 2 y 3.
  drawVec(); drawCos(); drawTwin(); drawPoi(D.cs);
  // Hallazgos.
  const hsMap = LimaMap(document.getElementById("hs-map"), ["hs"]);
  drawQuad($("g-quad"));
  hooks["c-hallazgos"] = k => hsMap.show("hs", k === 1);
  bindNumbers();
  const start = Math.max(0, Math.min(beats.length - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));
  if (start) { const b = beats[start]; scrollTo({ top: scrollY + b.getBoundingClientRect().top - Math.max(0, (innerHeight - b.offsetHeight) / 2), behavior: "instant" }); }
  requestAnimationFrame(pick);
})();
