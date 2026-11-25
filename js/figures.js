/* Figuras del método, tomadas de thesis-dashboard/public/como-funciona-visual.html
   y adaptadas al motor de scrollytelling de deck.js. */
"use strict";
const K = {};   // cifras que se vuelcan en los [data-k] del HTML
const NS = "http://www.w3.org/2000/svg";
const $ = id => document.getElementById(id);
const C = { teal: "#2ba6a8", tealDeep: "#1d7f81", orange: "#f5733f", orangeDeep: "#c2410c",
            ink: "#14161a", ink2: "#3d434d", muted: "#6b7380", faint: "#a4acb8", line: "#e6e8ec", soft: "#f0f2f5" };
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmtN = n => Math.round(n).toLocaleString("es-PE").replace(/[,. ]/g, " ");
const comma = s => String(s).replace(".", ",");

function el(parent, tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
/** RNG con semilla: las ilustraciones salen iguales en cada visita. */
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function gauss(R) { return Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R()); }
function lerpHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
const RAMP = [[0, "#e4e7ec"], [.12, "#fde0cf"], [.4, "#f9a877"], [.7, "#f5733f"], [1, "#b8360a"]];
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i++) if (t <= RAMP[i][0]) {
    const [t0, c0] = RAMP[i - 1], [t1, c1] = RAMP[i];
    return lerpHex(c0, c1, (t - t0) / (t1 - t0));
  }
  return RAMP[RAMP.length - 1][1];
}

/* ═══ Mapa real ══════════════════════════════════════════════════════
   Recorte de la red de Lima alrededor de un hotspot real, escrito por
   scripts/build_explainer_data.py en explainer.json. Aquí se reescala a un
   lienzo de 600 unidades, que es lo que dibujan las lentes. */
const ROAD = [["expressway", "Vía expresa", "#14161a", 4.6], ["avenue", "Avenida", "#3d434d", 4], ["collector", "Colectora", "#7b8494", 3],
              ["street", "Calle", "#b9bfc9", 2], ["service", "Servicio", "#dde1e6", 1.6]];
const RW = Object.fromEntries(ROAD.map(r => [r[0], r]));
const MAP_SVGS = ["g-cover", "g-close", "g-net", "g-dens", "g-hs", "g-vec", "g-cos", "g-twin"];
let MAP = null, EX = null, UID = 0;

class Heap {
  constructor() { this.a = []; }
  push(d, v) { const a = this.a; a.push([d, v]); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top; }
  get size() { return this.a.length; }
}
function dijkstra(adj, sources) {
  const d = new Float64Array(adj.length).fill(Infinity), h = new Heap();
  for (const s of sources) { d[s] = 0; h.push(0, s); }
  while (h.size) {
    const [dv, v] = h.pop();
    if (dv > d[v]) continue;
    for (const [u, w] of adj[v]) if (dv + w < d[u]) { d[u] = dv + w; h.push(d[u], u); }
  }
  return d;
}

function toMap(ex) {
  const R = ex.meta.radius_m, s = 600 / (2 * R), T = ([x, y]) => ({ x: (x + R) * s, y: (y + R) * s });
  const c = ex.clip, nodes = c.nodes.map(T);
  const edges = c.edges.map(e => [e[0], e[1]]), cls = c.edges.map(e => e[2]);
  const paths = c.edges.map(e => "M" + [nodes[e[0]], ...e[3].map(T), nodes[e[1]]].map(p => p.x.toFixed(1) + " " + p.y.toFixed(1)).join("L"));
  const adj = nodes.map(() => []);
  edges.forEach(([a, b]) => { const w = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y); adj[a].push([b, w]); adj[b].push([a, w]); });
  const hotspots = c.hotspots.map(h => h.nodes);
  const hsOf = new Int16Array(nodes.length).fill(-1);
  hotspots.forEach((h, i) => h.forEach(v => hsOf[v] = i));
  return { R, s, nodes, edges, cls, paths, adj, hotspots, hsOf, f: c.f, focus: c.focus_nodes,
           crimes: c.crimes.map(T), pois: c.pois.map(p => ({ ...T(p), cat: p[2] })),
           spread: dijkstra(adj, c.focus_nodes), month: ex.meta.month };
}
/** Centro y radio (en unidades del lienzo) de un conjunto de nodos del recorte. */
function extentOf(ids) {
  let x = 0, y = 0; ids.forEach(v => { x += MAP.nodes[v].x; y += MAP.nodes[v].y; });
  x /= ids.length; y /= ids.length;
  let r = 1; ids.forEach(v => r = Math.max(r, Math.hypot(MAP.nodes[v].x - x, MAP.nodes[v].y - y)));
  return { x, y, r };
}

/** Dibuja el recorte en coordenadas del lienzo (0–600). */
function drawCity(g, mode, o = {}) {
  const N = MAP.nodes, zoom = !!o.zoom;
  const edge = (parent, i, attrs) => el(parent, "path", { d: MAP.paths[i], fill: "none", "vector-effect": "non-scaling-stroke",
    "stroke-linecap": "round", "stroke-linejoin": "round", ...attrs });
  el(g, "rect", { x: -40, y: -40, width: 680, height: 680, fill: "#fbfbfc" });
  if (mode === "raw") {
    const eg = el(g, "g", { stroke: "#cfd4db" });
    MAP.edges.forEach((_, i) => edge(eg, i, { "stroke-width": (zoom ? 1.2 : .6) * RW[MAP.cls[i]][3] * .6 + .4 }));
    const pg = el(g, "g", { fill: C.teal, class: "fade", style: "--d:.35s" });
    if (!zoom) MAP.pois.forEach(p => el(pg, "circle", { cx: p.x, cy: p.y, r: 1.5, opacity: .5 }));
    if (zoom) {
      const mg = el(g, "g", { class: "fade", style: "--d:.5s" });
      MAP.pois.forEach(p => {
        const m = el(mg, "g", { transform: `translate(${p.x},${p.y}) scale(.45)`, opacity: .75 });
        el(m, "path", { d: "M0 0c-2.6-3-4.2-5-4.2-7.1a4.2 4.2 0 0 1 8.4 0c0 2.1-1.6 4.1-4.2 7.1z", fill: C.teal, stroke: "#fff", "stroke-width": .8 });
        el(m, "circle", { cy: -7.1, r: 1.5, fill: "#fff" });
      });
    }
    const cg = el(g, "g", { fill: C.orange, class: "fade", style: "--d:.15s" });
    MAP.crimes.forEach(p => el(cg, "circle", { cx: p.x, cy: p.y, r: zoom ? 1.8 : 2.6, opacity: .9, stroke: "#fff", "stroke-width": zoom ? .3 : .5 }));
  } else if (mode === "density") {
    const eg = el(g, "g");
    const order = MAP.edges.map((e, i) => i).sort((a, b) => (MAP.f[MAP.edges[a][0]] + MAP.f[MAP.edges[a][1]]) - (MAP.f[MAP.edges[b][0]] + MAP.f[MAP.edges[b][1]]));
    order.forEach(i => {
      const [a, b] = MAP.edges[i], t = Math.pow((MAP.f[a] + MAP.f[b]) / 2, .7);
      const d = Math.min(Math.min(MAP.spread[a], MAP.spread[b]) / 160, 2.4);
      edge(eg, i, { class: "dens", "stroke-width": zoom ? 2 : 1,
        style: `--c:${ramp(t)};--w:${(zoom ? 2 : 1) + t * (zoom ? 5 : 4)}px;--d:${d.toFixed(2)}s` });
    });
  } else if (mode === "hotspots") {
    const eg = el(g, "g", { stroke: "#dde1e6" }), hot = [];
    MAP.edges.forEach(([a, b], i) => {
      const h = MAP.hsOf[a];
      if (h >= 0 && h === MAP.hsOf[b]) hot.push([i, h]); else edge(eg, i, { "stroke-width": zoom ? 1.8 : 1 });
    });
    const hg = el(g, "g", { stroke: C.orange });
    hot.forEach(([i, h]) => edge(hg, i, { "stroke-width": zoom ? 3.2 : 2.6, class: "fade", style: `--d:${(.15 + h * .12).toFixed(2)}s` }));
    if (zoom) {
      const ng = el(g, "g", { class: "fade", style: "--d:.4s" });
      MAP.hsOf.forEach((h, v) => { if (h >= 0) el(ng, "circle", { cx: N[v].x, cy: N[v].y, r: 1.6, fill: "#fff", stroke: C.orange, "stroke-width": 1.6, "vector-effect": "non-scaling-stroke" }); });
    }
  }
}

