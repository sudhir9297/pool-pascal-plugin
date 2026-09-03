# Pipe It follow-up workflow research

Research date: 2026-09-03

## Conclusion

Pipe It does not treat endpoint handles, pipe segments, and fittings as separate
objects that the user manually assembles. It treats the layout as a graph and
changes the rendered pieces whenever that graph changes.

For our PVC editor, the next feature should be **first-class pipe-edge
selection and segment editing**. A clicked segment should become the active
sub-selection, show an edge-aligned gizmo, and support a validated,
transactional perpendicular slide. The same selected-edge state should then
support **Insert Straight Here**, which splits the edge and creates a node from
which the user can branch.

This ordering gives us the missing interaction foundation. We already have a
basic edge split mutation, but building more insertion buttons on top of the
current network-level selection would skip the selection, preview, snapping,
and validity behavior that makes Pipe It coherent.

## Primary-source scope

Only first-party Pipe It sources were used:

- the vendor's current documentation;
- the vendor's product site and changelog;
- the vendor-authored Fab listing;
- the two tutorials embedded by the vendor in its documentation.

Pipe It is a commercial Unreal Engine plugin. Its official pages do not link a
public source repository, so this report does not make claims about its private
implementation. Data-model and implementation recommendations below are
explicitly our design choices, inferred from documented behavior.

## The documented interaction model

### Selection is contextual

Once a network exists, Pipe It lets the user select either a junction node or
a pipe edge. The viewport hint panel changes with that sub-selection. A node or
edge can be selected with LMB; `,` and `.` walk along the run or switch between
an edge's two ends. Edge selection exposes edge-specific operations such as
roll, insertion, and selecting end A/B. The right-click menu is the
discoverable version of the shortcuts.

