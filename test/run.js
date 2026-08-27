#!/usr/bin/env node
/* datcomViz test suite.  node test/run.js
 *
 * Everything here runs against the shipped index.html through test/harness.js.
 * There is no build step and no dependencies; Node is the only requirement.
 *
 * The suite is self-contained. Setting DATCOMVIZ_REFERENCE to a checkout of
 * the reference material adds two further groups that need decks too large,
 * or too specific to one vehicle, to belong in this repo:
 *
 *   DATCOMVIZ_REFERENCE=../datcomViz-reference node test/run.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const H = require("./harness.js");

const DECKS = path.join(__dirname, "decks");
const REF = process.env.DATCOMVIZ_REFERENCE
  ? path.resolve(process.env.DATCOMVIZ_REFERENCE) : null;
const deck = n => fs.readFileSync(path.join(DECKS, n), "utf8");

/* ---- a very small test runner -------------------------------------------- */
let pass = 0, fail = 0, group = "";
const results = [];
const G = name => { group = name; results.push({ group: name }); };
function check(name, cond, detail) {
  if (cond) { pass++; results.push({ ok: true, name }); }
  else { fail++; results.push({ ok: false, name, detail }); }
}
const eq = (name, got, want) =>
  check(name, Object.is(got, want), `wanted ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
/** A message matching `re` appears among `msgs`. */
const says = (name, msgs, re) =>
  check(name, msgs.some(m => re.test(m)), `no message matched ${re}\n      among:\n` +
    msgs.map(m => "        · " + m.slice(0, 120)).join("\n"));
const silent = (name, msgs, re) =>
  check(name, !msgs.some(m => re.test(m)), `unexpected match for ${re}:\n` +
    msgs.filter(m => re.test(m)).map(m => "        · " + m.slice(0, 120)).join("\n"));

/* ========================================================================= */
G("release model");
{
  const sb = H.load();
  eq("defaults to 3/11", sb.$("REL.key"), "3/11");
  eq("3/11 raises ALPHA to 100", sb.$('RELEASES["3/11"].alphaMax'), 100);
  eq("5/97 holds ALPHA at 20", sb.$('RELEASES["5/97"].alphaMax'), 20);
  eq("3/11 allows nine fin sets", sb.$('RELEASES["3/11"].finsetMax'), 9);
  eq("5/97 allows four fin sets", sb.$('RELEASES["5/97"].finsetMax'), 4);
  check("XHINGE reaches four sets in both",
    sb.$('RELEASES["3/11"].hingeSets') === 4 && sb.$('RELEASES["5/97"].hingeSets') === 4);

  sb.$('relSet("5/97", false)');
  eq("switching updates REL", sb.$("REL.key"), "5/97");
  eq("and persists", sb.localStorage.getItem("datcomviz.release.v1"), "5/97");
  eq("and drives the picker", sb.document.getElementById("relSel").value, "5/97");
  sb.$('relSet("nonsense", false)');
  eq("an unknown key falls back to the default", sb.$("REL.key"), "3/11");

  const vis = id => sb.document.getElementById(id).style.display !== "none";
  sb.$('relSet("5/97", false)');
  check("5/97 offers the WRITE tick, not for043", vis("cbWriteLbl") && !vis("cbFin43Lbl"));
  sb.$('relSet("3/11", false)');
  check("3/11 offers for043, not WRITE", !vis("cbWriteLbl") && vis("cbFin43Lbl"));
}

/* ========================================================================= */
G("a clean deck stays clean");
for (const rel of ["3/11", "5/97"]) {
  const sb = H.load();
  const cases = H.messages(sb, deck("minimal.dat"), rel, "minimal.dat");
  eq(`${rel}: one case`, cases.length, 1);
  eq(`${rel}: no checks`, H.allMessages(cases).length, 0);
  eq(`${rel}: geometry is finite`, H.nonFiniteVertices(sb), 0);
}

/* ========================================================================= */
G("geometry checks follow the release");
{
  const src = deck("releases.dat");
  const s11 = H.load(), s97 = H.load();
  const m11 = H.allMessages(H.messages(s11, src, "3/11", "releases.dat"));
  const m97 = H.allMessages(H.messages(s97, src, "5/97", "releases.dat"));

  // things 3/11 has and 5/97 does not
  says("5/97 reports NVOR as unknown", m97, /NVOR, which does not exist in Rev 5\/97/);
  silent("3/11 accepts NVOR", m11, /NVOR, which does not exist/);
  says("5/97 reports fin sets past four", m97, /FINSET5 is beyond the 4 fin sets/);
  silent("3/11 accepts nine fin sets", m11, /is beyond the \d+ fin sets/);
  says("5/97 reports DELTA5", m97, /\$DEFLCT sets DELTA5, but Rev 5\/97 has only 4/);
  says("5/97 reports PHIPRO as unknown", m97, /PHIPRO, which does not exist/);
  silent("3/11 accepts PHIPRO", m11, /PHIPRO, which does not exist/);
  says("5/97 reports Z camber as unknown", m97, /Z camber array does not exist/);
  says("5/97 reports NINCR as unknown", m97, /NINCR, which does not exist/);

  // things 3/11 checks and 5/97 cannot
  says("3/11 rejects NVOR above 20", m11, /NVOR=25 is outside the 1 to 20/);
  says("3/11 flags NVOR on the aftmost set", m11, /aftmost fin set/);
  says("3/11 forbids camber at non-zero PHI", m11, /cambered .* PHI=45/);
  says("3/11 reports ASYM as deleted", m11, /ASYM, which was deleted from the code in 8\/08/);
  silent("5/97 accepts ASYM", m97, /ASYM/);

  // the same input, reported differently
  says("3/11 makes BETA with PHI fatal", m11, /both BETA and PHI\. Rev 3\/11 treats that as a fatal error/);
  says("5/97 makes BETA with PHI harmless", m97, /both BETA and PHI\. Rev 5\/97 accepts it/);
  says("3/11 permits co-located sets", m11, /permitted deliberately/);
  silent("5/97 does not", m97, /permitted deliberately/);

  // the hinge-array note is release-independent once the set exists
  says("DELTA past XHINGE's array size is flagged", m11, /XHINGE and SKEW are array size 4/);

  // every gated message offers the way out
  const gated = m11.concat(m97).filter(m => /does not exist in Rev|is beyond the \d+ fin sets|cannot handle conic/.test(m));
  check("each gated message names the switch", gated.length > 0 &&
    gated.every(m => /Switch the target release to (3\/11|5\/97)/.test(m)),
    `${gated.filter(m => !/Switch the target release/.test(m)).length} of ${gated.length} lack it`);
  check("and only names a release the picker has", gated.every(m => {
    const to = /Switch the target release to (\S+?) if/.exec(m);
    return to && ["3/11", "5/97"].includes(to[1]);
  }));

  for (const [rel, sb] of [["3/11", s11], ["5/97", s97]])
    eq(`${rel}: geometry is finite`, H.nonFiniteVertices(sb), 0);
}

/* ========================================================================= */
G("fin sets out of order");
{
  const src = `CASEID out of order
DIM IN
 $FLTCON NALPHA=2.,ALPHA=0.,4.,NMACH=1.,MACH=2.,REN=3.E6,$
 $AXIBOD LNOSE=10.,DNOSE=4.,LCENTR=30.,DCENTR=4.,$
 $FINSET1 XLE=30.,NPANEL=4.,SWEEP=0.,STA=1.,SSPAN=2.,5.,CHORD=4.,2.,$
 $FINSET2 XLE=15.,NPANEL=4.,SWEEP=0.,STA=1.,SSPAN=2.,5.,CHORD=4.,2.,$
NEXT CASE
`;
  const m11 = H.allMessages(H.messages(H.load(), src, "3/11", "ooo.dat"));
  const m97 = H.allMessages(H.messages(H.load(), src, "5/97", "ooo.dat"));
  says("5/97 calls it an input error", m97, /input error rather than a preference/);
  says("3/11 states the lost vortex tracking", m11, /Vortices are only tracked from a set to higher-numbered sets/);
  silent("3/11 does not call it an input error", m11, /input error rather than a preference/);
}

/* ========================================================================= */
G("DELETE purges what SAVE carried in");
{
  // Manual: "All previously saved namelists with the names specified will be
  // purged ... Any new inputs of the same namelist will be retained."
  const src = `CASEID one
DIM IN
 $FLTCON NALPHA=2.,ALPHA=0.,4.,NMACH=1.,MACH=2.,REN=3.E6,$
 $AXIBOD LNOSE=10.,DNOSE=4.,LCENTR=30.,DCENTR=4.,DEXIT=1.,$
SAVE
NEXT CASE
CASEID two — DELETE then respecify
DELETE AXIBOD
 $AXIBOD LNOSE=8.,DNOSE=3.,LCENTR=20.,DCENTR=3.,$
SAVE
NEXT CASE
CASEID three — DELETE with nothing to replace it
DELETE AXIBOD
NEXT CASE
`;
  const sb = H.load();
  sb.__deck = src;
  sb.$('loadText(__deck, "del.dat")');
  eq("the replacement's own values are kept", sb.$('num(CASES[1].nl.AXIBOD, "LNOSE", NaN)'), 8);
  eq("inherited values do not show through", sb.$('num(CASES[1].nl.AXIBOD, "DEXIT", -1)'), -1);
  eq("a bare DELETE removes the namelist", sb.$("CASES[2].nl.AXIBOD === undefined"), true);
}

/* ========================================================================= */
G("cases tab: limits follow the release");
{
  const sb = H.load();
  for (const [rel, want] of [["3/11", false], ["5/97", true]]) {
    H.builder(sb, rel);
    sb.$('Object.assign(CB.vars.find(v => v.key === "alpha"), { enabled: true, mode: "range", a: 0, b: 39, step: 1 });');
    const r = H.generate(sb);
    check(`${rel}: 40 ALPHA values ${want ? "rejected" : "accepted"}`,
      r.errors.some(e => /exceeds the ALPHA limit/.test(e)) === want,
      r.errors.join(" | "));
  }
  for (const [rel, want] of [["3/11", 9], ["5/97", 4]]) {
    H.builder(sb, rel);
    for (let i = 0; i < 12; i++) sb.$("cbAddFinSet();");
    eq(`${rel}: add fin set stops at ${want}`, sb.$("CB.vars.filter(v => v.defl).length"), want);
  }
}

/* ========================================================================= */
G("cases tab: release-dependent warnings");
{
  const sb = H.load();
  for (const [rel, fatal] of [["3/11", true], ["5/97", false]]) {
    H.builder(sb, rel);
    sb.$('CB.vars.find(v => v.key === "beta").enabled = true; CB.vars.find(v => v.key === "phi").enabled = true;');
    const r = H.generate(sb);
    check(`${rel}: BETA with PHI ${fatal ? "blocks" : "warns"}`,
      r.errors.some(e => /both BETA and PHI/.test(e)) === fatal &&
      r.warnings.some(w => /Both BETA and PHI/.test(w)) === !fatal);
    check(`${rel}: generation ${fatal ? "refused" : "proceeds"}`,
      /Cannot generate/.test(r.out) === fatal);
  }
  for (const [rel, warns] of [["3/11", true], ["5/97", false]]) {
    H.builder(sb, rel);
    sb.$('CB.vars.find(v => v.key === "phi").enabled = true; CB.damp = true;');
    const r = H.generate(sb);
    check(`${rel}: DAMP at non-zero PHI ${warns ? "warns" : "stays silent"}`,
      r.warnings.some(w => /damping derivatives are not computed/.test(w)) === warns);
  }
  // and stays quiet when the roll sweep is all zeros
  H.builder(sb, "3/11");
  sb.$('Object.assign(CB.vars.find(v => v.key === "phi"), { enabled: true, mode: "list", list: "0" }); CB.damp = true;');
  check("3/11: DAMP at PHI=0 stays silent",
    !H.generate(sb).warnings.some(w => /damping derivatives are not computed/.test(w)));
}

/* ========================================================================= */
G("cases tab: output cards follow the release");
{
  const sb = H.load();
  for (const rel of ["3/11", "5/97"]) {
    H.builder(sb, rel);
    sb.$('CB.write = true; CB.fin43 = true; CB.vars.find(v => v.key === "phi").enabled = true;');
    const r = H.generate(sb);
    const cases = (r.out.match(/^CASEID /gm) || []).length;
    const synths = (r.out.match(/^PRINT AERO SYNTHS$/gm) || []).length;
    const writes = (r.out.match(/^(WRITE |FORMAT )/gm) || []).length;
    if (rel === "3/11") {
      eq("3/11: PRINT AERO SYNTHS in every case", synths, cases);
      eq("3/11: no WRITE or FORMAT cards", writes, 0);
      check("3/11: header explains for042.csv", /for042\.csv is written automatically/.test(r.out));
      check("3/11: and warns it carries no deflection", /no deflection column/.test(r.out));
    } else {
      eq("5/97: no PRINT AERO SYNTHS", synths, 0);
      // nothing fills the dynamic block without DAMP, so it is not written
      eq("5/97: FORMAT plus three WRITE cards without DAMP", writes, 4);
      check("5/97: and says why the dynamic block is missing",
        r.warnings.some(w => /WRITE is on but DAMP is not/.test(w)));
      sb.$("CB.damp = true;");
      const d = H.generate(sb);
      eq("5/97: DAMP adds the dynamic block",
        (d.out.match(/^(WRITE |FORMAT )/gm) || []).length, 5);
      check("5/97: no for042 note", !/for042\.csv/.test(r.out));
    }
  }
}

/* ========================================================================= */
G("cases tab: the product is bounded");
{
  const sb = H.load();
  H.builder(sb, "3/11");
  sb.$("for (let i = 0; i < 8; i++) cbAddFinSet();");
  sb.$("CB.vars.filter(v => v.defl).forEach(v => v.enabled = true);");
  const t0 = Date.now();
  const r = H.generate(sb);
  const ms = Date.now() - t0;
  check("nine fin sets is refused, not attempted",
    r.errors.some(e => /1953125 cases is more than this will generate/.test(e)),
    r.errors.join(" | "));
  check(`and refused promptly (${ms}ms)`, ms < 5000);
  check("the refusal shows what is multiplying out",
    r.errors.some(e => /DELTA1×5 · DELTA2×5/.test(e)));
}

/* ========================================================================= */
G("cases tab: a deck may seed more sets than the release has");
{
  const sb = H.load();
  H.builder(sb, "5/97", deck("releases.dat"), "releases.dat");
  eq("all nine rows are seeded from the deck", sb.$("CB.vars.filter(v => v.defl).length"), 9);
  sb.$('CB.vars.filter(v => v.defl && +v.name.slice(5) > 4).forEach(v => v.enabled = true);');
  const r = H.generate(sb);
  check("enabling one past the limit is an error",
    r.errors.some(e => /Rev 5\/97 has only 4 fin sets, so DELTA5 does not exist/.test(e)),
    r.errors.join(" | "));
}

/* ========================================================================= */
if (REF) {
  const samples = path.join(REF, "samples");

  G("reference decks parse and draw (DATCOMVIZ_REFERENCE)");
  for (const name of ["for005.dat", "for005-allparts.dat", "ASW-20.dcm", "allparts.dcm"]) {
    const file = path.join(samples, name);
    if (!fs.existsSync(file)) { check(`${name} present`, false, `not at ${file}`); continue; }
    const src = fs.readFileSync(file, "utf8");
    for (const rel of ["3/11", "5/97"]) {
      const sb = H.load();
      const cases = H.messages(sb, src, rel, name);
      check(`${name} @ ${rel}: parses`, cases.length > 0);
      eq(`${name} @ ${rel}: geometry is finite`, H.nonFiniteVertices(sb), 0);
    }
  }

  /* The strongest regression available: an 8-part sweep this tool generated
     against a real vehicle, kept out of this repo. The source deck is
     reconstructed from the emitted part 1 — the geometry it embedded is
     verbatim between the CASEID line and the first swept $FLTCON. */
  G("real sweep regenerates byte-for-byte (DATCOMVIZ_REFERENCE)");
  {
    const full = path.join(samples, "fullData");
    const parts = Array.from({ length: 8 }, (_, i) => path.join(full, `for005-${i + 1}.dat`));
    if (!parts.every(p => fs.existsSync(p))) {
      check("shipped sweep present", false, `expected for005-1..8.dat in ${full}`);
    } else {
      const p1 = fs.readFileSync(parts[0], "utf8").split("\n");
      const start = p1.findIndex(l => /^CASEID 1\//.test(l)) + 1;
      // stop where the generator's own output begins, or the embedded geometry
      // would come back carrying a copy of the WRITE block it is about to emit
      const end = p1.findIndex((l, i) => i > start &&
        (/^\*\s+WRITE blocks below assume/.test(l) || /^\s*\$FLTCON/.test(l)));
      const source = ["CASEID reconstructed source deck", ...p1.slice(start, end),
                      " $FLTCON NALPHA=2.,ALPHA=0.,4.,NMACH=1.,MACH=0.5,ALT=0.,$",
                      "SAVE", "NEXT CASE", ""].join("\n");

      const sb = H.load();
      H.builder(sb, "5/97", source, "for005.dat");
      sb.__cfg = {
        alpha: { enabled: true, mode: "range", a: 0, b: 20, step: 2 },
        mach:  { enabled: true, mode: "range", a: 0.1, b: 0.5, step: 0.1 },
        alt:   { enabled: true, mode: "list", list: "0" },
        ren:   { enabled: false }, beta: { enabled: false },
        phi:   { enabled: true, mode: "range", a: 0, b: 360, step: 22.5 },
        d1:    { enabled: true, mode: "list", list: "0" },
        d2:    { enabled: true, mode: "range", a: -10, b: 10, step: 5 },
        d3:    { enabled: true, mode: "range", a: -10, b: 10, step: 5 },
        d4:    { enabled: true, mode: "range", a: -10, b: 10, step: 5 },
      };
      sb.$(`Object.keys(__cfg).forEach(k => {
              const v = CB.vars.find(x => x.key === k); if (v) Object.assign(v, __cfg[k]); });
            CB.repeat = false; CB.split = true; CB.embed = true; CB.damp = true;
            CB.plot = false; CB.write = true; CB.fin43 = false;`);
      const r = H.generate(sb);
      eq("splits into eight parts", r.files.length, 8);
      eq("with the same case counts",
        r.files.map(f => f.cases).join(","), "289,289,289,288,289,289,288,104");
      let same = 0;
      for (let i = 0; i < 8; i++)
        if (sb.$(`CB_FILES[${i}].text`) === fs.readFileSync(parts[i], "utf8")) same++;
      eq("all eight byte-identical to the shipped files", same, 8);
    }
  }
} else {
  results.push({ note: "reference groups skipped — set DATCOMVIZ_REFERENCE to run them" });
}

/* ---- report -------------------------------------------------------------- */
for (const r of results) {
  if (r.group) console.log(`\n  ${r.group}`);
  else if (r.note) console.log(`\n  ${r.note}`);
  else if (r.ok) console.log(`    ok   ${r.name}`);
  else {
    console.log(`    FAIL ${r.name}`);
    if (r.detail) console.log(String(r.detail).split("\n").map(l => "         " + l).join("\n"));
  }
}
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