/** Lente circular con zoom, como en el graphical abstract. `draw(g, zoom)` pinta en 0–600. */
function lens(svg, { cx, cy, r, draw, zoom, arc, scale }) {
  const id = "L" + (UID++), k = 2 * r / 600;
  const main = el(svg, "g");
  const cp = el(el(svg, "defs"), "clipPath", { id: id + "m" }); el(cp, "circle", { cx, cy, r });
  el(main, "circle", { cx, cy, r: r + 1, fill: "#fff", class: "lens-ring" });
  draw(el(el(main, "g", { "clip-path": `url(#${id}m)` }), "g", { transform: `translate(${cx - r},${cy - r}) scale(${k})` }), false);
  el(main, "circle", { cx, cy, r, fill: "none", stroke: "#d5d9e2", "stroke-width": 2 });
  if (arc) {
    const a0 = Math.PI * 1.03, a1 = Math.PI * 1.47, rr = r + 12;
    el(svg, "path", { id: id + "a", fill: "none", d: `M${cx + rr * Math.cos(a0)} ${cy + rr * Math.sin(a0)} A${rr} ${rr} 0 0 1 ${cx + rr * Math.cos(a1)} ${cy + rr * Math.sin(a1)}` });
    const t = el(svg, "text", { fill: C.teal, "font-size": 20, "font-weight": 500, "letter-spacing": 1.5 });
    el(t, "textPath", { href: "#" + id + "a" }, arc);
  }
  if (scale && MAP) {
    const px = 200 * MAP.s * k, x0 = cx - r * .55, y0 = cy + r * .92;
    const sg = el(svg, "g");
    el(sg, "rect", { x: x0 - 8, y: y0 - 20, width: px + 16, height: 28, rx: 6, fill: "#fff", opacity: .9 });
    el(sg, "path", { d: `M${x0} ${y0 - 6}v6h${px}v-6`, fill: "none", stroke: C.ink2, "stroke-width": 1.6 });
    el(sg, "text", { x: x0 + px / 2, y: y0 - 7, "text-anchor": "middle", "font-size": 11.5, fill: C.ink2 }, "200 m");
  }
  if (!zoom) return;
  const { fx, fy, ext, zx, zy, zr } = zoom, mag = Math.max(1.6, zr / (ext * k * 1.35));
  const px = cx - r + fx * k, py = cy - r + fy * k, rf = zr / mag;
  const dx = zx - px, dy = zy - py, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  el(svg, "path", { d: `M${px + rf * nx} ${py + rf * ny}L${zx + zr * nx} ${zy + zr * ny}L${zx - zr * nx} ${zy - zr * ny}L${px - rf * nx} ${py - rf * ny}Z`,
    fill: "url(#cone)", class: "fade", style: "--d:.2s" });
  el(svg, "circle", { cx: px, cy: py, r: rf, fill: "none", stroke: "#fff", "stroke-width": 2, class: "fade", style: "--d:.2s" });
  const zg = el(svg, "g", { class: "fade", style: "--d:.25s" });
  const cz = el(el(svg, "defs"), "clipPath", { id: id + "z" }); el(cz, "circle", { cx: zx, cy: zy, r: zr });
  el(zg, "circle", { cx: zx, cy: zy, r: zr + 1, fill: "#fff", class: "lens-ring" });
  draw(el(el(zg, "g", { "clip-path": `url(#${id}z)` }), "g", { transform: `translate(${zx},${zy}) scale(${k * mag}) translate(${-fx},${-fy})` }), true);
  el(zg, "circle", { cx: zx, cy: zy, r: zr, fill: "none", stroke: "#d5d9e2", "stroke-width": 2 });
}
const cityLens = (svg, mode, opts) => {
  const e = extentOf(MAP.focus);
  lens(svg, { ...opts, draw: (g, z) => drawCity(g, mode, { zoom: z }),
    zoom: opts.zoom && { ...opts.zoom, fx: e.x, fy: e.y, ext: e.r } });
};

function legend(svg, x, y, items) {
  items.forEach(([kind, color, label], i) => {
    const g = el(svg, "g", { transform: `translate(${x},${y + i * 26})` });
    if (kind === "dot") el(g, "circle", { cx: 7, cy: 0, r: 6.5, fill: color });
    else if (kind === "ring") el(g, "circle", { cx: 7, cy: 0, r: 7, fill: "none", stroke: color, "stroke-width": 2, "stroke-dasharray": "3 2.5" });
    else el(g, "line", { x1: 0, x2: 16, y1: 0, y2: 0, stroke: color, "stroke-width": kind === "thick" ? 4 : 2, "stroke-linecap": "round" });
    el(g, "text", { x: 24, y: 5, "font-size": 15, fill: C.ink2 }, label);
  });
}
function card(svg, x, y, w, h, title, sub, color) {
  const g = el(svg, "g");
  el(g, "rect", { x, y, width: w, height: h, rx: 3, fill: "#fff", stroke: "#dfe2e8", "stroke-width": 1.5, class: "lens-ring" });
  el(g, "text", { x: x + w / 2, y: y + (sub ? h / 2 - 3 : h / 2 + 7), "text-anchor": "middle", "font-size": 20, "font-weight": 550, fill: color || C.ink }, title);
  if (sub) el(g, "text", { x: x + w / 2, y: y + h / 2 + 19, "text-anchor": "middle", "font-size": 13.5, fill: C.muted }, sub);
  return g;
}
function curve(svg, x1, y1, x2, y2, bend, marker, color, dash) {
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend;
  return el(svg, "path", { d: `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`, fill: "none", stroke: color || "#b9bec8",
    "stroke-width": 2.2, "stroke-linecap": "round", "marker-end": `url(#${marker || "ah"})`, "stroke-dasharray": dash });
}
/** Mapea la proyección 2D a una caja con escala robusta: UMAP deja islas lejanas (los ~300 hotspots de un solo nodo) que aplastarían la nube. */
function embScale(pts, x, y, w, h) {
  const q = (arr, t) => { const a = [...arr].sort((m, n) => m - n); return a[Math.floor(t * (a.length - 1))]; };
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = q(xs, .1), x1 = q(xs, .995), y0 = q(ys, .02), y1 = q(ys, .92), cl = v => Math.max(0, Math.min(1, v));
  return ([a, b]) => [x + cl((a - x0) / (x1 - x0)) * w, y + cl((b - y0) / (y1 - y0)) * h];
}
const mapNote = (svg, x, y, text, anchor) => el(svg, "text", { x, y, "text-anchor": anchor || "start", "font-size": 13, fill: C.muted }, text);

/** Un subgrafo suelto (en metros, centrado) ajustado a una caja. */
function fitShape(sh, x, y, w, h) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  sh.nodes.forEach(([a, b]) => { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); });
  const k = Math.min(w / (x1 - x0 || 1), h / (y1 - y0 || 1)), ox = x + (w - (x1 - x0) * k) / 2, oy = y + (h - (y1 - y0) * k) / 2;
  return { k, P: v => [ox + (sh.nodes[v][0] - x0) * k, oy + (sh.nodes[v][1] - y0) * k], Q: (px, py) => [ox + (px - x0) * k, oy + (py - y0) * k] };
}
function drawShape(g, sh, P, col, withCrimes, k) {
  sh.edges.forEach(([a, b]) => { const [x1, y1] = P(a), [x2, y2] = P(b);
    el(g, "line", { x1, y1, x2, y2, stroke: col, "stroke-width": 2.6, "stroke-linecap": "round" }); });
  sh.nodes.forEach((_, v) => { const [x, y] = P(v); el(g, "circle", { cx: x, cy: y, r: 2.6, fill: "#fff", stroke: col, "stroke-width": 1.6 }); });
  if (withCrimes) {
    const cg = el(g, "g", { class: "fade", style: "--d:.5s" });
    sh.crimes.forEach(([cx, cy]) => { const [x, y] = withCrimes(cx, cy); el(cg, "circle", { cx: x, cy: y, r: k || 3, fill: C.orangeDeep, opacity: .8 }); });
  }
}

/* ═══ 0 / 13 · Tira resumen (portada y cierre) ════════════════════════ */
function drawStrip(svg, withLinks) {
  const Y = 190, R = 108, X = [130, 376, 624, 870];
  const labels = [["Red vial y delitos", C.teal], ["Hotspots validados", C.teal], ["Vector de forma", C.orange], ["Gemelos y lugares", C.teal]];
  const targets = [1, 6, 9, 11];
  X.forEach((x, i) => {
    const g = el(svg, "g", { class: "fade", style: `--d:${(i * .15).toFixed(2)}s`, cursor: withLinks ? "pointer" : null });
    const id = "S" + (UID++);
    const cp = el(el(svg, "defs"), "clipPath", { id }); el(cp, "circle", { cx: x, cy: Y, r: R });
    el(g, "circle", { cx: x, cy: Y, r: R + 1, fill: "#fff", class: "lens-ring" });
    const inner = el(g, "g", { "clip-path": `url(#${id})` });
    el(inner, "rect", { x: x - R, y: Y - R, width: 2 * R, height: 2 * R, fill: "#fbfbfc" });
    if (i < 2) drawCity(el(inner, "g", { transform: `translate(${x - R},${Y - R}) scale(${2 * R / 600})` }), i ? "hotspots" : "raw");
    else if (i === 2) {
      const pts = EX.embedding.pts, P = embScale(pts, x - 80, Y - 8, 160, 86);
      pts.forEach((p, j) => { if (j % 3) return; const [cx, cy] = P(p);
        el(inner, "circle", { cx, cy, r: 1.6, fill: "#9aa1ac", opacity: .6 }); });
      for (let s = 3; s >= 0; s--) {
        const bx = x - 70 + s * 7, by = Y - 60 - s * 7;
        el(inner, "rect", { x: bx, y: by, width: 128, height: 26, fill: "#fff", stroke: C.ink2, "stroke-width": 1.4 });
        if (s === 0) [C.orange, C.teal, C.ink2].forEach((c, j) => el(inner, "rect", { x: bx + j * 128 / 3, y: by, width: 128 / 3, height: 26, fill: c, stroke: "#fff" }));
      }
    } else {
      miniTwin(inner, EX.twins.high, x - 46, Y - 6, 42, C.orange);
      miniTwin(inner, EX.twins.low, x + 46, Y - 6, 42, C.teal);
      el(inner, "text", { x, y: Y + 70, "text-anchor": "middle", "font-size": 22, "font-weight": 700, fill: C.ink2 }, "≈");
    }
    el(g, "circle", { cx: x, cy: Y, r: R, fill: "none", stroke: "#d5d9e2", "stroke-width": 2 });
    const [lab, col] = labels[i];
    el(g, "rect", { x: x - 104, y: Y + R + 28, width: 208, height: 36, rx: 3, fill: "#fff", stroke: "#dfe2e8", "stroke-width": 1.5, class: "lens-ring" });
    el(g, "text", { x, y: Y + R + 52, "text-anchor": "middle", "font-size": 17, fill: col, "font-weight": 500 }, lab);
    if (withLinks) g.addEventListener("click", () => go(targets[i]));
    if (i < 3) curve(svg, x + R + 8, Y - 30, X[i + 1] - R - 12, Y - 30, -.25).setAttribute("class", "fade");
  });
}
function miniTwin(g, sh, cx, cy, s, col) {
  const f = fitShape(sh, cx - s, cy - s, 2 * s, 2 * s);
  sh.edges.forEach(([a, b]) => { const [x1, y1] = f.P(a), [x2, y2] = f.P(b);
    el(g, "line", { x1, y1, x2, y2, stroke: col, "stroke-width": 1.8, "stroke-linecap": "round" }); });
}

