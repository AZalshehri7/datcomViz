# TODO

Things deliberately deferred, with enough context to pick them up cold.

## `$TRIM` support in the Cases tab

Sweeping a deflection answers *"what does the vehicle do at each δ"*. `$TRIM` answers the
different question *"which δ trims it"* — the code solves for CM = 0 itself, so one case
replaces an N-case sweep.

```
 $TRIM SET=4.,PANL1=.TRUE.,PANL2=.TRUE.,DELMIN=-25.0,DELMAX=25.0,NINCR=20.,$
PRINT AERO TRIM
```

Worth adding as an alternative output mode, *not* as a replacement for the deflection
sweep — the two answer different questions, and a control-effectiveness map (several fin
sets varying independently) cannot be produced this way.

Points to encode when building it:

- `SET` picks one fin set only; `PANL1`..`PANL8` select which panels of it participate.
- `DELMIN` must be less than `DELMAX`. If only one is given the other defaults to 0.
- Defaults are `DELMIN=-25`, `DELMAX=+20`, `NINCR=10`.
- The 3/11 release always runs a δ = 0 condition when the bounds span zero. Before that,
  bounds such as ±45 stepped over zero entirely and produced a wrong trim drag while still
  reporting the right trim angle. `NINCR` controls the resolution; a larger value costs
  run time. Worth surfacing in the UI rather than leaving as a trap.
- Component build-up data is not produced when `TRIM` is selected, so it does not combine
  with a `BUILD` run.
- `NINCR` and the δ = 0 fix are 3/11 only; `ASYM` is the reverse, present in 5/97 and
  deleted in 8/08. The geometry checks already gate both on the target release, so a
  `$TRIM` builder must do the same rather than emit one set of inputs for both. Under
  5/97 both `DELMIN` and `DELMAX` are required; from 3/11 either may be omitted and the
  other defaults to 0.

## `BODY`/`SYNTHS` parity

The Cases tab and the geometry checks were built against `AXIBOD`/`FINSET` first, by
choice. The Cases tab already generates valid `BODY`/`SYNTHS` output, but the geometry
checks are missile-side only. Equivalents worth adding there:

- lifting surface roots against the fuselage half-breadth at the apex station, the same
  buried-or-floating test `missileGeomChecks` does for fin roots;
- `SSPNE` greater than `SSPN`, or a flap span outside the panel it sits on;
- `SREF`/`BLREF`/`CBARR` against the computed planform area, span and MAC — this already
  catches the `TYPE=1` versus `CHRDBP` inconsistency in the ASW-20 deck, but only
  indirectly, via the planform warning.

## Smaller items

- **Control surfaces do not follow `TWISTA`.** They rotate about the true hinge line and
  carry root incidence, but not twist, so on a strongly twisted wing the outboard end of a
  flap can sit slightly proud of the trailing edge. Documented in the README under
  Approximations.
- ~~**OBJ or STL export**~~ — done. Both, plus a per-panel deflection editor, in the
  Export geometry panel. What is still missing is a **boolean union**: components come
  out as closed solids but interpenetrate rather than being fused, so anything needing a
  watertight model (printing, a CFD surface mesh) has to union them downstream. Also open:
  mirrored lifting surfaces share the centreline edge loop between halves, jet nacelles
  are uncapped tubes, and stacked `LUG`/`SHOE` members overlap — all documented, none
  fixed.
- **`for009` beyond the body.** Only the body contour is overlaid today. Fin pressure and
  geometry tapes (`for011`, `for021`) were not investigated.
- **Only `DAMP` is offered as a control card.** `PART`, `BUILD`, `SOSE`, `HYPER`, `SPIN`
  and the `PRINT` variants are all per-case in the same way and could be ticks alongside
  it, or a free-text box for cards to repeat in every case.
- **`DAMP` with non-zero `BETA` is unverified.** A `PHI=45` case was checked and returns
  `CMQ`, so the restriction later manuals describe does not apply to Rev 5/97 for roll.
  The `BETA` half of that statement was never tested.
