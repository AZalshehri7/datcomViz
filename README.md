# datcomViz

A browser-based **geometry viewer** for DATCOM input decks.

**<https://datcom.aero-dev.com>**

Open `index.html` in a browser — that's it. No build step, no server, no network. The
page loads `vendor/three.min.js` from disk, so it works offline and nothing you drop on it
ever leaves the machine. Case-builder settings are kept in the browser's local storage;
your deck is not.

> **This fork adds CFD setup.** On top of the viewer and case builder, this
> branch adds two optional tabs — **CFD (HISA)** and **Domain** — that turn the
> exported geometry into an OpenFOAM/HISA high-speed CFD case and the meshing
> domain around it, written out as a bash script and an STL you copy or save.
> The viewer, geometry checks and DATCOM case builder are untouched; the new
> tabs are additive and generate text and mesh only — they run nothing. See
> [CFD setup](#cfd-setup).

## What it does

Drop a `for005.dat`, `.dcm`, `.inp` or `.txt` input deck on the sidebar (or click to
browse). The tool parses the Fortran namelists, works out which input form the deck
uses, and draws the configuration in 3D. A **Target release** picker below the deck says
which Missile Datcom build to check it against — Rev 3/11 or Rev 5/97; see
[Which DATCOM this targets](#which-datcom-this-targets).

It is **view-only**. It does not run DATCOM, read `for006.dat` output, plot coefficients,
or write anything.

### Viewing

- Orbit with drag, zoom with the wheel, pan with right-drag.
- View presets: Iso / Side / Top / Front / Rear / Fit.
- Display modes: Solid, Solid + edges, Wireframe, X-ray.
- Toggle individual components, body axes, ground grid, centreline, CG marker, body
  station rings and fin hinge lines.
- Scale control-surface deflections from 0–100 % for visualisation, and pick which entry
  of a multi-value `NDELTA` schedule to draw.
- **Derived geometry** panel reports span, exposed area, aspect ratio, taper ratio, MAC,
  LE/TE sweep, fineness ratio and so on, computed from the parsed deck.
- **Parsed namelists** panel dumps exactly what the parser understood — useful when a
  deck does not draw the way you expected.
- Save PNG writes the current view to a file.
- **Export** the drawn configuration as STL or OBJ, at deflections you set per panel.
  See [Exporting the geometry](#exporting-the-geometry).

## Which DATCOM this targets

Two releases, chosen with the **Target release** picker under *Input deck*:

| | Manual | Release |
|---|---|---|
| **Rev 3/11** (default) | AFRL-RB-WP-TR-2011-3071, the **2011 revision** | Rev 12, March 2011 |
| **Rev 5/97** | AFRL-VA-WP-TR-1998-3009, the **1997 manual** | Rev 7, May 1997 |

`BODY`/`SYNTHS` decks are read against the Digital DATCOM input namelist reference and
are unaffected by the picker.

Which release you target decides the array limits the checks enforce and which inputs are
reported as not existing. **It does not change the drawing** — Figures 1, 6, 8, 9 and 10
of the 1997 manual are Figures 1, 7, 9, 10 and 11 of the 2011 one, unchanged, as is the
sign note under `DEFLCT`. Switching re-checks the loaded deck in place; the choice is
kept in this browser.

|  | Rev 5/97 | Rev 3/11 |
|---|---|---|
| `ALPHA` per case | 20 | **100** (raised in 7/07) |
| `MACH`/`ALT`/`REN`/`VINF`/`TINF`/`PINF` | 20 | 20 |
| Fin sets | 4, "non-overlapping", *must* be numbered front to back | **9** (8/08); order *should* be front to back, and governs vortex tracking rather than validity |
| Co-located fin sets | an input error | permitted — it is how a horizontal and a vertical tail of differing planform share a station |
| `$DEFLCT` | `DELTA1`–`4` | `DELTA1`–`9`; `XHINGE` and `SKEW` stay array size **4** |
| `NVOR` | — | 3/11, 1–20 shed vortices per fin, default 1 |
| Body `Z` camber | — | 1/06; must be run at `PHI` = 0 |
| Conic centrebody | not handled | 1/06 |
| `$PROTUB PHIPRO` | — | 8/08, one angle per protuberance |
| `$TRIM NINCR` | — | 3/11, default 10; δ = 0 is always run when the bounds span it |
| `$TRIM ASYM` | present | **deleted in 8/08** |
| `$TRIM` bounds | both `DELMIN` and `DELMAX` required | either may be omitted; the other defaults to 0 |
| `BETA` | tan⁻¹(v/u) | **sin⁻¹(v/V₀)** (8/08) |
| `BETA` with `PHI` | `BETA` silently ignored | **fatal — the run stops** (7/07) |
| `DAMP` at non-zero `PHI`/`BETA` | no restriction stated | damping derivatives not computed |
| Machine-readable results | `for004.dat` via `WRITE`/`FORMAT` | `for042.csv`, always written, with headers |
| 300-namelist limit under `SAVE` | yes | **yes, unchanged** |

A deck aimed at the other release is not wrong, only aimed elsewhere, so each message
that depends on the setting says which release the feature arrived in and offers the
switch.

## Geometry checks

The Messages panel reports problems the solver itself will not. Of `SSPAN(1)` the manual
states: *"It is the user's responsibility to assure that the fins are (1) on the body
surface, and (2) do not lie internal to the body mold line. The program does not check for
these peculiarities."* A fin left floating off the body, or buried inside it, runs without
complaint and quietly returns the wrong answer. For `AXIBOD`/`FINSET` decks the viewer
checks:

- a fin root that sits inside the body, or stands off it, against the body radius at the
  root mid-chord — the same station the code uses when `SSPAN(1)=0` seats a fin for you;
- a root chord running past the base, or ahead of the nose;
- a root chord over a tapering section, where it cannot lie flush along its whole length;
- on an elliptical section the mould line varies with roll, so each panel is measured
  against the radius at its own `PHIF` (plus `GAM`) rather than the semi-width, and
  `SSPAN(1)=0` seats each panel individually;
- fin sets out of front-to-back order, or with no positive longitudinal gap, either of
  which silently stops fin-shed vortices being tracked between them. Under 5/97 that is
  an input error outright; 3/11 drops the "non-overlapping" wording and reports only the
  lost coupling, since co-locating two sets is how a horizontal and a vertical tail of
  differing planform are put at the same station;
- a cambered body (`Z`) run at non-zero `PHI`, which the 2011 manual forbids;
- `NVOR` outside 1–20, or set on the aftmost fin set where it has nothing downstream to
  shed into;
- an all-moveable panel on fin set 5 or beyond, where `XHINGE` and `SKEW` — still array
  size 4 while `DELTAn` reaches 9 — cannot specify the hinge line;
- `BETA` and `PHI` in the same case: silently ignored under 5/97, fatal from 7/07 onward.

It also checks the rules the manual states outright but the code will not enforce for
you: that `PHIPRO` supplies an angle for every protuberance, that the member arrays cover
every member (`LUG` counts as four and `SHOE` as three), that `XPROT` and `XINLT` fall on
the body, that an inlet is boattailed — `H(5)*W(5) < H(4)*W(4)`, or `W(5) < W(4)`
axisymmetric — and that `MFR` is supplied once per Mach number and lies in `0 < MFR < 1`.

Reference quantities are reported as a **note** rather than a defect: `SREF` and `LREF`
are compared against the body maximum cross-section and diameter, which is what the code
falls back on when they are omitted. Differing from them is often deliberate.

These are reported separately from parser notes, and a clean deck says so.

## Overlaying `for009.dat`

With `PRINT GEOM BODY` or `PART`, DATCOM writes the body contour it generated for itself
to tape 9 as `(X, R, Z)`, interpolating many points between your input stations. **Overlay
for009 contour** draws it over the reconstruction and reports the maximum and RMS radial
deviation between the two, flagging anything past 2 % of the maximum radius.

This is the only way to see what the code actually built from an option 1 shape or a
`DISCON` list, rather than what the deck appears to say. It is also a check on this
viewer: against a contour generated from the exact tangent-ogive relation, the drawn body
agrees to 0.04 % of the body radius.

## Exporting the geometry

The **Export geometry** panel writes the drawn configuration out as a mesh. It is the
same triangles either way; the formats differ only in what they can carry:

| Format | Use it when |
|---|---|
| **STL — binary** | The default. Compact, universally read. One anonymous shell. |
| **STL — ASCII** | You want to read or diff the file by eye. Around six times larger. |
| **OBJ** | You want the components to survive. Each one stays a named object — `Body_AXIBOD`, `Fin_set_1_4_panels_HEX`, `Protuberances_2_sets` — so they arrive separable rather than as one blob. |

Axes are DATCOM's own: **+X aft, +Y starboard, +Z up**. *Only the components ticked
above* respects the Components panel, so you can export the body alone, or the fins
without the protuberances.

### Deflections

The panel lists every fin set with one box per panel, pre-filled with the deck's own
`DELTAn`. Change them and the drawing follows immediately, so what you see is what gets
written — and you can export the same airframe at several control settings without
touching the deck. **Back to the deck** drops the overrides.

The angles you type are exported at **full scale**. The Deflection slider in the Display
panel is a viewing aid and never reaches the file; the exporter draws at 100 % for the
harvest and puts your view back afterwards.

Overrides belong to the deck and case they were set on, so loading a deck or switching
case clears them.

### What you are getting

Facet normals follow right-hand winding throughout, and zero-area triangles — the
collapsed ring at a nose apex, or at a zero tip chord — are dropped rather than written.

**Most components come out as closed solids, but they are not fused to each other.** A
fin sits *on* the body, not joined to it, so surfaces interpenetrate and the model as a
whole is not watertight. A boolean union in CAD or a mesher is well posed, because the
parts going into it are closed. Three things are not closed on their own and are worth
knowing about before you union:

- **mirrored lifting surfaces** (`WGPLNF`, `HTPLNF` and friends on `BODY`/`SYNTHS` decks)
  share the centreline edge loop between the two halves, so those edges carry four faces;
- **jet nacelles** are uncapped tubes;
- stacked **`LUG`/`SHOE` protuberance members** overlap each other.

Neither STL nor OBJ records units. The deck's `DIM` goes into the filename
(`for005-case2-in.stl`), the STL solid name and an OBJ comment, but a receiving tool will
still guess — check the scale on import.

### Why not STEP

STEP splits into two jobs and neither is worth doing here. *Faceted* STEP wraps these same
triangles as planar-faced B-rep: it opens in CAD, but at roughly eight entities a triangle
a 10,000-triangle model becomes an 80,000-entity file that is slower, larger and less
editable than the STL. *Analytic* STEP — body as a surface of revolution, fins as lofts
between airfoil sections — is what people actually want, and it is genuinely a different
program: a second geometry pipeline built from the parsed deck rather than from the
display mesh, plus watertight consistently-oriented topology. Worth doing one day; not a
variation on this.

## CFD setup

Two tabs sit on top of the STL exporter and reproduce, in the browser, the
setup you would otherwise assemble by hand for the CSIR **HiSA** solver
(a density-based compressible solver for OpenFOAM) together with a **cfMesh**
domain around the airframe. Like the rest of the tool they write **text and a
mesh only** — nothing runs here, and nothing leaves the machine. The generated
script sets a case up on your own OpenFOAM machine when you run it.

Axes are DATCOM's own throughout — **+X aft, +Y starboard, +Z up** — the same
as the export, so the freestream at zero incidence runs `+X` and the `inlet`
sits at `−X`, the `outlet` (wake) at `+X`.

### CFD (HISA) tab

Collects the HiSA case and cfMesh prompts as a form and emits a self-contained
`setup_<case>.sh` you **Copy** or **Save**; run it on an OpenFOAM machine and it
lays the case down.

- **Freestream from flight conditions.** Enter Mach / altitude / α / β and the
  velocity `U`, pressure `p∞` and temperature `T∞` are derived from the 1976
  **ISA standard atmosphere** (piecewise to 86 km, Sutherland viscosity), with
  `U` in DATCOM axes: `U = (V·cosα·cosβ, −V·sinβ, V·sinα·cosβ)`. A manual mode
  takes `U`, `p`, `T` directly. **Pull from deck** reads Mach / α / β / altitude
  from the loaded deck's `$FLTCON` and the units from `DIM`.
- **Generated case.** `0/` (`U`, `p`, `T`, the turbulence fields, and a shared
  `0/include/freestreamConditions`), `constant/` (`thermophysicalProperties`,
  `turbulenceProperties`), `system/` (`controlDict`, `fvSchemes`, `fvSolution`,
  `decomposeParDict`, `meshDict`), plus self-locating `makeDomain.sh`,
  `mesh.sh` and `run.sh` (serial or `mpirun`).
- **Turbulence.** Spalart–Allmaras or k-ω SST; low- or high-y⁺ wall-function
  sets; `k`/`ω` seeded from turbulence intensity and length scale.
- **Force coefficients in DATCOM body axes.** `dragDir (1 0 0)` → axial **CA**,
  `liftDir (0 0 1)` → normal **CN**, `pitchAxis (0 1 0)` → **CM** (nose-up
  positive), with a **CofR** field for the moment reference. Optional
  post-processing objects (`yPlus`, `Cp`, `MachNo`, `Q`, `vorticity`,
  `wallShearStress`, residuals).
- **Per-patch mesh refinement.** A **Refine patch** dropdown lists every patch;
  each carries its own refinement level and thickness, emitted as one
  `localRefinement` and one boundary-layer block per patch.
- **Advanced numerics.** The `fvSchemes` and `fvSolution` knobs documented in
  the HiSA User Guide are exposed and defaulted to its recommended values —
  flux and real-time schemes, turbulence divergence, GMRES and the pseudo-time
  (SER) controls, relaxation.

Boundary-condition, scheme and solver defaults follow a verified HiSA reference
case and the HiSA User Guide (`boundaryCorrectedFixedValue` walls, `symmetry`
patches, `bounded Gauss upwind` turbulence advection, the Poisson wall-distance
`yPsi` solver, and so on).

### Domain tab

Builds the meshing domain around the exported geometry — the step you would
otherwise do in CAD.

- **Farfield box** around the geometry bounding box with asymmetric margins —
  upstream `−X`, downstream `+X` (wake), `±Y`, ground `−Z`, top `+Z` — set
  **relative** to the bbox or in **absolute** deck units, with an optional
  ground-snap.
- **Named patches.** The six faces route to `inlet` / `outlet` / `side_yMin` /
  `side_yMax` / `ground` / `top`; any face left unticked merges into a single
  `farfield`. Each geometry component keeps its own patch (`Body_AXIBOD`,
  `Fin_set_1_…`, `Protuberances_…`), so the airframe arrives already
  subdivided.
- **Symmetry plane.** Optional clip about X/Y/Z at the bbox centre, the origin
  or a custom value; the cut face becomes a `symmetry` patch and geometry the
  far side of it is dropped.
- **Output.** A combined multi-solid **ASCII STL** (`cfd_domain.stl`) whose
  `solid` names are the cfMesh/snappyHexMesh patches, scaled to metres.
- **3D preview.** The domain is drawn in the Geometry view — translucent,
  colour-coded faces (inlet, outlet, farfield, symmetry, walls) plus a
  wireframe outline. **View in 3D** switches to the Geometry tab and fits the
  camera to the box; a toggle turns it off. It is display-only and never
  exported.
- **Use in CFD tab** hands the domain to the CFD tab — `surfaceFile`, the
  wall-patch list, the farfield selector, the symmetry patch and the per-patch
  refinement dropdown are all filled in.

### Typical workflow

1. Load a deck and set deflections, then **Export** the geometry as **ASCII
   STL** (named solids need ASCII).
2. **Domain** tab → set margins → **View in 3D** to check the box around the
   airframe → **Save** `cfd_domain.stl` and **Use in CFD tab**.
3. **CFD (HISA)** tab → **Pull from deck** or type Mach / altitude / α / β →
   dial per-patch refinement → **Save** `setup_<case>.sh`.
4. On an OpenFOAM + cfMesh + HiSA machine, put the STL under
   `constant/triSurface/`, run the case's `mesh.sh` then `run.sh` — the script
   prints the exact next steps.

### Notes and limits

- Everything is generated client-side; the tool runs neither DATCOM nor
  OpenFOAM.
- `inlet`/`outlet` use reflectionless characteristic-farfield conditions, which
  suit an external-flow box; a driven internal duct would need the manual's
  `characteristicVelocityInletOutput*` / `characteristicPressureInletOutput*`
  conditions, which are not generated.
- Neither STL records units, so the domain is scaled to metres on write and the
  case is set up in SI; check the scale if you feed it a differently-scaled
  surface.
- HiSA is the CSIR High Speed Aerodynamic solver; see its User Guide for the
  solver settings the generated dictionaries follow.

## Case builder

The **Cases** tab turns a set of sweeps into DATCOM case text. Pick the variables you
want, give each a list or a start/stop/step, and it emits the `NEXT CASE` chain to paste
under an existing deck. It generates text only — it does not run anything.

What matters is that sweeping a variable does not cost the same everywhere. In an
`AXIBOD`/`FINSET` deck `ALPHA` is an array of up to 20 and `MACH` up to 20, so a whole
alpha-Mach matrix runs inside a single case; but `BETA`, `PHI` and the `DEFLCT`
deflections are scalars, so each value of those starts a new case. The builder splits the
variables into those two groups on screen and multiplies out the second group for you.

Fin deflections are entered as a **per-panel sign pattern times a swept magnitude**, which
is how these decks are normally written — a pattern of `+1,-1,-1,+1` with a magnitude
sweep of -10 to +10 gives `DELTA1=-10.,10.,10.,-10.` and so on. Start with one fin set of
one panel and add sets and panels as the configuration needs them; a loaded deck fills in
its own fin sets and their real `NPANEL` counts automatically.

By default every case restates all of the swept namelists, so each case stands on its own
and a mis-ordered `SAVE` cannot silently carry a stale deflection forward. Only the
geometry is inherited. Untick *Repeat every variable in each case* to emit just what
changed between consecutive cases, which produces a much shorter file.

Tick **DAMP in every case** to compute dynamic derivatives. The card has to be repeated
per case — the manual is explicit that it "is effective only for the case in which it
appears" — so ticking it emits `DAMP` in each one rather than only at the top. It is a
control card, not a namelist, so it does not count against the 300.

The 2011 manual states outright, under the `DAMP` control card, that **damping
derivatives are not computed when `PHI` or `BETA` is non-zero** — which guts a roll sweep.
The 5/97 `DAMP` paragraph carries no such sentence, and a 5/97-vintage build run at
`PHI=45` with zero deflections does return `CMQ`. So the warning is raised under **3/11
only**; under 5/97 the builder stays silent. If the two disagree for the build you
actually run, the target release picker is how you say so.

### Sweeps that exceed the 300-namelist limit

Once `SAVE` is in effect a run may read at most 300 namelists, and the geometry case ahead
of the sweep counts toward that. Rather than telling you to cut the sweep down, the builder
divides it into as many files as it takes, so **every case still gets run**.

Each file is a complete, independent run: its first case restates every swept variable in
full, even in compact mode, so nothing depends on a preceding file, and every case is
closed with `NEXT CASE` — that card is what makes a case execute, so the last one in a
file needs it as much as the rest. Paste each one under
the same geometry deck and run them separately. The header of each says which part it is
and which cases it holds, files are named `datcom-cases-2of5.dat`, and a part picker plus
**Download all parts** sit in the toolbar.

Tick **Include geometry (ready to run)** and the loaded deck's geometry is folded into the
**first case** of every file, so each file is a complete deck you can run directly rather
than a fragment to paste. It is merged into that case rather than placed ahead of it as a
case of its own, because a standalone geometry case executes too and returns a second set
of results at whatever angles of attack the deck happened to carry — which shows up as
duplicated alpha when the output is read back. The deck's own `CASEID` and `$FLTCON` are
dropped, since the sweep supplies both; everything else survives verbatim, including
comments, the `DIM` card and control cards.

Tick **PLOT (for003.dat)** to add the `PLOT` card, which makes DATCOM write total force
and moment data — `ALPHA, CN, CM, CA, CY, CLN, CLL, DELTA` — to `for003.dat` as a
fixed-format table, one zone per case. Far easier to read into MATLAB than the printed
listing. `PLOT` applies to a whole run, so it is written once per file rather than per
case. Under 3/11 the same card also writes `for020.dat` and `for021.dat`.

The remaining output tick depends on the target release, since the two builds write
different files. Under **5/97** it is **WRITE tables (for004.dat)**; under **3/11** it is
**Fin tables (for043.csv)**, which adds `PRINT AERO SYNTHS`. `PRINT AERO` is a per-case
card in the same way `DAMP` is — the manual: the `PRINT AERO` cards "are effective only
for the case in which they appear" — so it is repeated in every case rather than written
once per file. Like `DAMP` it is a control card, so it costs nothing against the 300. See
[Getting results out](#getting-results-out).

The *reserve for geometry* box is how many namelists the geometry case ahead of the sweep
uses; that many are held back from the 300. It is **counted from the loaded deck** rather
than guessed, and goes read-only once the geometry is embedded, since it is then known
exactly.

Cases are packed by what they actually cost. In compact mode a case writes only what
changed since the one before it, so more of them fit and you get fewer files — an 861-case
sweep needs six files fully restated and four compact. The first case of every file is
always written out in full, so no file depends on another whichever mode you use. Untick
**Split over the 300 limit** to get a single file regardless, and a warning instead.

Loading a deck does not disturb a sweep you have already set up — only the reserve is
refreshed, since that is a property of the deck rather than a choice you made.

There is a ceiling of 50,000 cases, which is about 170 files. Nine fin sets at five
deflections each is nearly two million, and that is a few clicks away under a 3/11
target, so the builder reports the count and what is multiplying out instead of trying
to generate it.

Your builder setup is kept in this browser's local storage, so a sweep survives a reload;
**Reset** clears it. The deck itself is never stored. Loading a deck re-seeds the builder
from it.

It also guards the α/β combinations that come back as NaN. DATCOM resolves aerodynamic
roll from `tan φ = tan β / tan α`, so **α = 0 with non-zero β is a division by zero**, and
**negative α with non-zero β** cannot be recovered by a single arctangent because total
angle of attack is always positive. Both are flagged, with the suggestion to run those
points as `ALPHA` = total angle of attack together with `PHI` — see *Sweeping angle of
attack and sideslip* below. It refuses a schedule containing duplicate `ALPHA` values,
which DATCOM will not run, and reports how many runs a zero-incidence point repeats across
a `PHI` sweep.

It enforces the rules the manual states: `NALPHA` must be greater than 1, the array size
limits per variable, `ALSCHD` must be ascending, `REN`/`ALT` pair one-to-one with `MACH`
(a single value is broadcast), and with `SAVE` in effect a run reads at most 300
namelists. Enabling both `BETA` and `PHI` is allowed but noted, since the code ignores
`BETA` whenever `PHI` is non-zero.

## Getting results out

The printed listing is awkward to read back into MATLAB or Simulink. DATCOM will write
machine-readable files instead, and the Cases tab can add the cards for you. **Which
files exist depends on the release**, and this is the largest practical difference
between the two.

### Rev 3/11

| File | Card | Contents |
|---|---|---|
| `for042.csv` | *none — always written* | The bulk of `for006.dat` as rows and columns with a header line: `CASE, MACH, RE, ALT, Q, BETA, PHI, SREF, XCG, LREF, ALPHA` and the full coefficient set including `CMQ`, `CLLP`, `CLNR`. |
| `for043.csv` | `PRINT AERO SYNTHS` (or `BEND`, `HINGE`, or `PART`) | Per-fin-set and per-panel data: `CNx_IPB`…`CLLx_IPB`, `PBMx_Py`, `PHMx_Py`, `PCNx_Py`. |
| `for003.dat` | `PLOT` | Total force and moment table. |
| `for020.dat`, `for021.dat` | `PLOT` | AML and AVDS formats. `for021` carries `DELTA`; `for042.csv` does not. |
| `for022.dat` | *none — always written* | Tecplot-compatible body and fin geometry. |
| `for009.dat` | `PRINT GEOM BODY` | The body contour the code generated. This viewer can overlay it. |
| `vpath*.dat` | `PRINT VORTEX` | Fin-shed vortex paths and strengths, **one file per α–Mach point per case**. Not offered as a tick: on a real sweep that is thousands of files. |

The catch worth knowing: **`for042.csv` has no deflection column.** For a deflection
sweep, match results back through `CASE`, which counts 1..N per file in the same order
the generated `CASEID n/N  PHI=… DELTA1=…` lines number them. The generated file header
says so. If you need the deflection in the data itself, `PLOT` and `for021.dat` carry it.

Column order in `for042.csv` shifts with the input flags set, so read it by header name
rather than by position — the manual says so explicitly.

### Rev 5/97

| File | Card | Contents |
|---|---|---|
| `for003.dat` | `PLOT` | Total force and moment table: `ALPHA, CN, CM, CA, CY, CLN, CLL, DELTA`, one zone per case. Static only. |
| `for004.dat` | `FORMAT` + `WRITE` | Named data blocks in a format you choose — the route to static **and** dynamic data with the sweep variables alongside. |
| `for009.dat` | `PRINT GEOM BODY` | The body contour the code generated. This viewer can overlay it. |

`for004.dat` does not survive into 3/11: the 2011 manual lists no unit 4 in its
input/output table and defines no `WRITE` or `FORMAT` control card. (One vestigial
sentence in its §4.4 still mentions "user defined format data files", so a 3/11 binary
may retain the capability undocumented — unverified here.) The **WRITE tables** tick is
therefore offered under 5/97 only; under 3/11 the toolbar shows the **Fin tables
(for043.csv)** tick in its place.

**WRITE tables (for004.dat)** emits a working set:

```
FORMAT (10E13.5)
WRITE FLC,1,145
WRITE TOTALC,1,80
WRITE SB1234,1,220
WRITE DB1234,1,400
```

`PLOT`, `FORMAT` and `WRITE` are effective for a whole run rather than one case, so they
are written once per file — unlike `DAMP` and `PRINT AERO`, which have to repeat. The
dynamic block is only written when `DAMP` is ticked, since nothing fills it otherwise.

Everything from here to the end of this section is 5/97's `for004.dat` layout.

### Block names by configuration

The block name encodes the vehicle, so it is taken from the loaded deck's fin sets:

| Configuration | Static (Table 21) | Dynamic (Table 22) |
|---|---|---|
| Body alone | `SBODY` | `DBODY` |
| Body + 1 fin set | `SB1` | `DB1` |
| Body + 2 fin sets | `SB12` | `DB12` |
| Body + 3 fin sets | `SB123` | `DB123` |
| Body + 4 fin sets | `SB1234` | `DB1234` |

Individual fins are `SFIN1`…`SFIN4`. Trimmed and untrimmed results are `TRIMD` and
`UNTRIM` (Tables 23 and 24).

### What each block holds

Every variable occupies a fixed **20-element** slot, one per angle of attack, whatever
`NALPHA` actually is — so trim each slot to `NALPHA`, which is element 1 of `FLC`.

The layouts below are confirmed against a real dump of a four-fin-set vehicle, not just
read off the manual.

**Table 21 — static, `SB…`, elements 1–220**

| Elements | Variable | | Elements | Variable |
|---|---|---|---|---|
| 1–20 | `CN` | | 121–140 | `CNA` |
| 21–40 | `CM` | | 141–160 | `CMA` |
| 41–60 | `CA` | | 161–180 | `CYB` |
| 61–80 | `CY` | | 181–200 | `CNB` |
| 81–100 | `CLN` | | 201–220 | `CLB` |
| 101–120 | `CLL` | | | |

**Table 22 — dynamic, `DB…`, elements 1–400**

| Elements | Variable | | Elements | Variable |
|---|---|---|---|---|
| 1–20 | `CNQ` | | 201–220 | `CLNR` |
| 21–40 | `CMQ` | | 221–240 | `CLLR` |
| 41–60 | `CAQ` | | 241–260 | `CNP` |
| 61–80 | `CYQ` | | 261–280 | `CMP` |
| 81–100 | `CLNQ` | | 281–300 | `CAP` |
| 101–120 | `CLLQ` | | 301–320 | `CYP` |
| 121–140 | `CNR` | | 321–340 | `CLNP` |
| 141–160 | `CMR` | | 341–360 | `CLLP` |
| 161–180 | `CAR` | | 361–380 | `CNAD` |
| 181–200 | `CYR` | | 381–400 | `CMAD` |

**Table 25 — flight conditions, `FLC`, elements 1–144**

| Elements | Variable | | Elements | Variable |
|---|---|---|---|---|
| 1 | `NALPHA` | | 45–64 | `ALT` |
| 2–21 | `ALPHA` | | 65–84 | `REN` |
| 22 | `BETA` | | 85–104 | `VINF` |
| 23 | `PHI` | | 105–124 | `TINF` |
| 24 | `NMACH` | | 125–144 | `PINF` |
| 25–44 | `MACH` | | | |

> The manual's Table 25 gives `ALT` as 45–65 and `REN` as 66–85, totalling 145. A real
> dump disagrees: it writes **144** values and puts `REN(1)` at element **65**, so `ALT`
> is 45–64 and everything after it shifts down one. The layout above is the corrected one.
> Ask for 145 and the extra element is not there.

**Table 26 — attitude, `TOTALC`, elements 1–80**

| Elements | Variable |
|---|---|
| 1–20 | `BALPHA` — body-axis angle of attack |
| 21–40 | `BBETA` — body-axis sideslip |
| 41–60 | `BPHI` — body-axis roll |
| 61–80 | `ALPTOT` — total angle of attack |

**One block set is written per Mach number, not per case.** A case with `NMACH=5` produces
five `SB…`/`DB…` dumps, each holding the alpha sweep at one Mach, in schedule order. `FLC`
repeats the whole Mach schedule in every one, so the Mach a given dump belongs to comes
from its ordinal position within the case, not from anything in the block. Expect
`NMACH × cases` block sets in the file.

A block name that does not match the vehicle is **not** an error. `WRITE SB1234` against a
two-fin-set deck writes all 220 values as zero and says nothing, so check the fin-set count
matches the deck you actually run — the generated file states which configuration it
assumes. Unused slots inside a populated block read as `1.0E-30`, the initialised value,
which is distinct from a genuine zero.

`FLC` carries `BETA` and `PHI` per case, so a roll or sideslip sweep stays identifiable
in the dump without matching results back by case order. The `FORMAT` card takes a Fortran
format in parentheses and must precede the `WRITE` cards; the default if omitted is
`8F10.4`, which is usually too coarse for derivatives.

## Sweeping angle of attack and sideslip

There are two ways to give the pitch and yaw angles, and the choice matters more than it
looks.

> **The definition of β changed in 8/08.** Through 7/07 it was β′ = tan⁻¹(v/u); from
> 8/08 onward it is β = sin⁻¹(v/V₀). The two are related by `tan β = tan β′ · cos α`, so
> they agree at small α and diverge as α grows. Everything below holds for both, but the
> formulas differ, and a `BETA` value copied from an old deck into a modern build is not
> the same angle.

**`ALPHA` + `BETA`** specifies body-axis angles. It is the natural form for a constant-β
sweep, but the code converts internally to total angle of attack α_T and aerodynamic roll
φ. Under **Rev 5/97**, with β′ = tan⁻¹(v/u):

```
tan α_T = sqrt(tan²α + tan²β′)
tan φ   = tan β′ / tan α
```

Under **Rev 3/11**, with β = sin⁻¹(v/V₀):

```
cos α_T = cos α · cos β
tan φ   = tan β / sin α
```

Either way the denominator vanishes at α = 0, so **α = 0 with non-zero β is a division by
zero** and the coefficients come back as NaN. Negative α is degenerate for the same
reason: α_T is positive by definition, so negative α has to be carried as a roll angle
past 90°, which a single arctangent cannot recover. Neither is a limit on how large β may
be — β = −8° is perfectly fine at α = 4°.

Note also that from 7/07 onward, supplying `BETA` **and** `PHI` in one case is a fatal
error that stops the run — under 5/97 the code merely ignored `BETA`. The builder blocks
generation on 3/11 and warns on 5/97.

**`ALPHA` + `PHI`** hands the code the pair it actually wants. When `PHI` is non-zero,
`ALPHA` is read as the **total** angle of attack, so no conversion happens and there is no
singularity. Going the other way (3/11 forms; replace the second with
`tan β′ = tan α_T · sin φ` for 5/97):

```
tan α = tan α_T · cos φ
sin β = sin α_T · sin φ
```

φ is not sideslip. Because sin β = sin α_T · sin φ, **|β| can never exceed α_T**, and a
case of constant φ traces a ray of constant β/α ratio rather than a line of constant β.

### Covering the envelope

Sweep φ from 0° to 180° with α_T as the in-case array: φ = 0 is pure nose-up pitch, φ = 90
is pure sideslip at zero incidence, φ = 180 is pure nose-down. `ALPHA` 0:2:16 across that
range spans α from −16° to +16° with |β| up to 16°, and never asks the code to convert.

The other half of the circle follows by mirror symmetry — but only if the configuration is
mirror-symmetric about the vertical plane, meaning the fin roll angles map onto themselves
under φ → 360−φ. Fins at `0,120,240` or `60,180,300` do. The same Y rolled to `30,150,270`
does **not**, and then the full 0–360° is needed.

Since `tan²α + tan²β = tan²α_T`, this samples a **polar** grid in (tan α, tan β) — circles
of constant α_T, rays of constant φ — which is the natural grid for a body of revolution.

### Choosing the φ step

Less obvious than it looks. A fin set with rotational order *n* plus mirror symmetry has a
fundamental domain of 180/*n* degrees, and each swept φ folds into it as `φ mod (360/n)`,
reflected about the midpoint. Steps that share a large common factor with 360/*n* waste
cases on repeats. For a three-fin set, where the domain is 0–60°:

| φ step | cases | aerodynamically distinct |
|---|---|---|
| 45° | 5 | 5 |
| 30° | 7 | **3** |
| 22.5° | 9 | **9** |
| 15° | 13 | **5** |

22.5° gives nine distinct orientations at a uniform 7.5° spacing, because gcd(22.5, 120) is
small. 15° gives thirteen cases for only five distinct results — more runs for worse
coverage. Check the arithmetic for your own fin count before assuming a finer step helps.

Where a sweep does repeat itself, the duplicates are a free consistency check: φ and
φ + 360/*n* are the same flow with the transverse force and moment components rotated,
while roll and axial force are unchanged. Comparing a pair is a cheap way to see whether
the methods actually respect the symmetry you are relying on.

At α_T = 0 the roll angle means nothing, so that point is the same condition in every φ
case. The builder says how many runs that repeats, and dropping `0` from the schedule
removes them.

## Coverage

Built against the manuals rather than a couple of example decks, so options that a typical
deck never exercises are handled too.

**Decks built on `AXIBOD`/`ELLBOD` and `FINSET`n**

| Namelist | Support |
|---|---|
| `AXIBOD` | Option 1 (nose / centrebody / afterbody) with `CONICAL`, `OGIVE`, `POWER`, `HAACK`, `KARMAN` noses; `BNOSE` blunting and `TRUNC` truncation; conic centrebodies; conical and ogival boattails and flares. Option 2 `NX`/`X`/`R` tables with `Z` camber. |
| `ELLBOD` | Both options, with per-station ellipticity (`ENOSE`/`ECENTR`/`EAFT`, or `H`/`W`/`ELLIP`). |
| `FINSET`n | All nine sets are parsed and drawn; under a 5/97 target anything beyond four is flagged. Multi-segment planforms defined by explicit `XLE` or by `SWEEP`/`STA` chaining; `SSPAN(1)=0` auto-placement on the body mould line; `HEX`, `ARC`, `NACA` and `USER` sections; `NPANEL`, `PHIF`, `GAM`; `CFOC` trailing-edge devices, full or partial span; `NVOR`. |
| `DEFLCT` | `DELTA1`–`DELTA9` per panel; `XHINGE` and `SKEW` reach only the first four sets, which is flagged where it matters. For an all-moveable panel the whole fin pivots about `XHINGE` with `SKEW`; where `CFOC` defines a trailing-edge device only that device deflects, about the straight hinge `CFOC` implies, and `XHINGE`/`SKEW` are correctly ignored. |
| `PROTUB` | `VCYL`, `HCYL`, `BLOCK`, `FAIRING`, `LUG`, `SHOE` — drawn as simplified primitives. |
| `INLET` | `2DSIDE`, `2DTOP`, `AXI`, lofted through the five `X`/`H`/`W` stations, with diverter. |
| `REFQ` | `XCG` for the CG marker. |
| `NACA` card | 1-, 4-, 5- and 6-series, plus supersonic `NACA-n-S-…` diamond, circular-arc and hexagonal sections drawn to their exact stated thickness and break points. |
| `SAVE` / `DELETE` | Case-to-case namelist persistence, so a deck can swap `AXIBOD` for `ELLBOD` between cases. Where a case deletes a namelist and then re-specifies the same one, only what that case supplies is kept — the manual: *"All previously saved namelists with the names specified will be purged … Any new inputs of the same namelist will be retained."* Control cards may sit anywhere in a case, so this does not depend on whether the `DELETE` came before or after the namelist. |

**Decks built on `BODY`, `SYNTHS` and the `xxPLNF` planforms**

| Namelist | Support |
|---|---|
| `BODY` | `X`/`R`/`ZU`/`ZL` station tables, with `S` or `P` as a fallback when `R` is absent. |
| `SYNTHS` | `XW`/`ZW`, `XH`/`ZH`, `XV`/`ZV`, `XVF`/`ZVF`, `XCG`/`ZCG`, `ALIW`/`ALIH`, `VERTUP`. |
| `WGPLNF`, `HTPLNF`, `VTPLNF`, `VFPLNF` | `TYPE=1` straight-tapered and `TYPE=2/3` cranked planforms; `SAVSI`/`SAVSO` referenced to `CHSTAT`; `DHDADI`/`DHDADO` with `SSPNDD`; `TWISTA`; `SSPNE`. |
| `TVTPAN` | Twin vertical panels at ±`BH`/2. |
| `SYMFLP`, `ASYFLP` | Control-surface planform and deflection, drawn on the wing. |
| `PROPWR` | Propeller disc, hub and blades at `PHALOC`/`PHVLOC`/±`YP`, tilted by `AIETLP`. |
| `JETPWR` | Nacelle from `JIALOC` to `JEALOC` at ±`JELLOC`, inlet radius from `JINLTA`, exit from `JERAD`. |
| `GRNDEF` | Ground plane drawn `GRDHT` below the reference plane. |
| airfoil cards / `xxSCHR` | `NACA-W/H/V/F-s-desig` cards, or `WGSCHR`/`HTSCHR`/`VTSCHR`/`VFSCHR` with `TYPEIN=1` surface coordinates, `TYPEIN=2` mean line + thickness, or a bare `TOVC`. |

Aerodynamic namelists (`FLTCON`, `EXPR`, `TRIM`, …) are parsed and listed but have no
geometric effect. Multiple cases separated by `NEXT CASE` are supported, with the right
persistence rule for each form: `BODY`/`SYNTHS` decks retain inputs automatically,
`AXIBOD`/`FINSET` decks only when the case carries a `SAVE` card.

Coverage was checked during development against decks exercising every geometric
namelist listed above — including the options a typical deck never touches, such as
`DELETE` swapping the body definition between cases, all four `SECTYP` values, all six
`PTYPE` protuberances, and all four section-input mechanisms. Those decks are not
shipped with the tool; supply your own.

## Conventions implemented

The same in both releases — the 2011 revision restates them unchanged. Cited here by
their 1997 numbering: Figure 1 (body geometry), Figure 6 (fin break points),
Figure 8 (fin numbering and orientation), Figure 9 (roll attitude), Figure 10 (HEX and ARC
airfoils), and the sign note under namelist `DEFLCT`:

- Body axes: **+X aft**, **+Y starboard**, **+Z up**.
- `PHIF` is measured clockwise from top vertical centre looking forward from behind, so a
  panel's radial direction is `(0, sin PHIF, cos PHIF)`.
- `GAM` dihedral is positive in the direction of increasing `PHIF`.
- Positive `DELTAn` is a right-hand rotation about the panel's outboard span axis, which
  puts the leading edge of a top-mounted panel toward −Y.
- `XLE` is measured from the body nose; `XHINGE` from the coordinate origin.
- `SSPAN` is measured from the vehicle centreline; `SSPAN(1)=0` means the values are
  relative to the root chord and the panel is placed on the body surface.
- `STA` is the chord station at which `SWEEP` is measured (0 = LE, 1 = TE).

## Approximations

The Messages panel flags these per deck as they apply.

- Nose blunting solves for the virtual sharp-nose length so the drawn nose measures
  exactly `LNOSE`. With option 2 body tables the points are drawn as given.
- In `BODY` decks `ZL` is documented as positive *below* the centreline but is
  conventionally written signed; magnitudes are used, so either convention draws right.
- NACA 1-, 5-, 6- and 7-series cards use the 4-digit thickness distribution scaled to the
  t/c implied by the last two digits; camber is drawn only for 4-digit sections. Supply
  `xxSCHR` coordinates for an exact section.
- Protuberances are simplified primitives; inlets have no internal cowl or ramp detail.
- Control surfaces rotate about their true hinge line, which follows the wing's sweep and
  dihedral, and carry the root incidence. They do not follow `TWISTA`, so on a strongly
  twisted wing the outboard end of a flap can sit slightly proud of the trailing edge.
- Where a deck is self-inconsistent the tool follows DATCOM and says so. A wing that
  declares `TYPE=1.` (straight tapered) while also supplying `CHRDBP`/`SSPNOP` is a
  common case: DATCOM ignores the breakpoint, so the reported planform area will not
  match a `SREF` computed from the cranked shape. The viewer draws the straight-tapered
  panel and warns rather than silently picking one reading.

## Layout

```
datcomViz/
├── index.html          the whole application
├── README.md
├── test/               node test/run.js — see test/README.md
└── vendor/             three.js r147 (UMD) + OrbitControls, loaded from disk
```

No build step and no dependencies to install. Deployed as a static site it is just
`index.html` and `vendor/`; opened from disk it behaves identically.

## Tests

```
node test/run.js
```

No dependencies and no test framework. The harness pulls the inline script out of
`index.html` and runs it in a `vm` context against a stub DOM, so the tests drive the
shipped parser, geometry checks and case builder rather than a copy of them. Two further
groups run when pointed at the reference material:

```
DATCOMVIZ_REFERENCE=../datcomViz-reference node test/run.js
```

The strongest of those regenerates a real 2125-case, 8-part sweep and requires it to come
back byte-for-byte identical to files this tool produced earlier — which is what pins the
Rev 5/97 path down while the 3/11 support moves around it. See `test/README.md`.