/* ═══ 1 · Red vial ═══════════════════════════════════════════════════ */
function drawNet() {
  const svg = $("g-net");
  cityLens(svg, "raw", { cx: 330, cy: 320, r: 270, arc: "Red vial de Lima", scale: true, zoom: { zx: 790, zy: 400, zr: 175 } });
  legend(svg, 690, 70, [["dot", C.orange, "Delito denunciado"], ["dot", C.teal, "Punto de interés"], ["line", "#c3c8d0", "Calle (arista)"]]);
  mapNote(svg, 690, 164, `${fmtN(MAP.crimes.length)} denuncias de ${mesLargo(MAP.month)}`);
  mapNote(svg, 690, 182, `${fmtN(MAP.nodes.length)} esquinas en 2,2 km`);
}

/* ═══ 2 · Densidad ═══════════════════════════════════════════════════ */
function drawDens() {
  const svg = $("g-dens");
  cityLens(svg, "density", { cx: 330, cy: 320, r: 270, scale: true, zoom: { zx: 790, zy: 250, zr: 150 } });
  // Por calles frente a línea recta: una manzana entre dos esquinas.
  const g = el(svg, "g", { transform: "translate(660,440)", class: "fade", style: "--d:1.2s" });
  el(g, "rect", { x: 0, y: 0, width: 300, height: 150, rx: 10, fill: "#fff", stroke: C.line });
  el(g, "rect", { x: 70, y: 36, width: 160, height: 78, rx: 4, fill: C.soft, stroke: "#d5d9e2" });
  el(g, "text", { x: 150, y: 80, "text-anchor": "middle", "font-size": 12.5, fill: C.faint }, "manzana");
  el(g, "path", { d: "M70 124H40V26H260V124H230", fill: "none", stroke: C.orange, "stroke-width": 3, "stroke-linejoin": "round" });
  el(g, "line", { x1: 70, y1: 124, x2: 230, y2: 124, stroke: C.faint, "stroke-width": 2, "stroke-dasharray": "5 4" });
  el(g, "circle", { cx: 70, cy: 124, r: 6, fill: C.orangeDeep });
  el(g, "circle", { cx: 230, cy: 124, r: 6, fill: "#fff", stroke: C.orangeDeep, "stroke-width": 2 });
  el(g, "text", { x: 150, y: 18, "text-anchor": "middle", "font-size": 13, fill: C.orangeDeep, "font-weight": 600 }, "✓ se recorre por calles");
  el(g, "text", { x: 150, y: 143, "text-anchor": "middle", "font-size": 13, fill: C.muted }, "✗ en línea recta cruzaría la manzana");
  const lg = el(svg, "g", { transform: "translate(40,600)" });
  const gid = "rmp" + (UID++), gr = el(el(svg, "defs"), "linearGradient", { id: gid });
  RAMP.forEach(([o, c]) => el(gr, "stop", { offset: o, "stop-color": c }));
  el(lg, "rect", { x: 0, y: -8, width: 180, height: 10, rx: 5, fill: `url(#${gid})` });
  el(lg, "text", { x: 0, y: 18, "font-size": 13, fill: C.muted }, "poco");
  el(lg, "text", { x: 180, y: 18, "font-size": 13, fill: C.muted, "text-anchor": "end" }, "mucho crimen cerca");
}

/* ═══ 3 · Bajar el agua (persistencia en 1D) ══════════════════════════ */
const WATER = (() => {
  const P = [[130, .78, 58], [300, .5, 26], [410, 1, 62], [650, .64, 52], [830, .3, 28], [905, .22, 22]];
  const xs = [], fs = [];
  for (let i = 0; i <= 400; i++) { const x = 40 + i * 2.3; xs.push(x);
    fs.push(.05 + P.reduce((s, [m, h, w]) => s + h * Math.exp(-((x - m) ** 2) / (2 * w * w)), 0)); }
  const fmax = Math.max(...fs), f = fs.map(v => v / fmax);
  // Persistencia por union-find en barrido descendente.
  const order = f.map((_, i) => i).sort((a, b) => f[b] - f[a]), par = new Int32Array(f.length).fill(-1),
        peak = new Int32Array(f.length), pers = new Float64Array(f.length).fill(0),
        into = new Int32Array(f.length).fill(-1);
  const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  // El pico al que se llega subiendo desde i: la rama local, no la raíz.
  const climb = i => {
    for (;;) {
      const l = i > 0 && f[i - 1] > f[i] ? i - 1 : i, r = i < f.length - 1 && f[i + 1] > f[i] ? i + 1 : i;
      const nx = f[l] >= f[r] ? l : r;
      if (nx === i) return i;
      i = nx;
    }
  };
  for (const i of order) {
    par[i] = i; peak[i] = i;
    for (const j of [i - 1, i + 1]) if (j >= 0 && j < f.length && par[j] >= 0) {
      const a = find(i), b = find(j); if (a === b) continue;
      const [hi, lo] = f[peak[a]] >= f[peak[b]] ? [a, b] : [b, a];
      // Un pico de ruido se funde con la rama que toca en la silla —la
      // vecina—, no con la cima más alta de toda la componente.
      const nb = hi === b ? j : 2 * i - j;
      if (peak[lo] !== i) { pers[peak[lo]] = f[peak[lo]] - f[i]; into[peak[lo]] = climb(nb >= 0 && nb < f.length ? nb : j); }
      par[lo] = hi;
    }
  }
  pers[order[0]] = Infinity;
  const tau = .3;
  // Dueño de cada punto: el pico al que se llega subiendo, y si ese pico es
  // ruido (π < τ), el pico en el que se fundió. Así la frontera entre dos
  // zonas queda en el valle que las separa, como en el join tree.
  const owner = f.map((_, i) => {
    let k = climb(i);
    while (pers[k] < tau && into[k] >= 0) k = into[k];
    return k;
  });
  const survivors = [...new Set(owner)].sort((a, b) => a - b);
  return { xs, f, pers, tau, floor: .1, owner, survivors };
})();
function drawWater() {
  const svg = $("g-water"), Y = v => 560 - v * 450, { xs, f } = WATER;
  el(svg, "rect", { x: 40, y: 560, width: 920, height: 2, fill: "#d5d9e2" });
  const pts = xs.map((x, i) => `${x},${Y(f[i])}`).join(" ");
  el(svg, "polygon", { points: `40,560 ${pts} 960,560`, fill: "#eef0f3", stroke: "#c7ccd4", "stroke-width": 2 });
  const islands = el(svg, "g"), water = el(svg, "g");
  const wrect = el(water, "rect", { x: 40, width: 920, fill: C.teal, opacity: .16 });
  const wline = el(water, "line", { x1: 40, x2: 960, stroke: C.teal, "stroke-width": 2.5 });
  const wlab = el(water, "text", { x: 952, "text-anchor": "end", "font-size": 14, fill: C.tealDeep, "font-weight": 600 }, "nivel del agua");
  el(svg, "line", { x1: 40, x2: 960, y1: Y(WATER.floor), y2: Y(WATER.floor), stroke: C.ink2, "stroke-dasharray": "6 5", "stroke-width": 1.5 });
  el(svg, "text", { x: 48, y: Y(WATER.floor) - 8, "font-size": 13.5, fill: C.ink2 }, "piso mínimo de densidad");
  // Un color por zona que sobrevive, en orden de izquierda a derecha.
  // Sin verde azulado: es el color del agua.
  const ZONE = ["#f5733f", "#3b82c4", "#7c6bd6", "#d99a00", "#d4537e", "#5b8c3a"];
  const colOf = new Map(WATER.survivors.map((p, k) => [p, ZONE[k % ZONE.length]]));
  const sw = el(svg, "g", { transform: "translate(60,54)" });
  WATER.survivors.forEach((p, k) => el(sw, "rect", { x: k * 13, y: 0, width: 10, height: 10, rx: 2, fill: colOf.get(p) }));
  el(svg, "text", { x: 60 + WATER.survivors.length * 13 + 8, y: 63, "font-size": 15, fill: C.ink2 }, "Cada color, una zona: su pico sobrevive");
  legend(svg, 60, 86, [["thick", "#b9bfc9", "Ruido: poca persistencia, se funde con su vecina"]]);
  const noteIdx = f.reduce((b, v, i) => (WATER.pers[i] > 0 && WATER.pers[i] < WATER.tau && Math.abs(xs[i] - 300) < 40) ? i : b, -1);
  // Persistencia medida a la vista: un corchete del pico al paso donde su isla
  // se une a una más alta. Una cumbre que sobrevive y una que se absorbe.
  const peaks = f.map((_, i) => i).filter(i => WATER.pers[i] > 0 && isFinite(WATER.pers[i]));
  const keepIdx = peaks.filter(i => WATER.pers[i] >= WATER.tau).sort((a, b) => WATER.pers[b] - WATER.pers[a])[0];
  const brackets = el(svg, "g", { class: "fade", style: "--d:.6s" });
  [[keepIdx, colOf.get(keepIdx) || C.orangeDeep, "sobrevive"], [noteIdx, C.muted, "se funde"]].forEach(([m, col, verdict]) => {
    if (m == null || m < 0) return;
    const top = Y(f[m]), saddle = Y(f[m] - WATER.pers[m]), x = xs[m] + 26;
    el(brackets, "line", { x1: xs[m] - 40, x2: xs[m] + 70, y1: saddle, y2: saddle, stroke: col, "stroke-dasharray": "4 4", "stroke-width": 1.5 });
    el(brackets, "path", { d: `M${x - 6},${top} H${x} V${saddle} H${x - 6}`, fill: "none", stroke: col, "stroke-width": 2.2 });
    el(brackets, "text", { x: x + 8, y: (top + saddle) / 2 - 3, "font-size": 13, "font-weight": 700, fill: col, class: "halo" }, "persistencia");
    el(brackets, "text", { x: x + 8, y: (top + saddle) / 2 + 13, "font-size": 12.5, fill: col, class: "halo" },
       `${comma((WATER.pers[m]).toFixed(2))} ${WATER.pers[m] >= WATER.tau ? "≥" : "<"} τ = ${comma(WATER.tau.toFixed(1))} → ${verdict}`);
  });
  el(svg, "text", { x: 960, y: 600, "text-anchor": "end", "font-size": 12.5, fill: C.muted },
     "línea punteada: el paso donde la isla se une a una más alta");
  function paint(level) {
    islands.textContent = "";
    const yl = Y(level);
    wrect.setAttribute("y", yl); wrect.setAttribute("height", 560 - yl);
    wline.setAttribute("y1", yl); wline.setAttribute("y2", yl); wlab.setAttribute("y", yl - 8);
    const { owner } = WATER, seen = new Set();
    let i = 0;
    while (i < f.length) {
      if (f[i] <= level) { i++; continue; }
      let j = i; while (j < f.length && f[j] > level) j++;
      // Dentro de la isla, un tramo por dueño: dos campanas que ya se tocan
      // siguen siendo dos zonas, partidas en el valle que las separa.
      let a = i;
      while (a < j) {
        let b = a; while (b < j && owner[b] === owner[a]) b++;
        const p = owner[a], real = p >= i && p < j;   // su pico asoma en esta isla
        const pts = [`${xs[a]},${yl}`]; for (let k = a; k < b; k++) pts.push(`${xs[k]},${Y(f[k])}`);
        pts.push(`${xs[Math.min(b, j - 1)]},${Y(f[Math.min(b, j - 1)])}`, `${xs[Math.min(b, j - 1)]},${yl}`);
        el(islands, "polygon", { points: pts.join(" "), fill: real ? colOf.get(p) : "#c3c8d0", opacity: real ? .9 : .8 });
        if (real) {
          seen.add(p);
          el(islands, "circle", { cx: xs[p], cy: Y(f[p]), r: 6, fill: "#fff", stroke: colOf.get(p), "stroke-width": 2.5 });
        } else {
          let m = a; for (let k = a; k < b; k++) if (f[k] > f[m]) m = k;
          el(islands, "text", { x: xs[m], y: Y(f[m]) - 12, "text-anchor": "middle", "font-size": 13, fill: C.muted }, "ruido");
        }
        a = b;
      }
      i = j;
    }
    $("water-n").textContent = seen.size;
  }
  let t0 = null, raf = 0;
  const cycle = 7000;
  function frame(ts) {
    if (!isOn(svg)) { raf = 0; return; }
    if (t0 === null) t0 = ts;
    const t = ((ts - t0) % cycle) / cycle;
    const lv = t < .78 ? .97 - t / .78 * (.97 - WATER.floor) : WATER.floor;
    paint(lv);
    raf = requestAnimationFrame(frame);
  }
  paint(.42);
  return () => { if (REDUCED) { paint(.3); return; } if (!raf) { t0 = null; raf = requestAnimationFrame(frame); } };
}

