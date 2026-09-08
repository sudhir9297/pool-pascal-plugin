# Pool pipe routing

## Manufacturer guidance

- [Pentair IntelliFlo3 installation guide](https://www.pentair.com/content/dam/extranet/nam/pentair-pool/residential/pumps/intelliflo3-vsf/manuals/install-guide/intelliflo3-pro3-vsf-install-guide.pdf) requires at least five suction-pipe diameters between the pump inlet and a valve, elbow, or tee. This is equipment-specific guidance, not a universal rule for all equipment.
- [Charlotte Pipe's product guidance](https://www.charlottepipe.com/articles/plastic-piping-systems-applications-fittings-and-more) distinguishes pressure PVC from DWV. Using DWV fittings does not produce a pressure-rated system, even with solid-wall pipe.
- [Hayward heater installation manual](https://hayward.com/media/akeneo_connector/asset_files/U/H/UHS_Service_Installation_011717_RevT_6fd9.pdf) describes heater plumbing and bypass arrangements. Equipment selection and flow requirements must drive bypass design; a generic point-to-point connection does not establish that design.

## Implemented behavior

The selected socket starts the route. Both ends receive an outward straight approach, with a conservative default of at least five nominal diameters plus fitting allowance, and a minimum 0.3 m. This default is a modeling choice inspired by the pump guidance, not manufacturer certification.

Automatic connections use an underground main run. Its elevation is below the level floor and below the measured pool/slab bounds, including fitting clearance. Socket approaches descend to this elevation, with short offsets where an upward-facing socket needs room to turn. The depth is a modeling default, not a prescribed installation burial depth. There is no overhead fallback if the underground route is blocked. Solid floors still require a clear path or an opening; routing does not cut through them automatically.

Axes follow the source equipment's horizontal socket direction. The search prefers shorter routes with fewer turns and permits standard 22.5, 45, and 90 degree bends. Boxes include clearance for the pipe and elbow envelope. Only the initial straight approach may leave an enclosing socket host. Other obstacles cannot be crossed.

Each straight section is a native `pipe-segment`. Each bend is a native `pipe-fitting`. Pipe endpoints use the registered fitting socket positions. All sections and elbows are committed in one scene transaction. A failed search creates nothing and asks the user to leave clearance or align equipment.

Each socket has its own row in the selected item's Connections section. Connection relationships are derived at runtime from the registered socket positions, levels, systems, and sizes. Matching sockets within 1 mm form links; tracing continues through native pipes and fittings and stops at equipment sockets. Equipment inlets and outlets are not treated as internal shortcuts. A socket touching an incomplete route is shown as occupied without a destination.

No connection metadata, route IDs, member lists, or endpoint snapshots are written to the scene. Normal native pipe/fitting fields are still saved. Existing scenes need no migration, and old connection metadata is ignored without being removed or modified. The graph is rebuilt when scene nodes change, so deletion, movement, reload, and undo are reflected without writing back to the scene.

Upward-facing sockets also try offsets beyond their equipment's measured bounds before descending. Both source and destination approaches use this clearance check. These offsets do not permit crossing an unrelated solid floor.

## Limits

This is conservative geometric routing, not hydraulic design. It does not calculate pressure loss, select pump capacity, choose unions or isolation/bypass valves, verify pressure ratings, or certify construction. Native DWV nodes are reused for geometry; this does not establish a pressure rating.

Bounding boxes may reject a usable path around curved equipment or inside a pool cavity. The finite corridor search can report failure even when a more complex route exists. Differently rotated equipment may need manual alignment for standard elbows. Obstacles come from loaded scene geometry. Hidden objects are excluded unless they are connection endpoints. Composite children can use their registered parent's bounds. Missing pool/equipment or endpoint geometry produces an error identifying the item; other unrendered nodes do not block creation. Automatic rerouting after scene edits is not implemented. Verify the route again after moving equipment or resizing a pool.

## Verification

Tests cover socket approach direction, box avoidance, blocked approaches, host exits, unique native node IDs, matching pipe/elbow endpoints, and a single commit for the route. The integration test supplies the editor elbow port contract through a registry fixture; it is not a browser test.