Source: [Editing a Network](https://pipeit-plugin.com/docs/guide/editing-networks/),
[Keyboard & Mouse Reference](https://pipeit-plugin.com/docs/guide/shortcut-reference/)

This means the important selection is not merely “the pipe-network scene node
is selected.” Pipe It also retains which graph element inside that network is
active.

### Endpoint extension remains a draw workflow

When a piece is selected, Pipe It displays a green `+` for every direction in
which that piece can legally grow. End caps have one growth direction;
straights can grow backward; junctions show unoccupied directions. Clicking a
`+` enters Draw Mode. Repeated clicks place segments and continue from the new
end until Enter or Esc finishes the run. `Shift + LMB` dragging the move gizmo
can enter the same extension workflow in the nearest valid direction.

During drawing, the cursor is projected onto candidate directions from the
current piece: piece-local axes, world axes, and 45-degree diagonals when the
kit contains compatible 45-degree pieces. The active candidate has a guide
line, alternatives remain visible, and a live ghost shows the segment and
fitting that would be created.

Source: [Drawing Pipes](https://pipeit-plugin.com/docs/guide/drawing-pipes/),
[Getting Started](https://pipeit-plugin.com/docs/guide/getting-started/)

### Segment editing uses an edge-aligned basis

Pipe It's official changelog describes full translate/rotate/roll gizmos using
a node-aligned basis. It separately calls out an **edge gizmo** that can slide
a section perpendicular to itself or roll it around its axis. Affected pieces
ghost-preview before the drag is committed. Moving or rotating a connected
piece stretches, re-routes, or swings connected runs while keeping joints
intact.

Source: [Pipe It changelog, v0.4.0](https://pipeit-plugin.com/changelog/),
[Getting Started](https://pipeit-plugin.com/docs/guide/getting-started/)

The Blueprint API confirms the underlying behavioral split: `Translate Node`
moves a junction and its connected pipes, `Rotate Node` rotates it in a
component-local axis, and edge roll is a separate visual property. Continuous
drag calls are grouped into one undo batch.

Source: [Blueprint API Reference](https://pipeit-plugin.com/docs/guide/blueprint-api/),
[Runtime Editing](https://pipeit-plugin.com/docs/guide/runtime-editing/)

### Insertion precedes branching

Pipe It inserts a junction on an existing edge with `Shift + LMB`, or with
**Insert Straight Here** in the edge's context menu. The cursor position is
projected onto the edge. The operation splits the edge and creates a straight
node that can then be used to branch or re-route the run.

The runtime API exposes this as a matched preview/commit pair:
`Begin Preview Insert On Edge` and `Insert Node On Edge`. Insertion is rejected
if the new node leaves insufficient space between neighboring pieces. An
optional camera hint controls the inserted piece's initial orientation.

Source: [Editing a Network](https://pipeit-plugin.com/docs/guide/editing-networks/),
[Blueprint API Reference](https://pipeit-plugin.com/docs/guide/blueprint-api/)

Branching is therefore not “drop a tee mesh.” The documented build loop says
to insert a straight section and then promote the node into a tee or cross by
adding a connection. The product page summarizes the resulting progression as
straight to corner to tee to cross, with adjacent pipes stretching to the new
junction.

Source: [Pipe It documentation home](https://pipeit-plugin.com/docs/),
[Pipe It product page](https://pipeit-plugin.com/)

### Snapping is constrained by what can actually be assembled

Pipe It combines several kinds of snapping:

- directional candidates: straight, plus or minus 45 degrees, and plus or
  minus 90 degrees;
- translation-grid snapping for cursor-driven lengths;
- exact numeric length entry in centimeters;
- `Ctrl`/`Cmd` surface snapping along the active direction;
- true 3D candidates, including ramps, according to the current changelog.

A surface-snapped run ends at the surface and can automatically choose a kit's
wall-mount cap. Invalid directions are not offered. Every segment also has a
minimum length because both neighboring pieces' sockets must physically fit;
too-short cursor distances are clamped, while impossible surface snaps and
insertions are rejected.

Source: [Drawing Pipes](https://pipeit-plugin.com/docs/guide/drawing-pipes/),
[Pipe It changelog](https://pipeit-plugin.com/changelog/),
[The Kits](https://pipeit-plugin.com/docs/guide/kits/)

The official docs describe scene-surface snapping and mesh sockets, but do not
describe automatic connection to arbitrary domain objects such as pool
skimmers. Typed pool-equipment ports are therefore a Pascal-specific extension
recommended below, not a claimed Pipe It feature.

### Fittings are derived from graph topology and socket compatibility

Pipe It defines a node's role by the number and angles of incident edges:

| Connections and directions | Rendered role |
| --- | --- |
| One connection | End cap |
| Two opposite connections | Straight |
| Two connections around 90 degrees | Corner |
| Two shallower-angle connections | Half corner / 45-degree corner |
| Three connections | Tee |
| Four connections | Cross |

When topology changes, Pipe It re-evaluates the node role and chooses a mesh
from the active kit. The pipe mesh then stretches or tiles between neighboring
nodes. Variants change appearance without changing topology; variants whose
sockets do not fit the connected pipes are disabled.

Source: [Core Concepts](https://pipeit-plugin.com/docs/guide/concepts/),
[Editing a Network](https://pipeit-plugin.com/docs/guide/editing-networks/),
[The Kits](https://pipeit-plugin.com/docs/guide/kits/)

Kit authoring makes the compatibility model explicit. Pipe openings are marked
with outward-facing sockets. A straight has two opposite sockets, a corner has
two sockets at roughly 90 degrees, a tee has an opposite pair plus a
perpendicular branch, and a cross has two perpendicular opposite-facing pairs.
Those sockets determine alignment, role recognition, and whether pieces fit.

Source: [Making Your Own Kit](https://pipeit-plugin.com/docs/guide/authoring-kits/)

Deleting also operates on topology: Pipe It removes a node and heals the run,
but refuses a deletion that would make the graph invalid.

Source: [Blueprint API Reference](https://pipeit-plugin.com/docs/guide/blueprint-api/)

## What the current Pascal PVC work already has

The current code contains useful lower-level pieces:

- `buildPipeGeometry` labels rendered segment meshes with `pipeEdgeId`;
- the selected-network affordance contains invisible edge hit volumes;
- `insertPipePoint` splits one edge into two and creates a straight node;
- endpoint `+` handles extend a run;
- endpoint gizmos can move an open endpoint in three axes;
- drawing already includes grid and skimmer-connection snapping.

The remaining mismatch is behavioral:

- selection is still network-level plus local component state, rather than a
  durable node/edge sub-selection;
- clicking an edge currently leads toward an insertion affordance instead of
  making the edge an editable selected element;
- there is no edge-aligned slide/roll gizmo or affected-run preview;
- insertion has no first-class valid/invalid preview or socket-clearance rule;
- `appendPipePoint` currently promotes the old endpoint to `corner`
  unconditionally, rather than deriving its role from connection directions;
- rendering still uses generic cylinders and spheres, so straight, elbow, tee,
  cross, cap, and compatible variants are not yet meaningfully distinct.

## Concrete recommendation

### Next feature: first-class edge selection and segment editing

Implement this as the next independently testable slice:

1. Add a pipe sub-selection value such as
   `{ networkId, element: 'edge', edgeId }` or
   `{ networkId, element: 'node', nodeId }`.
2. Resolve a clicked mesh's existing `pipeEdgeId` into that sub-selection and
   visibly highlight the chosen edge and its two endpoints.
3. Put the gizmo at the edge midpoint with a basis derived from the edge
   direction, never from the camera.
4. Initially support the Pipe It edge operation with the clearest topology:
   slide the section perpendicular to its own axis by moving both endpoint
   nodes by the same delta. Adjacent edges stretch to preserve connectivity.
5. Store edge roll separately from geometry and expose rotation around the
   edge axis as the next small control.
6. During a drag, preview the affected edges and fittings. Commit the whole
   gesture as one undoable update; cancel restores the starting snapshot.
7. Validate every candidate before display/commit: no zero-length edge, no
   edge shorter than the fitting-clearance minimum, and no unsupported node
   configuration.

Acceptance criteria for this slice:

- edge selection survives a click without starting network drag;
- the gizmo orientation remains stable as the camera moves;
- a perpendicular drag moves both segment endpoints by the same local delta;
- neighboring segments remain connected and update live;
- one gesture creates one history entry;
- an invalid drag previews as invalid and cannot be committed.

### Following slice: validated Insert Straight Here

Promote the existing `insertPipePoint` path into the selected-edge workflow:

1. `Shift + LMB` on an edge, plus a context-menu action, starts insertion at
   the closest projected point.
2. Show the candidate straight fitting and both resulting edge spans before
   commit.
3. Reject positions that leave less than the required socket clearance on
   either side.
4. On commit, split the edge, select the new node, and keep the network
   selected. Do not start a whole-network drag.

This should replace the current “click edge, then click a floating plus” as the
primary Pipe It-style path. A visible insertion button can remain as an
optional discoverability aid, but it should invoke the same preview/commit
operation.

### Following slice: branch and automatic fitting promotion

For the newly inserted straight node:

1. Calculate occupied directions from incident edges.
2. Show `+` handles only for legal unoccupied directions.
3. Reuse Draw Mode to preview and add the new branch.
4. Recompute fitting roles after every mutation:
   endpoint, straight, corner/half-corner, tee, or cross.
5. Recompute affected neighboring spans and fittings in the same transaction.

Node `kind` should become derived output, or at minimum be recomputed by one
central topology resolver. Individual mutations should not hard-code “this
node is now a corner.”

### Then: shared snapping and pool connectors

Move extension, insertion, and gizmo movement onto one snapping/validation
service. It should provide:

- graph-local candidate directions;
- world-axis and kit-supported 45/90-degree candidates;
- grid and exact-length constraints;
- projected edge points for insertion;
- minimum fitting-clearance checks;
- optional scene-surface hits;
- typed pool ports for skimmers, returns, drains, pumps, filters, heaters, and
  valves.

A pool port should carry a stable owning-node id, port id, position, outward
normal, nominal diameter, and allowed connection role. Snapping should retain
that reference instead of copying only the current position, so pool geometry
changes can re-resolve the connection. This is our domain-specific analogue to
Pipe It's socket-driven assembly.

### Then: a real PVC fitting kit

Introduce fitting metadata and role-specific geometry only after topology is
being derived consistently. The first useful kit should include cap, straight,
45-degree elbow, 90-degree elbow, tee, cross, reducer/adapter, and
pool-equipment connector. Each entry needs connector/socket transforms and
minimum clearances. A missing compatible fitting should preserve the graph and
show a validation state rather than silently render the wrong piece.

## Recommended delivery order

1. Edge/node sub-selection and selected-edge highlight.
2. Edge-aligned perpendicular slide, roll, preview, validation, and one-step
   undo.
3. Previewed `Insert Straight Here` using the existing split mutation.
4. Branch from the inserted node with legal-direction `+` handles.
5. Central topology-to-fitting resolver.
6. Shared direction/grid/exact-length/surface/port snapping.
7. PVC kit sockets, fitting variants, and minimum-clearance validation.
8. Brackets and flexi pipes later; they are downstream of a stable edge model.

## Official source index

- [Pipe It documentation home](https://pipeit-plugin.com/docs/)
- [Getting Started](https://pipeit-plugin.com/docs/guide/getting-started/)
- [Drawing Pipes](https://pipeit-plugin.com/docs/guide/drawing-pipes/)
- [Editing a Network](https://pipeit-plugin.com/docs/guide/editing-networks/)
- [Core Concepts](https://pipeit-plugin.com/docs/guide/concepts/)
- [The Kits](https://pipeit-plugin.com/docs/guide/kits/)
- [Making Your Own Kit](https://pipeit-plugin.com/docs/guide/authoring-kits/)
- [Runtime Editing](https://pipeit-plugin.com/docs/guide/runtime-editing/)
- [Blueprint API Reference](https://pipeit-plugin.com/docs/guide/blueprint-api/)
- [Keyboard & Mouse Reference](https://pipeit-plugin.com/docs/guide/shortcut-reference/)
- [Pipe It product page](https://pipeit-plugin.com/)
- [Pipe It changelog](https://pipeit-plugin.com/changelog/)
- [Official Fab listing](https://www.fab.com/listings/379dbd74-6b86-4aa5-a9ff-78bf7e394153)
- [Official “Your first five minutes” tutorial](https://www.youtube.com/watch?v=KnlxL9q0j60)
- [Official advanced-features tutorial](https://www.youtube.com/watch?v=PrwoBQUsAgk)