/* ═══ 4 · Monte Carlo ════════════════════════════════════════════════ */
function drawMC() {
  const svg = $("g-mc"), R = rng(99);
  // Panel izquierdo: el mes observado y una réplica barajada.
  const box = (x, title, col) => {
    const g = el(svg, "g", { transform: `translate(${x},70)` });
    el(g, "rect", { width: 190, height: 190, rx: 10, fill: "#fff", stroke: C.line });
    el(g, "text", { x: 95, y: -12, "text-anchor": "middle", "font-size": 15, "font-weight": 600, fill: col }, title);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      if (i < 6) el(g, "line", { x1: 20 + i * 25, x2: 45 + i * 25, y1: 20 + j * 25, y2: 20 + j * 25, stroke: "#e1e4e9", "stroke-width": 1.5 });
      if (j < 6) el(g, "line", { x1: 20 + i * 25, x2: 20 + i * 25, y1: 20 + j * 25, y2: 45 + j * 25, stroke: "#e1e4e9", "stroke-width": 1.5 });
    }
    return el(g, "g");
  };
  const obs = box(40, "Mes observado", C.orangeDeep), rep = box(270, "Crimen al azar", C.muted);
  const dotsAt = (g, pts, col) => { g.textContent = ""; pts.forEach(([i, j]) => el(g, "circle", { cx: 20 + i * 25 + (R() - .5) * 10, cy: 20 + j * 25 + (R() - .5) * 10, r: 4, fill: col })); };
  const obsPts = []; for (let k = 0; k < 34; k++) obsPts.push(k < 24 ? [2 + Math.round(R() * 2), 1 + Math.round(R() * 2)] : [Math.floor(R() * 7), Math.floor(R() * 7)]);
  dotsAt(obs, obsPts, C.orange);
  el(obs, "rect", { x: 58, y: 34, width: 76, height: 76, rx: 6, fill: "none", stroke: C.orangeDeep, "stroke-width": 2, "stroke-dasharray": "5 4" });
  const shuffle = () => { const p = []; for (let k = 0; k < 34; k++) p.push([Math.floor(R() * 7), Math.floor(R() * 7)]); dotsAt(rep, p, "#9aa1ac"); };
  shuffle();
  // Histograma de máximos bajo el azar.
  const X0 = 60, X1 = 940, Yb = 560, Yt = 330, vmax = 130, bins = 26, bw = (X1 - X0) / bins;
  const x = v => X0 + v / vmax * (X1 - X0);
  el(svg, "line", { x1: X0, x2: X1, y1: Yb, y2: Yb, stroke: "#c7ccd4", "stroke-width": 1.5 });
  el(svg, "text", { x: X0, y: Yb + 26, "font-size": 13.5, fill: C.muted }, "concentración máxima del mes (Λ) →");
  el(svg, "text", { x: X0, y: Yt - 16, "font-size": 15, "font-weight": 600, fill: C.ink2 }, "Lo más concentrado que produce el azar, réplica a réplica");
  const hist = el(svg, "g"), counter = el(svg, "text", { x: 560, y: 180, "font-size": 44, "font-weight": 800, fill: C.ink2, "letter-spacing": "-1" });
  el(svg, "text", { x: 560, y: 208, "font-size": 14, fill: C.muted }, "réplicas al azar");
  const pv = el(svg, "g", { opacity: 0 });
  el(pv, "rect", { x: 560, y: 228, width: 330, height: 50, rx: 8, fill: C.teal });
  const pvt = el(pv, "text", { x: 725, y: 260, "text-anchor": "middle", "font-size": 18, "font-weight": 700, fill: "#fff" }, "");
  const OBS = 112;
  const og = el(svg, "g");
  el(og, "line", { x1: x(OBS), x2: x(OBS), y1: Yt + 20, y2: Yb, stroke: C.orange, "stroke-width": 4, "stroke-linecap": "round" });
  el(og, "text", { x: x(OBS), y: Yt + 8, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: C.orangeDeep }, "zona observada");
  let timer = 0;
  return () => {
    clearInterval(timer);
    const B = +(K.B || 99), vals = [], counts = new Array(bins).fill(0), Rn = rng(5);
    for (let b = 0; b < B; b++) vals.push(Math.max(8, 40 + gauss(Rn) * 9));
    hist.textContent = ""; pv.setAttribute("opacity", 0);
    const rects = counts.map((_, i) => el(hist, "rect", { x: X0 + i * bw + 1.5, width: bw - 3, y: Yb, height: 0, rx: 2, fill: "#b9bfc9" }));
    const peak = Math.max(...vals.reduce((a, v) => (a[Math.min(bins - 1, Math.floor(v / vmax * bins))]++, a), new Array(bins).fill(0)));
    const hy = c => c / peak * (Yb - Yt - 40);
    let b = 0;
    const step = () => {
      if (b >= B) {
        clearInterval(timer);
        const beat = vals.filter(v => v >= OBS).length;
        pvt.textContent = `p = ${1 + beat}/${B + 1} = ${comma(((1 + beat) / (B + 1)).toFixed(2))}  ✓ pasa`;
        pv.setAttribute("opacity", 1);
        return;
      }
      const i = Math.min(bins - 1, Math.floor(vals[b] / vmax * bins)); counts[i]++;
      rects[i].setAttribute("y", Yb - hy(counts[i])); rects[i].setAttribute("height", hy(counts[i]));
      counter.textContent = ++b; shuffle();
    };
    if (REDUCED) { while (b < B) step(); step(); return; }
    counter.textContent = 0;
    timer = setInterval(() => { if (!isOn(svg)) { clearInterval(timer); return; } step(); }, 38);
  };
}

/* ═══ 5 · Cuántos hotspots por mes ═══════════════════════════════════
   Las barras mensuales salen de evaluation.json (ligero); el detalle de un
   mes —candidatas, umbral del azar y Λ de cada región— de hotspots.geojson,
   que pesa decenas de MB y por eso se pide solo al llegar aquí. */
const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesLargo = m => { const [y, mm] = m.split("-"); return MES[+mm - 1] + " " + y; };
const TOPK = { months: null, detail: null, loading: false, sel: null, cut: "9999", maxK: 80 };

