# datcomViz

A browser-based **geometry viewer** for DATCOM input decks.

**<https://datcom.aero-dev.com>**

Open `index.html` in a browser — that's it. No build step, no server, no network. The
page loads `vendor/three.min.js` from disk, so it works offline and nothing you drop on it
ever leaves the machine. Case-builder settings are kept in the browser's local storage;
your deck is not.

## What it does

Drop a `for005.dat`, `.dcm`, `.inp` or `.txt` input deck on the sidebar (or click to
browse). The tool parses the Fortran namelists, works out which input form the deck
uses, and draws the configuration in 3D.

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

## Which DATCOM this targets

Built against the **1997 manual**, AFRL-VA-WP-TR-1998-3009, which documents **Missile
Datcom Rev 5/97**, and the Digital DATCOM input namelist reference. The limits enforced
are that release's: `ALPHA` up to 20 per case, four non-overlapping fin sets numbered
front to back, and no `NVOR`, body `Z` camber, conic centrebody or `NINCR`. Later releases
raise some of these, so a deck written for a newer build may trip a check here — the
message says which release the feature arrived in.

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
  which silently stops fin-shed vortices being tracked between them.

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

Later manuals state that damping derivatives are not computed when `PHI` or `BETA` is
non-zero, which would gut a roll sweep. **That restriction does not apply to Rev 5/97** —
a case run at `PHI=45` with zero deflections returns `CMQ` — so no warning is raised. Be
aware of it if you ever move to a newer build.

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
case.

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
machine-readable files instead, and the Cases tab can add the cards for you.

| File | Card | Contents |
|---|---|---|
| `for003.dat` | `PLOT` | Total force and moment table: `ALPHA, CN, CM, CA, CY, CLN, CLL, DELTA`, one zone per case. Static only. |
| `for004.dat` | `FORMAT` + `WRITE` | Named data blocks in a format you choose — the route to static **and** dynamic data with the sweep variables alongside. |
| `for009.dat` | `PRINT GEOM BODY` | The body contour the code generated. This viewer can overlay it. |

**WRITE tables (for004.dat)** emits a working set:

```
FORMAT (10E13.5)
WRITE FLC,1,145
WRITE TOTALC,1,80
WRITE SB1234,1,220
WRITE DB1234,1,400
```

`PLOT`, `FORMAT` and `WRITE` are effective for a whole run rather than one case, so they
are written once per file — unlike `DAMP`, which has to repeat. The dynamic block is only
written when `DAMP` is ticked, since nothing fills it otherwise.

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

**`ALPHA` + `BETA`** specifies body-axis angles. It is the natural form for a constant-β
sweep, but the code converts internally to total angle of attack α_T and aerodynamic roll
φ. In Rev 5/97, where β is defined as tan⁻¹(v/u):

```
tan α_T = sqrt(tan²α + tan²β)
tan φ   = tan β / tan α
```

The denominator vanishes at α = 0, so **α = 0 with non-zero β is a division by zero** and
the coefficients come back as NaN. Negative α is degenerate for the same reason: α_T is
positive by definition, so negative α has to be carried as a roll angle past 90°, which a
single arctangent cannot recover. Neither is a limit on how large β may be — β = −8° is
perfectly fine at α = 4°.

**`ALPHA` + `PHI`** hands the code the pair it actually wants. When `PHI` is non-zero,
`ALPHA` is read as the **total** angle of attack, so no conversion happens and there is no
singularity. Going the other way:

```
tan α = tan α_T · cos φ
tan β = tan α_T · sin φ
```

φ is not sideslip. Because `tan β = tan α_T sin φ`, **|β| can never exceed α_T**, and a
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
| `FINSET`n | Four sets in this release, though all nine are parsed and anything beyond four is flagged. Multi-segment planforms defined by explicit `XLE` or by `SWEEP`/`STA` chaining; `SSPAN(1)=0` auto-placement on the body mould line; `HEX`, `ARC`, `NACA` and `USER` sections; `NPANEL`, `PHIF`, `GAM`; `CFOC` trailing-edge devices, full or partial span. |
| `DEFLCT` | `DELTAn` per panel. For an all-moveable panel the whole fin pivots about `XHINGE` with `SKEW`; where `CFOC` defines a trailing-edge device only that device deflects, about the straight hinge `CFOC` implies, and `XHINGE`/`SKEW` are correctly ignored. |
| `PROTUB` | `VCYL`, `HCYL`, `BLOCK`, `FAIRING`, `LUG`, `SHOE` — drawn as simplified primitives. |
| `INLET` | `2DSIDE`, `2DTOP`, `AXI`, lofted through the five `X`/`H`/`W` stations, with diverter. |
| `REFQ` | `XCG` for the CG marker. |
| `NACA` card | 1-, 4-, 5- and 6-series, plus supersonic `NACA-n-S-…` diamond, circular-arc and hexagonal sections drawn to their exact stated thickness and break points. |
| `SAVE` / `DELETE` | Case-to-case namelist persistence, so a deck can swap `AXIBOD` for `ELLBOD` between cases. |

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

Taken from the 1997 manual — Figure 1 (body geometry), Figure 6 (fin break points),
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
└── vendor/             three.js r147 (UMD) + OrbitControls, loaded from disk
```

No build step and no dependencies to install. Deployed as a static site it is just these
files; opened from disk it behaves identically.
