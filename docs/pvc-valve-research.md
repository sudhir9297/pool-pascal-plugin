# PVC valve research

Initial valve modeling is based on common thermoplastic pool and process-piping designs:

- A 2-way ball valve has one inlet and one outlet and is used for shutoff.
- A 3-way ball valve adds a third port for diverting or mixing flow.
- 3-way valves are commonly specified with an L-port or T-port ball. The external body can be the same, while the internal passage pattern changes with the handle position. The first model therefore uses one 3-way body and leaves the internal flow pattern for a later behavior pass.
- A typical horizontal T-port valve has four useful positions: left-to-right, common-to-left, all three ports, and common-to-right. Each quarter-turn changes which passages line up.
- True-union ends are a useful fit for this plugin because each side presents a distinct PVC socket/union connection that can be connected to a pipe run.

Sources:

- [Hayward Flow Control LA1300TE](https://www.haywardflowcontrol.com/en_us/products/thermoplastic-valves/ball-valves/three-way-true-union-ball-valves/la1300te)
- [Valtorc Series 400 3-way PVC valve](https://valtorc.com/valves/ball-valves/pvc-cpvc-ball-valves/true-union-3-way-pvc-valve-specs/)
- [Spears Valves Technical reference](https://parts.spearsmfg.com/sourcebook/VALTECH_VAL_TU2VO_T.pdf)

The implementation is visual and parametric. It models the valve body, union collars, socket centers, stem, handle, and the selected opening pattern; hydraulic simulation is outside the scope of this plugin.