function drawTopK(ev) {
  const svg = $("g-topk"); svg.textContent = "";
  if (!ev || !ev.monthly) return;
  TOPK.months = ev.monthly.map(r => ({ m: r.month, k: r.topo_hotspots }));
  TOPK.maxK = ev.meta.selection.max_k || 80;
  const mean = ev.meta.selection.hotspots_mean;
  if (!TOPK.sel) {
    const pool = TOPK.months.filter(r => r.m < TOPK.cut);
    TOPK.sel = pool.reduce((b, r) => Math.abs(r.k - mean) < Math.abs(b.k - mean) ? r : b, pool[0]).m;
  }
  el(svg, "g", { id: "topk-top" });
  // Los pasos del criterio.
  const steps = [["Regiones del mes", "todas las candidatas"], ["Λ de cada una", "crimen frente a tamaño"], ["99 meses al azar", "el Λ máximo de cada uno"],
                 ["Pasa si p < 0,05", "supera al 95 % del azar"], [`Tope de ${TOPK.maxK}`, "ningún mes lo alcanza"]];
  const sw = 172, sg = 10;
  steps.forEach(([t, s], i) => {
    const x = 50 + i * (sw + sg), hi = i === 3, g = el(svg, "g", { class: "fade", style: `--d:${(.1 + i * .08).toFixed(2)}s` });
    el(g, "rect", { x, y: 338, width: sw, height: 52, rx: 8, fill: hi ? C.teal : "#fff", stroke: hi ? C.teal : "#dfe2e8", "stroke-width": 1.5 });
    el(g, "text", { x: x + 12, y: 359, "font-size": 14, "font-weight": 700, fill: hi ? "#fff" : C.ink }, `${i + 1} · ${t}`);
    el(g, "text", { x: x + 12, y: 378, "font-size": 12, fill: hi ? "#dff4f4" : C.muted }, s);
    if (i < steps.length - 1) el(svg, "path", { d: `M${x + sw + 1} 364h${sg - 2}`, stroke: "#b9bec8", "stroke-width": 2, "marker-end": "url(#ah)" });
  });
  // Las barras de los 90 meses.
  const X0 = 50, X1 = 950, Yb = 588, H = 128, n = TOPK.months.length, bw = (X1 - X0) / n;
  const y = k => Yb - k / TOPK.maxK * H;
  el(svg, "text", { x: X0, y: 440, "font-size": 15, "font-weight": 650, fill: C.ink }, "Hotspots que pasan el test, mes a mes");
  el(svg, "line", { x1: X0, x2: X1, y1: y(TOPK.maxK), y2: y(TOPK.maxK), stroke: "#d5d9e0", "stroke-dasharray": "3 4" });
  el(svg, "text", { x: X1, y: y(TOPK.maxK) - 6, "text-anchor": "end", "font-size": 12, fill: C.muted }, `tope de seguridad: ${TOPK.maxK}`);
  const bars = el(svg, "g");
  TOPK.months.forEach((r, i) => {
    const b = el(bars, "rect", { x: X0 + i * bw + 1, y: y(r.k), width: bw - 2, height: Yb - y(r.k), rx: 1.5,
      fill: "#c9ced6", opacity: r.m >= TOPK.cut ? .45 : 1, class: "grow-y", style: `--d:${(.2 + i * .006).toFixed(3)}s`, cursor: "pointer", "data-m": r.m });
    el(b, "title", {}, `${mesLargo(r.m)}: ${r.k} hotspots`);
    b.addEventListener("click", () => selectMonth(r.m));
    if (r.m.endsWith("-01")) el(svg, "text", { x: X0 + i * bw, y: Yb + 18, "font-size": 12, fill: C.muted }, r.m.slice(0, 4));
  });
  const li = TOPK.months.findIndex(r => r.m >= TOPK.cut);
  if (li > 0) el(svg, "text", { x: X1, y: Yb - H + 24, "text-anchor": "end", "font-size": 11.5, fill: C.muted }, "tramo con geocodificación < 10 %");
  el(svg, "line", { x1: X0, x2: X1, y1: y(20), y2: y(20), stroke: C.ink2, "stroke-width": 2, "stroke-dasharray": "7 5" });
  el(svg, "text", { x: X0 + 4, y: y(20) - 6, "font-size": 12.5, fill: C.ink2, "font-weight": 600, class: "halo" }, "antes: top-20 fijo");
  selectMonth(TOPK.sel);
}

function selectMonth(m) {
  TOPK.sel = m;
  document.querySelectorAll("#g-topk rect[data-m]").forEach(b => b.setAttribute("fill", b.dataset.m === m ? C.orange : "#c9ced6"));
  const g = $("topk-top"); if (!g) return;
  g.textContent = "";
  const d = TOPK.detail && TOPK.detail[m];
  if (!d) {
    el(g, "text", { x: 50, y: 40, "font-size": 22, "font-weight": 750, fill: C.ink }, mesLargo(m));
    el(g, "text", { x: 50, y: 180, "font-size": 15, fill: C.muted }, TOPK.detail ? "Sin detalle para este mes." : "Cargando el detalle del mes…");
    return;
  }
  const X0 = 50, X1 = 950, Yb = 300, Yt = 84, slot = (X1 - X0) / d.cand;
  const vmax = Math.max(d.llr[0] || 0, d.thr), y = v => Yb - Math.sqrt(v / vmax) * (Yb - Yt);
  const head = el(g, "text", { x: X0, y: 40, "font-size": 22, "font-weight": 750, fill: C.ink }, mesLargo(m) + ": ");
  el(head, "tspan", { fill: C.ink2, "font-weight": 500 }, `${d.cand} regiones candidatas → `);
  el(head, "tspan", { fill: C.orangeDeep }, `${d.kept} pasan`);
  el(g, "text", { x: X0, y: 62, "font-size": 12.5, fill: C.muted }, "cada barra es una región, ordenadas por Λ (escala raíz)");
  d.llr.forEach((v, i) => el(g, "rect", { x: X0 + i * slot + .5, y: y(v), width: Math.max(slot - 1, .8), height: Yb - y(v), fill: C.orange }));
  const rx = X0 + d.kept * slot;
  const gid = "fadeg" + (UID++), gr = el(el(g, "defs"), "linearGradient", { id: gid });
  el(gr, "stop", { offset: 0, "stop-color": "#c9ced6" }); el(gr, "stop", { offset: 1, "stop-color": "#c9ced6", "stop-opacity": .15 });
  el(g, "path", { d: `M${rx} ${Yb}V${y(d.thr * .92)}Q${rx + (X1 - rx) * .25} ${Yb - 14} ${X1} ${Yb - 4}V${Yb}Z`, fill: `url(#${gid})` });
  el(g, "text", { x: rx + (X1 - rx) / 2, y: Yb + 18, "text-anchor": "middle", "font-size": 13, fill: C.ink2 },
    `↑ ${d.cand - d.kept} candidatas más, que el azar iguala`);
  el(g, "line", { x1: X0, x2: X1, y1: y(d.thr), y2: y(d.thr), stroke: C.teal, "stroke-width": 2.5, "stroke-dasharray": "8 5" });
  el(g, "text", { x: X1, y: y(d.thr) - 26, "text-anchor": "end", "font-size": 13.5, "font-weight": 700, fill: C.tealDeep, class: "halo" },
    `umbral del azar: Λ = ${comma(d.thr.toFixed(1))}`);
  el(g, "text", { x: X1, y: y(d.thr) - 9, "text-anchor": "end", "font-size": 12, fill: C.tealDeep, class: "halo" },
    `en 99 meses simulados, el Λ máximo fue ${comma(d.nMean.toFixed(0))} de media y ${comma(d.nMax.toFixed(0))} como mucho`);
  if (d.llr.length) el(g, "text", { x: X0 + slot + 8, y: y(d.llr[0]) + 4, "font-size": 12.5, fill: C.orangeDeep, "font-weight": 650, class: "halo" }, `Λ = ${Math.round(d.llr[0])}`);
  el(g, "line", { x1: X0, x2: X1, y1: Yb, y2: Yb, stroke: "#c7ccd4", "stroke-width": 1.5 });
}


/* ═══ 6 · Hotspots ═══════════════════════════════════════════════════ */
function drawHs() {
  const svg = $("g-hs");
  cityLens(svg, "hotspots", { cx: 330, cy: 320, r: 270, scale: true, zoom: { zx: 800, zy: 330, zr: 170 } });
  legend(svg, 690, 60, [["thick", C.orange, "Hotspot: subgrafo conexo"], ["line", "#d0d4db", "Resto de la red"]]);
  mapNote(svg, 690, 128, `${MAP.hotspots.length} hotspots de ${mesLargo(MAP.month)} en este recorte`);
}

/* ═══ 7 · Verdad conocida ════════════════════════════════════════════
   La realización que guarda benchmark.json: un trozo real de la red de
   Lima con focos sembrados, sus delitos simulados y lo que marca cada método. */
