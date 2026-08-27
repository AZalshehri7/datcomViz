# Tests

```
node test/run.js
```

No dependencies, no build step, no test framework — Node is the only requirement.
Exit code 0 if everything passed. 

The reference material lives outside this repo, and two groups need it. Point at a
checkout to run them as well:

```
DATCOMVIZ_REFERENCE=../datcomViz-reference node test/run.js
```

Without it those groups are skipped and the run says so.

## How it works

`harness.js` pulls the inline `<script>` out of `index.html`, runs it in a `vm` context
against a stub DOM, and returns the context plus `$`, which evaluates an expression
inside it. So the tests drive **the shipped code** — the real parser, the real geometry
checks, the real case builder — not a copy of them.

Two things are replaced, because there is no GL in Node: `THREE.WebGLRenderer` and
`THREE.OrbitControls`. Everything else is what the browser runs.

One wrinkle worth knowing: top-level `const` and `let` in a `vm` script are lexical
bindings rather than properties of the context object, so `sb.REL` is `undefined` while
`sb.$("REL")` works. Reach into the app through `$`.

`harness.js` also exports the helpers the suite is written in — `messages`, `builder`,
`generate`, `banner`, `nonFiniteVertices`, and for the export tests `parseStl`,
`windingErrors` and `edgeCensus`, which read a written file back rather than trusting the
writer that produced it.

One thing the stub gets right that is easy to get wrong: elements are seeded with the
`value` and `checked` their HTML declares. Without that every input reads back `""`, which
silently made the deflection scale 0 and everything downstream of it untestable.

## What is covered

| Group | What it pins down |
|---|---|
| release model | the `RELEASES` table, `relSet` persistence, which toolbar ticks each release shows |
| a clean deck stays clean | `decks/minimal.dat` reports nothing under either release — the noise floor |
| geometry checks follow the release | every release-gated message, in both directions, on `decks/releases.dat` |
| fin sets out of order | 5/97 calls it an input error; 3/11 reports the lost vortex tracking |
| `DELETE` purges what `SAVE` carried in | delete-then-respecify keeps only the new inputs |
| cases tab | `ALPHA` and fin-set limits, `BETA`+`PHI`, the `DAMP` roll restriction, which output cards are emitted |
| the product is bounded | nine fin sets is refused rather than attempted |
| mesh export | STL binary/ASCII and OBJ agree; binary STL re-read per the spec; winding, bounding box, OBJ indices, filename |
| exported components are closed solids | every part is edge-manifold, so a downstream boolean union is well posed |
| per-panel deflection override | overrides move the panels they name and no others, and clear on deck load |
| deflection scale is a viewing aid only | the slider changes the drawing but never the exported file |
| *reference decks* | the four sample decks parse and draw finite geometry under both releases |
| *real sweep* | an 8-part 2125-case sweep regenerates byte-for-byte against files this tool produced earlier |

The last two are the `DATCOMVIZ_REFERENCE` groups. The sweep one is the strongest
regression available: it reconstructs the source deck from the emitted part 1, re-runs
the same sweep, and demands the eight files come back identical byte for byte. Any
change that alters generated output for a Rev 5/97 target fails it.

## Decks

`decks/minimal.dat` is a small well-formed deck that should stay silent. If a change
makes it report something, that message is firing too eagerly.

`decks/releases.dat` is the opposite: five cases, each isolating one difference between
Rev 5/97 and Rev 3/11, each resetting what the case before it broke so faults do not
carry forward through `SAVE`. It is also worth loading in the browser and flipping the
target release to see the Messages panel change. The airframe is deliberately absurd —
nine fin sets, a cambered body, two co-located tails — so every check has something to
fire on.

| Case | Under `3/11` | Under `5/97` |
|---|---|---|
| 1 | clean, apart from the `DELTA5` hinge note and the co-located sets 3/4 note | `FINSET5`–`9`, every `NVOR`, `DELTA5` and `PHIPRO` reported as not existing |
| 2 | `NVOR=25` out of range; `NVOR` on the aftmost set has nothing to shed into | `NVOR` does not exist at all |
| 3 | cambered body (`Z`) at `PHI=45`, which the manual forbids | the `Z` array arrived in 1/06 |
| 4 | `ASYM` was deleted in 8/08 and will be rejected | `NINCR` arrived in 3/11 |
| 5 | `BETA` with `PHI` is fatal and stops the run | `BETA` is silently ignored when `PHI` is non-zero |

## Adding a test

`run.js` has a runner about fifteen lines long at the top: `G` opens a group, `check`,
`eq`, `says` and `silent` assert. `says`/`silent` take the message list and a regexp,
and print the messages that were there when they fail, which is usually enough to see
what happened without a debugger.
