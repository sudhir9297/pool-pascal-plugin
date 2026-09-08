# PVC valve model

Research checked 2026-09-07. Implementation status was reconciled with the code
on 2026-09-08.

## Model basis

- A two-way valve has two sockets and represents shutoff with `open` and `closed`
  states.
- A three-way valve has left, right, and branch sockets for diverting or mixing.
- True-union-style collars make each socket readable as a connection point.
- The external body remains the same while the selected internal path changes.

## Implemented flow patterns

| Variant | Saved pattern | Visible connection |
| --- | --- | --- |
| Two-way | `open` | Left to right |
| Two-way | `closed` | None |
| Three-way | `left-right` | Left to right |
| Three-way | `left-branch` | Left to branch |
| Three-way | `right-branch` | Right to branch |
| Three-way | `all` or `open` | All three pairs |
| Three-way | `closed` | None |

The selected pattern changes socket highlighting and the visible internal path.
All physical sockets remain available as pipe connection points because valve
state must not change the plumbing topology.

The model includes the body, union collars, sockets, bonnet, stem, handle, and
internal path. It does not simulate pressure, valve losses, actuator behavior,
mixing ratios, or hydraulic state.

## Sources

- [Hayward Flow Control LA1300TE](https://www.haywardflowcontrol.com/en_us/products/thermoplastic-valves/ball-valves/three-way-true-union-ball-valves/la1300te)
- [Valtorc Series 400 three-way PVC valve](https://valtorc.com/valves/ball-valves/pvc-cpvc-ball-valves/true-union-3-way-pvc-valve-specs/)
- [Spears valves technical reference](https://parts.spearsmfg.com/sourcebook/VALTECH_VAL_TU2VO_T.pdf)