const METHODS = [["topologico", "Topológico (este)", C.orange], ["voraz", "BFS voraz", "#6b7380"], ["anchura", "BFS anchura", "#b9bfc9"]];
function drawRealisation(g, Rz) {
  const lat0 = Rz.nodes.reduce((s, p) => s + p[1], 0) / Rz.nodes.length, kx = Math.cos(lat0 * Math.PI / 180);
  const X = Rz.nodes.map(([lo, la]) => [lo * kx, -la]);
  const core = new Set(Rz.detected.topologico || []);
  Rz.parents.concat(Rz.offspring.map(o => o[0])).forEach(i => { const e = Rz.edges[i]; if (e) { core.add(e[0]); core.add(e[1]); } });
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  (core.size ? [...core] : X.map((_, i) => i)).forEach(v => { const [a, b] = X[v];
    x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); });
  const k = 430 / Math.max(x1 - x0, y1 - y0), ox = 300 - (x1 + x0) / 2 * k, oy = 300 - (y1 + y0) / 2 * k;
  const P = v => [ox + X[v][0] * k, oy + X[v][1] * k];
  const line = (parent, [a, b], attrs) => { const [xa, ya] = P(a), [xb, yb] = P(b);
    el(parent, "line", { x1: xa, y1: ya, x2: xb, y2: yb, "stroke-linecap": "round", ...attrs }); };
  el(g, "rect", { x: -40, y: -40, width: 680, height: 680, fill: "#fbfbfc" });
  const eg = el(g, "g", { stroke: "#d5d9e0" });
  Rz.edges.forEach(e => line(eg, e, { "stroke-width": 2 }));
  const det = new Set(Rz.detected.topologico || []), dg = el(g, "g", { stroke: C.orange, class: "fade", style: "--d:.6s" });
  Rz.edges.forEach(e => { if (det.has(e[0]) && det.has(e[1])) line(dg, e, { "stroke-width": 5 }); });
  const pg = el(g, "g", { stroke: C.teal, class: "fade", style: "--d:.2s" });
  Rz.parents.forEach(i => Rz.edges[i] && line(pg, Rz.edges[i], { "stroke-width": 7, opacity: .55 }));
  const cg = el(g, "g", { class: "fade", style: "--d:.35s" });
  Rz.offspring.forEach(([i, t]) => { const e = Rz.edges[i]; if (!e) return;
    const [xa, ya] = P(e[0]), [xb, yb] = P(e[1]);
    el(cg, "circle", { cx: xa + (xb - xa) * t, cy: ya + (yb - ya) * t, r: 5, fill: C.tealDeep, stroke: "#fff", "stroke-width": 1.2 }); });
  Rz.background.forEach(v => { const [x, y] = P(v); el(cg, "circle", { cx: x, cy: y, r: 4, fill: "#9aa1ac", stroke: "#fff", "stroke-width": 1 }); });
}
function drawSyn(bench) {
  const svg = $("g-syn"); svg.textContent = "";
  if (!bench) return;
  const L = bench;
  if (L.realisation) {
    lens(svg, { cx: 230, cy: 290, r: 200, draw: g => drawRealisation(g, L.realisation) });
    legend(svg, 40, 528, [["thick", "#7cc9ca", "Foco sembrado (la verdad)"], ["dot", C.tealDeep, "Delito simulado cerca del foco"],
                          ["dot", "#9aa1ac", "Delito simulado de fondo"], ["thick", C.orange, "Lo que marca el método"]]);
  }
  const MET = [["ppv", "Precisión", "marcado que era foco"], ["sensitivity", "Sensibilidad", "focos encontrados"], ["f1", "F1", "resume las dos"]];
  const X0 = 500, Yb = 500, H = 360, gw = 150, gap = 20;
  el(svg, "line", { x1: X0 - 10, x2: 970, y1: Yb, y2: Yb, stroke: "#c7ccd4", "stroke-width": 1.5 });
  MET.forEach(([mk, lab, sub], gi) => {
    const gx = X0 + gi * (gw + gap);
    METHODS.forEach(([key, , col], mi) => {
      const v = L.methods[key] && L.methods[key][mk]; if (v === undefined) return;
      const bx = gx + mi * 50, h = v * H;
      el(svg, "rect", { x: bx, y: Yb - h, width: 42, height: h, rx: 3, fill: col, class: "grow-y", style: `--d:${(.15 + gi * .15 + mi * .06).toFixed(2)}s` });
      el(svg, "text", { x: bx + 21, y: Yb - h - 8, "text-anchor": "middle", "font-size": mi ? 13 : 15, "font-weight": mi ? 500 : 750,
        fill: mi ? C.muted : C.orangeDeep, class: "fade", style: `--d:${(.6 + gi * .15).toFixed(2)}s` }, comma(v.toFixed(2)));
    });
    el(svg, "text", { x: gx + 71, y: Yb + 26, "text-anchor": "middle", "font-size": 16, "font-weight": 650, fill: C.ink }, lab);
    el(svg, "text", { x: gx + 71, y: Yb + 46, "text-anchor": "middle", "font-size": 12.5, fill: C.muted }, sub);
  });
  METHODS.forEach(([, lab, col], i) => {
    const g = el(svg, "g", { transform: `translate(${X0 + i * 160},70)` });
    el(g, "rect", { width: 14, height: 14, rx: 3, fill: col });
    el(g, "text", { x: 20, y: 12, "font-size": 14, fill: C.ink2 }, lab);
  });
  el(svg, "text", { x: X0, y: 40, "font-size": 12.5, fill: C.muted }, `media de ${L.params.realisations} realizaciones sobre la red real de Lima`);
}

/* ═══ 7 · Misma huella ═══════════════════════════════════════════════ */
function drawFoot(ev, bench) {
  const svg = $("g-foot"); svg.textContent = "";
  if (!ev) return;
  const keys = [["topo", "Topológico (este)", C.orange], ["greedy", "BFS voraz", "#6b7380"], ["bfs", "BFS anchura", "#b9bfc9"]];
  const M = keys.filter(([k]) => ev.methods[k]);
  const maxN = Math.max(...M.map(([k]) => ev.methods[k].nodes)), maxC = Math.max(...M.map(([k]) => ev.methods[k].captured));
  const X0 = 190, W = 330, X2 = 590, W2 = 360;
  el(svg, "text", { x: X0, y: 50, "font-size": 16, "font-weight": 650, fill: C.ink }, "Esquinas marcadas");
  el(svg, "text", { x: X0, y: 70, "font-size": 13, fill: C.muted }, "la misma huella para los tres");
  el(svg, "text", { x: X2, y: 50, "font-size": 16, "font-weight": 650, fill: C.ink }, "Delitos dentro");
  el(svg, "text", { x: X2, y: 70, "font-size": 13, fill: C.muted }, "lo que de verdad cambia");
  M.forEach(([k, lab, col], i) => {
    const m = ev.methods[k], y = 110 + i * 88;
    el(svg, "text", { x: X0 - 16, y: y + 28, "text-anchor": "end", "font-size": 15, "font-weight": i ? 500 : 700, fill: i ? C.ink2 : C.orangeDeep }, lab);
    el(svg, "rect", { x: X0, y, width: m.nodes / maxN * W, height: 40, rx: 4, fill: "#d9dde3", class: "grow-x", style: `--d:${(.1 + i * .08).toFixed(2)}s` });
    el(svg, "text", { x: X0 + 10, y: y + 26, "font-size": 14, fill: C.ink2, class: "fade", style: "--d:.6s" }, fmtN(m.nodes));
    el(svg, "rect", { x: X2, y, width: m.captured / maxC * W2, height: 40, rx: 4, fill: col, class: "grow-x", style: `--d:${(.35 + i * .1).toFixed(2)}s` });
    el(svg, "text", { x: X2 + 10, y: y + 26, "font-size": 14.5, "font-weight": 650, fill: i === 2 ? C.ink2 : "#fff", class: "fade", style: "--d:.9s" }, fmtN(m.captured));
  });
  if (!bench) return;
  const nul = bench.null_check;
  const g = el(svg, "g", { transform: "translate(190,410)", class: "fade", style: "--d:1.1s" });
  el(g, "rect", { width: 760, height: 150, rx: 12, fill: C.teal });
  const ic = el(g, "svg", { x: 34, y: 42, width: 66, height: 66, viewBox: "0 0 24 24", color: "#fff" });
  el(ic, "use", { href: "#i-dice" });
  el(g, "text", { x: 130, y: 64, "font-size": 18, fill: "#e6f7f7" }, `Crimen repartido al azar, ${nul.realisations} veces:`);
  el(g, "text", { x: 130, y: 108, "font-size": 34, "font-weight": 800, fill: "#fff" },
    nul.significant_max === 0 ? "0 zonas declaradas" : `${nul.significant_max} zonas como máximo`);
  el(g, "text", { x: 130, y: 132, "font-size": 14, fill: "#d3f0f0" }, "El test no inventa hotspots donde no los hay.");
}

/* ═══ 9 · Vector de forma: tres lecturas del mismo hotspot real ═══════ */
const BLOCK = { topo: C.orange, g2v: C.teal, jer: C.ink2 };
const DEG_COL = ["#fde0cf", "#f9a877", "#f5733f", "#b8360a"];
const WL_COL = ["#2ba6a8", "#7048e8", "#f5733f", "#d4a72c", "#1b6ef3", "#e8354f", "#0ca678", "#8a6d3b", "#6b7380"];

