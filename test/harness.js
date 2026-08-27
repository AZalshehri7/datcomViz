/* Load index.html's inline script under Node with a stubbed DOM.
 *
 * The app is one HTML file with one <script> block and no module boundary, so
 * there is nothing to import. This pulls the script out, runs it in a vm
 * context against enough of a DOM to get through start-up, and hands back the
 * context — plus `$`, which evaluates an expression inside it.
 *
 * Only what the app touches at load time is stubbed, and deliberately no more:
 * the point is to exercise the real parser, the real geometry checks and the
 * real case builder, not a reimplementation of them. WebGLRenderer and
 * OrbitControls are replaced because there is no GL in Node; everything else
 * is the shipped code.
 *
 * Top-level `const`/`let` in a vm script are lexical bindings, not properties
 * of the context object, so `sb.REL` is undefined while `sb.$("REL")` works.
 * Reach into the app with `$`.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

function mkEl(id, tag) {
  const el = {
    id, tagName: (tag || "div").toUpperCase(), style: {}, dataset: {},
    children: [], _text: "", _html: "",
    checked: false, value: "", disabled: false,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) {
        if (on === undefined) this._s.has(c) ? this._s.delete(c) : this._s.add(c);
        else on ? this._s.add(c) : this._s.delete(c);
      },
      contains(c) { return this._s.has(c); },
    },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    remove() {}, setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, click() {}, focus() {}, blur() {},
    // enough for `lab.querySelector("input").onchange = ...` to land somewhere
    querySelector(sel) { return mkEl(null, String(sel).replace(/[^a-z]/gi, "") || "div"); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
  };
  // real elements keep className and classList in sync; the stub must too, or
  // `d.className = "msg err"` leaves classList.contains("err") false and every
  // assertion about error styling silently passes
  Object.defineProperty(el, "className", {
    get() { return [...el.classList._s].join(" "); },
    set(v) { el.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
  });
  Object.defineProperty(el, "textContent", {
    get() { return el._text; },
    set(v) { el._text = String(v); el.children = []; },
  });
  Object.defineProperty(el, "innerHTML", {
    get() { return el._html; },
    set(v) { el._html = String(v); el.children = []; },
  });
  Object.defineProperty(el, "innerText", {
    get() { return el._text; }, set(v) { el._text = String(v); },
  });
  return el;
}

function makeSandbox() {
  const els = new Map();
  const get = id => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); };
  const document = {
    _els: els,
    getElementById: get,
    createElement: t => mkEl(null, t),
    createElementNS: (ns, t) => mkEl(null, t),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    body: mkEl("body"), documentElement: mkEl("html"), head: mkEl("head"),
  };
  const store = new Map();
  const sb = {
    document,
    console,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
      clear: () => store.clear(),
    },
    navigator: { clipboard: { writeText: () => Promise.resolve() }, userAgent: "node" },
    location: { href: "file:///index.html" },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
    Blob: class { constructor(parts) { this.parts = parts; } },
    FileReader: class {},
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addListener() {}, addEventListener() {} }),
    performance: { now: () => 0 },
  };
  sb.window = sb;
  sb.globalThis = sb;
  return sb;
}

/** Load the app. `file` defaults to the shipped index.html. */
function load(file) {
  const target = file || path.join(ROOT, "index.html");
  const html = fs.readFileSync(target, "utf8");
  const m = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error(`no inline <script> block in ${target}`);

  const sb = makeSandbox();
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "vendor/three.min.js"), "utf8"),
                  sb, { filename: "three.min.js" });

  // no GL in Node — the app only needs the renderer to exist and take calls
  sb.THREE.WebGLRenderer = class {
    constructor() { this.domElement = mkEl("canvas", "canvas"); this.shadowMap = {}; this.outputEncoding = 0; }
    setSize() {} setPixelRatio() {} setClearColor() {} render() {} dispose() {}
    getContext() { return {}; } setViewport() {} setScissorTest() {} clear() {}
  };
  sb.THREE.OrbitControls = class {
    constructor() {
      this.target = new sb.THREE.Vector3();
      this.enableDamping = false; this.dampingFactor = 0; this.enabled = true;
      this.minDistance = 0; this.maxDistance = Infinity; this.screenSpacePanning = true;
      this.mouseButtons = {}; this.touches = {};
    }
    update() {} addEventListener() {} removeEventListener() {}
    dispose() {} saveState() {} reset() {}
  };

  vm.runInContext(m[1], sb, { filename: path.relative(ROOT, target) });
  sb.$ = code => vm.runInContext(code, sb, { filename: "probe" });
  return sb;
}

/* ---- helpers the suites share -------------------------------------------- */

/** Parse a deck under one release and return the Messages panel, per case. */
function messages(sb, text, release, name) {
  sb.$(`relSet(${JSON.stringify(release)}, false)`);
  sb.__deck = text;
  sb.$(`loadText(__deck, ${JSON.stringify(name || "deck.dat")})`);
  const out = [];
  const n = sb.$("CASES.length");
  for (let i = 0; i < n; i++) {
    sb.$(`CASE_I = ${i}; rebuild();`);
    out.push({
      warnings: JSON.parse(sb.$("JSON.stringify(WARNINGS)")),
      checks: JSON.parse(sb.$("JSON.stringify(CHECKS)")),
    });
  }
  return out;
}

/** Every message of every case, flattened — for "does this fire at all" asserts. */
const allMessages = cases => cases.flatMap(c => c.warnings.concat(c.checks));

/** Count vertices the geometry build produced as NaN or Infinity. */
function nonFiniteVertices(sb) {
  return sb.$(`(function () {
    let bad = 0;
    model.traverse(o => {
      const g = o.geometry;
      if (!g || !g.attributes || !g.attributes.position) return;
      const a = g.attributes.position.array;
      for (let i = 0; i < a.length; i++) if (!isFinite(a[i])) bad++;
    });
    return bad;
  })()`);
}

/** The Cases tab banner, split into errors and warnings. */
function banner(sb) {
  const kids = sb.document.getElementById("cbWarn").children;
  return {
    errors: kids.filter(c => c.classList.contains("err")).map(c => c.textContent),
    warnings: kids.filter(c => c.classList.contains("warn")).map(c => c.textContent),
  };
}

/** Reset the builder to its defaults under `release`, optionally seeded by a deck. */
function builder(sb, release, deckText, deckName) {
  sb.$(`relSet(${JSON.stringify(release)}, false); CB.vars = [];`);
  if (deckText) {
    sb.__deck = deckText;
    sb.$(`loadText(__deck, ${JSON.stringify(deckName || "deck.dat")});`);
  }
  sb.$("cbBuild(); cbRender();");
}

/** Generate, and return the emitted files plus the banner. */
function generate(sb) {
  sb.$("cbGenerate();");
  return {
    files: JSON.parse(sb.$("JSON.stringify(CB_FILES.map(f => ({ name: f.name, cases: f.cases, nl: f.nl })))")),
    text: sb.$('CB_FILES.length ? CB_FILES[0].text : ""'),
    out: sb.document.getElementById("cbOut").textContent,
    summary: sb.document.getElementById("cbSummary").innerHTML.replace(/<[^>]+>/g, ""),
    ...banner(sb),
  };
}

module.exports = {
  ROOT, load, mkEl,
  messages, allMessages, nonFiniteVertices, banner, builder, generate,
};
