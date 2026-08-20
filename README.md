# datcomViz

A browser-based **geometry viewer** for DATCOM input decks.

Open `index.html` in a browser — that's it. No build step, no server, no network. The
page loads `vendor/three.min.js` from disk, so it works offline and nothing you drop on
it ever leaves the machine.

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

## Case builder

The **Cases** tab turns a set of sweeps into DATCOM case text. Pick the variables you
want, give each a list or a start/stop/step, and it emits the `NEXT CASE` chain to paste
under an existing deck. It generates text only — it does not run anything.

What matters is that sweeping a variable does not cost the same everywhere. In an
`AXIBOD`/`FINSET` deck `ALPHA` is an array of up to 100 and `MACH` up to 20, so a whole
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

It enforces the rules the manual states: `BETA` and `PHI` cannot appear in the same case,
`NALPHA` must be greater than 1, the array size limits per variable, `ALSCHD` must be
ascending, `REN`/`ALT` pair one-to-one with `MACH` (a single value is broadcast), and with
`SAVE` in effect a run reads at most 300 namelists.

## Coverage

Built against the 2011 revision of the user's manual and the input namelist reference,
not just a couple of example decks — so options that a typical deck never exercises are
handled too.

**Decks built on `AXIBOD`/`ELLBOD` and `FINSET`n**

| Namelist | Support |
|---|---|
| `AXIBOD` | Option 1 (nose / centrebody / afterbody) with `CONICAL`, `OGIVE`, `POWER`, `HAACK`, `KARMAN` noses; `BNOSE` blunting and `TRUNC` truncation; conic centrebodies; conical and ogival boattails and flares. Option 2 `NX`/`X`/`R` tables with `Z` camber. |
| `ELLBOD` | Both options, with per-station ellipticity (`ENOSE`/`ECENTR`/`EAFT`, or `H`/`W`/`ELLIP`). |
| `FINSET1–9` | Multi-segment planforms defined by explicit `XLE` or by `SWEEP`/`STA` chaining; `SSPAN(1)=0` auto-placement on the body mould line; `HEX`, `ARC`, `NACA` and `USER` sections; `NPANEL`, `PHIF`, `GAM`; `CFOC` trailing-edge devices, full or partial span. |
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

Taken from Figures 2, 3, 7, 9, 11 and 13 of the 2011 revision of the user's manual:

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