function shapeInfo(sh) {
  const n = sh.nodes.length, deg = new Array(n).fill(0), nb = sh.nodes.map(() => []);
  sh.edges.forEach(([a, b]) => { deg[a]++; deg[b]++; });
  sh.edges.forEach(([a, b]) => { nb[a].push(deg[b]); nb[b].push(deg[a]); });
  let mx = 0, my = 0; sh.nodes.forEach(([x, y]) => { mx += x; my += y; }); mx /= n; my /= n;
  let sxx = 0, syy = 0, sxy = 0;
  sh.nodes.forEach(([x, y]) => { const dx = x - mx, dy = y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
  sxx /= n; syy /= n; sxy /= n;
  const tr = sxx + syy, disc = Math.sqrt(Math.max(0, (sxx - syy) ** 2 / 4 + sxy * sxy));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc, ang = Math.atan2(l1 - sxx, sxy || 1e-9);
  // Una ronda de Weisfeiler–Lehman: grado propio + grados vecinos ordenados.
  const wl = nb.map((a, v) => deg[v] + "|" + a.sort().join(""));
  return { n, deg, mx, my, l1, l2, ang, wl, elong: Math.sqrt(Math.max(l2, 0) / l1) };
}

function panel(svg, x, y, w, h, title, sub, color, d) {
  const g = el(svg, "g", { class: "fade", style: `--d:${d}s` });
  el(g, "rect", { x, y, width: w, height: h, rx: 12, fill: "#fff", stroke: "#e3e6eb", "stroke-width": 1.5, class: "lens-ring" });
  el(g, "rect", { x, y, width: w, height: 5, rx: 2.5, fill: color });
  el(g, "text", { x: x + 18, y: y + 34, "font-size": 19, "font-weight": 700, fill: color }, title);
  el(g, "text", { x: x + 18, y: y + 54, "font-size": 13, fill: C.muted }, sub);
  return g;
}

function drawVec() {
  const svg = $("g-vec"), sh = EX.twins.high, info = shapeInfo(sh), ids = sh.nodes.map((_, i) => i);
  const PW = 312, PH = 420, PY = 8, XS = [8, 344, 680];
  const edgesGray = (g, f) => sh.edges.forEach(([a, b]) => { const [x1, y1] = f.P(a), [x2, y2] = f.P(b);
    el(g, "line", { x1, y1, x2, y2, stroke: "#d5d9e0", "stroke-width": 2.2, "stroke-linecap": "round" }); });

  // 1 · Topología: grado de cada esquina + elipse de elongación.
  let g = panel(svg, XS[0], PY, PW, PH, "Topología · 12", "cómo se conectan las esquinas", BLOCK.topo, .05);
  let f = fitShape(sh, XS[0] + 30, PY + 74, PW - 60, 190);
  const [ex, ey] = f.Q(info.mx, info.my);
  el(g, "ellipse", { cx: ex, cy: ey, rx: 1.7 * Math.sqrt(info.l1) * f.k, ry: Math.max(6, 1.7 * Math.sqrt(Math.max(info.l2, 0)) * f.k),
    transform: `rotate(${info.ang * 180 / Math.PI} ${ex} ${ey})`, fill: "none", stroke: C.ink2, "stroke-width": 1.5, "stroke-dasharray": "5 4", opacity: .6 });
  edgesGray(g, f);
  ids.forEach(v => { const [x, y] = f.P(v), dg = Math.min(Math.max(info.deg[v], 1), 4);
    el(g, "circle", { cx: x, cy: y, r: 5.5, fill: DEG_COL[dg - 1], stroke: "#fff", "stroke-width": 1.2 }); });
  const cnt = [0, 0, 0, 0]; ids.forEach(v => cnt[Math.min(Math.max(info.deg[v], 1), 4) - 1]++);
  const bx = XS[0] + 24, by = PY + 382, bh = 72;
  el(g, "text", { x: bx, y: PY + 292, "font-size": 12.5, fill: C.muted }, "esquinas según nº de calles");
  cnt.forEach((n, i) => {
    const hgt = Math.max(2, n / info.n * bh);
    el(g, "rect", { x: bx + i * 36, y: by - hgt, width: 28, height: hgt, rx: 3, fill: DEG_COL[i], class: "grow-y", style: `--d:${(.4 + i * .06).toFixed(2)}s` });
    el(g, "text", { x: bx + i * 36 + 14, y: by + 16, "text-anchor": "middle", "font-size": 12.5, fill: C.ink2 }, i === 3 ? "4+" : String(i + 1));
  });
  el(g, "text", { x: XS[0] + 188, y: PY + 322, "font-size": 12.5, fill: C.muted }, "elongación");
  el(g, "text", { x: XS[0] + 188, y: PY + 354, "font-size": 30, "font-weight": 800, fill: C.ink }, comma(info.elong.toFixed(2)));
  el(g, "text", { x: XS[0] + 188, y: PY + 376, "font-size": 11.5, fill: C.muted }, "0 recta · 1 redonda");

  // 2 · graph2vec: etiquetas Weisfeiler–Lehman.
  g = panel(svg, XS[1], PY, PW, PH, "graph2vec · 128", "patrones de vecindario, aprendidos", BLOCK.g2v, .15);
  f = fitShape(sh, XS[1] + 30, PY + 74, PW - 60, 190);
  const freq = new Map();
  info.wl.forEach(l => freq.set(l, (freq.get(l) || 0) + 1));
  const labs = [...freq.keys()].sort((a, b) => freq.get(b) - freq.get(a));
  const colOf = l => WL_COL[Math.min(labs.indexOf(l), WL_COL.length - 1)];
  edgesGray(g, f);
  ids.forEach(v => { const [x, y] = f.P(v); el(g, "rect", { x: x - 5.5, y: y - 5.5, width: 11, height: 11, rx: 2.5, fill: colOf(info.wl[v]), stroke: "#fff", "stroke-width": 1.2 }); });
  el(g, "text", { x: XS[1] + 24, y: PY + 292, "font-size": 12.5, fill: C.muted }, "«bolsa» de etiquetas del hotspot");
  labs.slice(0, 8).forEach((l, i) => {
    const cx = XS[1] + 24 + (i % 4) * 70, cy = PY + 306 + Math.floor(i / 4) * 32;
    el(g, "rect", { x: cx, y: cy, width: 16, height: 16, rx: 3.5, fill: colOf(l), class: "fade", style: `--d:${(.5 + i * .05).toFixed(2)}s` });
    el(g, "text", { x: cx + 22, y: cy + 13, "font-size": 13.5, fill: C.ink2, "font-weight": 600 }, "×" + freq.get(l));
  });
  el(g, "text", { x: XS[1] + 24, y: PY + 396, "font-size": 12.5, fill: C.ink2 }, "mismo color = mismo entorno de conexiones");

  // 3 · Jerarquía vial: tipo de cada calle.
  g = panel(svg, XS[2], PY, PW, PH, "Jerarquía vial · 6", "de qué tipo de vías está hecho", BLOCK.jer, .25);
  f = fitShape(sh, XS[2] + 30, PY + 74, PW - 60, 190);
  [...sh.edges].sort((a, b) => (RW[a[2]] || RW.street)[3] - (RW[b[2]] || RW.street)[3]).forEach(([a, b, c]) => {
    const [x1, y1] = f.P(a), [x2, y2] = f.P(b), r = RW[c] || RW.street;
    el(g, "line", { x1, y1, x2, y2, stroke: r[2], "stroke-width": r[3] + .6, "stroke-linecap": "round", "stroke-dasharray": c === "service" ? "3 3" : null });
  });
  ids.forEach(v => { const [x, y] = f.P(v); el(g, "circle", { cx: x, cy: y, r: 2.6, fill: "#fff", stroke: "#9aa1ac", "stroke-width": 1.2 }); });
  const tot = sh.edges.length || 1, share = ROAD.map(r => sh.edges.filter(e => e[2] === r[0]).length / tot);
  let acc = 0;
  const sx = XS[2] + 24, sw = PW - 48, sy = PY + 292;
  ROAD.forEach((r, i) => {
    if (share[i] > 0) el(g, "rect", { x: sx + acc * sw, y: sy, width: share[i] * sw, height: 20, fill: r[2], class: "grow-x", style: `--d:${(.45 + i * .08).toFixed(2)}s` });
    acc += share[i];
    const lx = sx + (i % 2) * 140, ly = sy + 44 + Math.floor(i / 2) * 22;
    el(g, "rect", { x: lx, y: ly - 10, width: 12, height: 12, rx: 2, fill: r[2] });
    el(g, "text", { x: lx + 18, y: ly, "font-size": 13, fill: C.ink2 }, `${r[1]} ${Math.round(share[i] * 100)} %`);
  });

  // Los tres bloques se juntan en un vector, con el mismo peso cada uno.
  const VX = 300, VY = 520, VW = 330, VH = 42;
  [[XS[0] + PW / 2, BLOCK.topo], [XS[1] + PW / 2, BLOCK.g2v], [XS[2] + PW / 2, BLOCK.jer]].forEach(([x0, col], i) => {
    const p = curve(svg, x0, PY + PH + 6, VX + VW * (i + .5) / 3, VY - 26, i === 1 ? 0 : (i ? -.12 : .12), "ah", col);
    p.setAttribute("class", "fade"); p.style.setProperty("--d", (.7 + i * .08) + "s");
  });
  const vg = el(svg, "g", { class: "fade", style: "--d:.9s" });
  for (let st = 3; st >= 1; st--) el(vg, "rect", { x: VX + st * 7, y: VY - st * 7, width: VW, height: VH, fill: "#fff", stroke: "#9aa1ac", "stroke-width": 1.4 });
  [[BLOCK.topo, "12"], [BLOCK.g2v, "128"], [BLOCK.jer, "6"]].forEach(([col, lab], i) => {
    el(vg, "rect", { x: VX + i * VW / 3, y: VY, width: VW / 3, height: VH, fill: col, stroke: "#fff", "stroke-width": 2 });
    el(vg, "text", { x: VX + (i + .5) * VW / 3, y: VY + 27, "text-anchor": "middle", "font-size": 16, "font-weight": 700, fill: "#fff" }, lab);
  });
  el(vg, "text", { x: VX - 16, y: VY + 20, "text-anchor": "end", "font-size": 20, "font-weight": 700, fill: C.ink }, "146 números");
  el(vg, "text", { x: VX - 16, y: VY + 40, "text-anchor": "end", "font-size": 12.5, fill: C.muted }, `hotspot ${sh.id}`);
  const rg = el(svg, "g", { transform: `translate(${VX + VW + 34},${VY - 8})`, class: "fade", style: "--d:1.2s" });
  el(rg, "rect", { width: 300, height: 56, rx: 10, fill: "#fde9df" });
  for (let i = 0; i < 5; i++) el(rg, "circle", { cx: 24 + (i % 3) * 9, cy: 22 + Math.floor(i / 3) * 12, r: 4, fill: C.orange });
  el(rg, "line", { x1: 12, y1: 42, x2: 50, y2: 14, stroke: C.orangeDeep, "stroke-width": 3, "stroke-linecap": "round" });
  el(rg, "text", { x: 64, y: 25, "font-size": 14.5, "font-weight": 650, fill: C.orangeDeep }, "El crimen no entra");
  el(rg, "text", { x: 64, y: 43, "font-size": 12.5, fill: C.orangeDeep }, "el vector solo describe la forma");
}

/* ═══ 10 · Similitud coseno + espacio de embeddings real ═════════════ */
function drawCos() {
  const svg = $("g-cos");
  const O = [90, 500];
  const arrow = (dx, dy, col, lab, d, m) => {
    el(svg, "line", { x1: O[0], y1: O[1], x2: O[0] + dx, y2: O[1] + dy, stroke: col, "stroke-width": 4, "stroke-linecap": "round", "marker-end": `url(#${m})`,
      class: "draw", style: `--len:${Math.hypot(dx, dy)};--d:${d}s` });
    el(svg, "text", { x: O[0] + dx + 10, y: O[1] + dy - 6, "font-size": 17, "font-weight": 700, fill: col, class: "fade", style: `--d:${d + .5}s` }, lab);
  };
  el(svg, "line", { x1: O[0], y1: O[1], x2: 420, y2: O[1], stroke: "#d5d9e2", "stroke-width": 1.5 });
  el(svg, "line", { x1: O[0], y1: O[1], x2: O[0], y2: 120, stroke: "#d5d9e2", "stroke-width": 1.5 });
  arrow(260, -250, C.orange, "A", .1, "ah-o");
  arrow(140, -150, C.orangeDeep, "B", .3, "ah-o");
  arrow(300, -40, "#9aa1ac", "C", .5, "ah");
  const a1 = Math.atan2(-250, 260), a2 = Math.atan2(-150, 140);
  el(svg, "path", { d: `M${O[0] + 90 * Math.cos(a1)} ${O[1] + 90 * Math.sin(a1)}A90 90 0 0 0 ${O[0] + 90 * Math.cos(a2)} ${O[1] + 90 * Math.sin(a2)}`, fill: "none", stroke: C.orangeDeep, "stroke-width": 2, class: "fade", style: "--d:.9s" });
  const t1 = el(svg, "text", { x: 60, y: 560, "font-size": 15.5, fill: C.ink2, class: "fade", style: "--d:1s" }, "A y B: casi el mismo ángulo → ");
  el(t1, "tspan", { "font-weight": 700, fill: C.orangeDeep }, "parecidos");
  el(svg, "text", { x: 60, y: 585, "font-size": 15.5, fill: C.ink2, class: "fade", style: "--d:1.1s" }, "B es más corta (hotspot más pequeño): da igual");
  // Proyección 2D real de todos los hotspots.
  const E = EX.embedding, X0 = 480, Y0 = 60, W = 480, H = 480;
  el(svg, "rect", { x: X0, y: Y0, width: W, height: H, rx: 14, fill: "#fff", stroke: C.line });
  el(svg, "text", { x: X0 + 16, y: Y0 + 28, "font-size": 15, "font-weight": 600, fill: C.ink2 }, `Los ${fmtN(E.pts.length)} hotspots de Lima, proyectados en 2D`);
  const P = embScale(E.pts, X0 + 24, Y0 + 50, W - 48, H - 110);
  const pg = el(svg, "g");
  E.pts.forEach(p => { const [x, y] = P(p); el(pg, "circle", { cx: x, cy: y, r: 2, fill: p[2] < 0 ? "#d3d7dd" : "#8f96a2", opacity: .65 }); });
  const [qx, qy] = P(E.pts[E.query]), hg = el(svg, "g");
  E.similar.forEach(([i], j) => { const [x, y] = P(E.pts[i]);
    el(hg, "line", { x1: qx, y1: qy, x2: x, y2: y, stroke: C.orange, "stroke-width": 2, class: "fade", style: `--d:${(.8 + j * .1).toFixed(1)}s` });
    el(hg, "circle", { cx: x, cy: y, r: 6, fill: "#fff", stroke: C.orange, "stroke-width": 2.5, class: "fade", style: `--d:${(.8 + j * .1).toFixed(1)}s` }); });
  el(hg, "circle", { cx: qx, cy: qy, r: 8, fill: C.orangeDeep, stroke: "#fff", "stroke-width": 2 });
  const sc = E.similar.map(s => s[1]), lo = Math.min(...sc), hi = Math.max(...sc);
  el(svg, "text", { x: X0 + 16, y: Y0 + H - 34, "font-size": 13.5, fill: C.ink2 }, `● ${EX.meta.focus} y sus 5 más parecidos`);
  el(svg, "text", { x: X0 + 16, y: Y0 + H - 15, "font-size": 12.5, fill: C.muted },
    `coseno entre ${comma(lo.toFixed(2))} y ${comma(hi.toFixed(2))}`);
}

/* ═══ 11 · Gemelos reales ════════════════════════════════════════════ */
const CUARENTENA = m => m >= "2020-03" && m <= "2020-06";
function drawTwin() {
  const svg = $("g-twin"), T = EX.twins, pair = T.pair;
  let ext = 1;
  [T.high, T.low].forEach(sh => sh.nodes.forEach(([x, y]) => ext = Math.max(ext, Math.hypot(x, y))));
  const k = 150 / ext;
  const side = (cx, sh, col, dot) => {
    const r = 190, id = "T" + (UID++), g = el(svg, "g");
    const cp = el(el(svg, "defs"), "clipPath", { id }); el(cp, "circle", { cx, cy: 330, r });
    el(g, "circle", { cx, cy: 330, r: r + 1, fill: "#fff", class: "lens-ring" });
    const inner = el(g, "g", { "clip-path": `url(#${id})` });
    el(inner, "rect", { x: cx - r, y: 140, width: 2 * r, height: 2 * r, fill: "#fbfbfc" });
    const P = v => [cx + sh.nodes[v][0] * k, 330 + sh.nodes[v][1] * k];
    sh.edges.forEach(([a, b]) => { const [x1, y1] = P(a), [x2, y2] = P(b);
      el(inner, "line", { x1, y1, x2, y2, stroke: col, "stroke-width": 3, "stroke-linecap": "round" }); });
    sh.nodes.forEach((_, v) => { const [x, y] = P(v); el(inner, "circle", { cx: x, cy: y, r: 3, fill: "#fff", stroke: col, "stroke-width": 1.8 }); });
    const cg = el(inner, "g", { class: "fade", style: "--d:.5s" });
    sh.crimes.forEach(([x, y]) => el(cg, "circle", { cx: cx + x * k, cy: 330 + y * k, r: 3.4, fill: dot, opacity: .75 }));
    el(g, "circle", { cx, cy: 330, r, fill: "none", stroke: "#d5d9e2", "stroke-width": 2 });
    const px = 100 * k;
    el(g, "path", { d: `M${cx - px / 2} ${330 + r - 26}v5h${px}v-5`, fill: "none", stroke: C.ink2, "stroke-width": 1.4 });
    el(g, "text", { x: cx, y: 330 + r - 30, "text-anchor": "middle", "font-size": 11, fill: C.ink2 }, "100 m");
  };
  side(250, T.high, C.orange, C.orangeDeep); side(750, T.low, C.teal, C.orange);
  const head = (x, n, m, col) => {
    el(svg, "text", { x, y: 92, "text-anchor": "middle", "font-size": 34, "font-weight": 800, fill: col }, `${n} delitos`);
    el(svg, "text", { x, y: 116, "text-anchor": "middle", "font-size": 14.5, fill: C.muted }, mesLargo(m) + (CUARENTENA(m) ? " · cuarentena COVID-19" : ""));
  };
  head(250, pair.crimes_high, pair.month_high, C.orangeDeep);
  head(750, pair.crimes_low, pair.month_low, C.teal);
  const b = el(svg, "g", { class: "fade", style: "--d:.3s" });
  el(b, "rect", { x: 430, y: 300, width: 140, height: 60, rx: 30, fill: "#fff", stroke: "#dfe2e8", "stroke-width": 1.5, class: "lens-ring" });
  el(b, "text", { x: 500, y: 326, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: C.ink2 }, "misma forma");
  el(b, "text", { x: 500, y: 346, "text-anchor": "middle", "font-size": 12.5, fill: C.muted }, `distancia ${comma(pair.topo_distance.toFixed(2))}`);
  el(svg, "text", { x: 500, y: 580, "text-anchor": "middle", "font-size": 20, "font-weight": 650, fill: C.ink, class: "fade", style: "--d:.8s" }, "¿Qué los separa, si no es la calle?  →");
  el(svg, "text", { x: 500, y: 608, "text-anchor": "middle", "font-size": 12, fill: C.faint }, `Hotspots reales ${T.high.id} y ${T.low.id}, a la misma escala.`);
}

/* ═══ 11 · POIs ══════════════════════════════════════════════════════ */
const POI_LAB = { finance: "Bancos y finanzas", food: "Restaurantes y comida", retail: "Comercio", nightlife: "Vida nocturna",
                  park: "Parques", police: "Policía", health: "Salud", education: "Educación" };
function drawPoi(cs) {
  const svg = $("g-poi"); svg.textContent = "";
  if (!cs || !cs.matched_poi_contrast) return;
  const rows = cs.matched_poi_contrast.filter(r => r.name.startsWith("lq:"))
    .map(r => ({ ...r, key: r.name.slice(3) })).sort((a, b) => b.wins - a.wins);
  const X0 = 250, W = 640, x = v => X0 + v * W, y0 = 90, rh = 56;
  el(svg, "text", { x: X0, y: 40, "font-size": 15.5, "font-weight": 650, fill: C.ink }, "% de pares en que la gemela caliente tiene más");
  [0, .25, .5, .75, 1].forEach(t => {
    el(svg, "line", { x1: x(t), x2: x(t), y1: y0 - 14, y2: y0 + rows.length * rh - 10, stroke: t === .5 ? C.ink2 : "#eceef1", "stroke-width": t === .5 ? 1.8 : 1, "stroke-dasharray": t === .5 ? "6 5" : null });
    el(svg, "text", { x: x(t), y: y0 + rows.length * rh + 12, "text-anchor": "middle", "font-size": 13, fill: C.muted }, Math.round(t * 100) + " %");
  });
  el(svg, "text", { x: x(.5) + 6, y: y0 - 22, "font-size": 13, fill: C.ink2 }, "empate (azar)");
  rows.forEach((r, i) => {
    const y = y0 + i * rh, sig = r.p_adj < .05;
    el(svg, "text", { x: X0 - 16, y: y + 24, "text-anchor": "end", "font-size": 16, "font-weight": sig ? 600 : 450, fill: sig ? C.ink : C.muted }, POI_LAB[r.key] || r.key);
    el(svg, "rect", { x: X0, y: y + 4, width: r.wins * W, height: 30, rx: 4, fill: sig ? (i < 4 ? C.orange : "#f9a877") : "#d5d9e0",
      class: "grow-x", style: `--d:${(.1 + i * .07).toFixed(2)}s` });
    el(svg, "text", { x: x(r.wins) + 10, y: y + 25, "font-size": 15, "font-weight": 700, fill: sig ? C.orangeDeep : C.muted, class: "fade", style: `--d:${(.6 + i * .07).toFixed(2)}s` },
      Math.round(r.wins * 100) + " %" + (sig ? "" : "  · no significativo"));
  });
  const top = rows[0];
  K.topWins = Math.round(top.wins * 100) + " %"; K.topCat = (POI_LAB[top.key] || top.key).toLowerCase();
  K.nPairs = top.n_pairs;
}
