# PVC pipe workflow research

## Scope

This note translates the publicly advertised Pipe-It workflow into a design for
the Pascal pool plugin. Pipe-It is a commercial product, so its internal code
and exact algorithms are not public. Claims below are limited to behavior
described by the vendor and Fab listing; implementation details marked
"proposed" are our design recommendations.

## What Pipe-It exposes to users

The core interaction is draw-first: the user clicks and draws a run through the
level, with clean-direction snapping and optional exact numeric length. The
network remains editable after placement. The advertised edit operations are
extrude, branch, insert, and delete, with the surrounding layout updating as
the network changes. [Fab listing](https://www.fab.com/listings/379dbd74-6b86-4aa5-a9ff-78bf7e394153)

Junctions are treated as upgradeable graph nodes. A straight can become a
corner, tee, or cross; an existing section can be branched without redrawing
the network; and connected runs stretch to the new junction automatically.
[Pipe-It product site](https://pipeit-plugin.com/)

The rendered result is assembled from a kit rather than from one monolithic
mesh. A kit contains straights, corners, tees, crosses, end caps, and variants.
Changing the kit re-skins the network while preserving its layout. Pipe-It also
advertises authoring custom pieces by marking sockets, bracket anchors, and
hinges on a mesh, with validation before the piece enters a kit. [Pipe-It
product site](https://pipeit-plugin.com/)

Scene attachment is a separate concern from network topology. The product
advertises surface snapping for brackets and automatic re-attachment when
nearby level geometry moves. The Fab listing also describes Ctrl-assisted
surface snapping while drawing. [Fab listing](https://www.fab.com/listings/379dbd74-6b86-4aa5-a9ff-78bf7e394153)

For delivery, Pipe-It advertises instanced runtime rendering, baking to static
mesh/components/ISMs, conversion to reusable Blueprints, and a runtime editing
API with ghost previews, batched undo/redo, and save/load. These are useful
long-term targets, but are not required for the first Pascal implementation.
[Fab listing](https://www.fab.com/listings/379dbd74-6b86-4aa5-a9ff-78bf7e394153)

## What the current plugin already provides

The pool is currently one `pool:pool` node with a custom editor tool. It has:

- click-to-place presets and click/Enter/double-click polygon drafting;
- grid and angle snapping;
- construction-plane and slab snapping;
- live draft previews;
- parametric fields and direct manipulation handles;
- scene `createNode`, `updateNode`, and batched update patterns from the Pascal
  editor ecosystem.

The README explicitly says that pipes and fittings are not registered yet. The
pool's `children` field exists, but it is not a pipe-network model and should
not be overloaded for this purpose.

## Recommended Pascal design

### 1. Use one editable `pool:pipe-network` node per connected run

Do not create one scene node per straight segment. Store the topology as one
network node so a branch, delete, kit swap, or fitting change is a single
undoable scene operation.

Suggested data shape:

```ts
type PipePoint = [number, number, number]

type PipeNode = {
  id: string
  type: 'pool:pipe-network'
  parentId: string | null
  position: PipePoint
  rotation: PipePoint
  kitId: string
  diameter: number
  elevationMode: 'fixed' | 'surface-following'
  nodes: Array<{
    id: string
    position: PipePoint
    kind: 'endpoint' | 'corner' | 'tee' | 'cross' | 'custom'
    variant?: string
  }>
  edges: Array<{
    id: string
    from: string
    to: string
    controlPoints?: PipePoint[]
    style: 'rigid' | 'smooth'
    variant?: string
  }>
  accessories: Array<{
    id: string
    edgeId: string
    distance: number
    kind: 'valve' | 'cap' | 'bracket' | 'pump-connection'
    variant?: string
  }>
}
```

The exact field names can change, but the graph distinction matters: nodes are
connection points, edges are runs, and accessories are attached to runs or
connection points. Keep positions in level-local coordinates, as the pool
tool already does for drawn geometry.

### 2. Make the first UX a two-click “draw and extend” tool

The MVP interaction should be:

1. Select PVC pipe and choose diameter/kit in the panel.
2. Move the cursor: show a ghost run from the active endpoint, with direction,
   length, and connection preview.
3. Click to place the first point.
4. Move and click to add each next point. Snap to grid, 90-degree/45-degree
   directions, pool fittings, and scene surfaces.
5. Click an existing endpoint or press Enter to finish. Esc cancels the active
   draft.
6. If the first click is on an existing endpoint or edge, enter extend/branch
   mode instead of creating an unrelated network.

This should feel like the existing pool drawing tool, but commit only the graph
on completion. During drafting, render ghost segments and a fitting preview;
do not create temporary scene nodes for every mouse move.

### 3. Derive fittings from topology

At render/compile time, calculate each node's incident edge directions. Use the
incident count and angles to choose the fitting:

- one incident edge: end cap or connection socket;
- two collinear edges: straight continuation;
- two non-collinear edges: corner/elbow;
- three edges: tee;
- four edges: cross.

If the kit lacks a required piece, preserve the graph and show a visible
validation warning rather than silently producing a broken joint. This mirrors
Pipe-It's kit-driven behavior while keeping the scene data resilient.

### 4. Implement edit operations as graph mutations

The minimum edit vocabulary should be explicit and testable:

- `appendEdge(endpoint, point)` — extend a run;
- `insertNode(edge, position)` — split a run and preserve both lengths;
- `moveNode(node, position)` — update adjacent edges and recompute fittings;
- `deleteNode(node)` — remove or merge according to a clear policy;
- `branch(edgeOrNode, point)` — split an edge and add a new branch;
- `setKit(network, kitId)` — change appearance only;
- `addAccessory(edge, distance, kind)` — add valve, cap, bracket, or pool
  connection.

Each pointer gesture should be one `updateNode`/`updateNodes` commit so undo
does not contain dozens of mouse-move states. The editor already uses this
batched-update pattern for direct manipulation.

### 5. Connect pipes to pool features, not just arbitrary geometry

For this plugin, the useful “smart endpoints” are pool-specific:

- skimmer;
- return jet;
- main drain;
- pump/filter equipment connection;
- heater or waterfall connection in later phases.

Represent these as typed connection ports with position, normal, diameter, and
allowed flow direction. When a pipe endpoint enters the port tolerance, snap
and show a connected state. A connected port should be a reference by stable
pool/feature ID, not a copied position, so changing pool dimensions can update
the attachment.

This is where the existing pool opening/level-coordinate code is valuable: the
port resolver can use the same local-to-world coordinate conventions and slab
construction-plane logic.

### 6. Separate visual PVC from future hydraulic simulation

The first release should solve geometry and UX only. Store optional metadata
such as nominal diameter, connected feature, and flow direction now, but do not
couple rendering to pressure/flow simulation. A later hydraulic graph can read
the same nodes and edges.

## Suggested delivery phases

### Phase 1: visible PVC runs

Add a PVC kit schema, a pipe-network node, draw/extend tool, straight/corner/end
cap assembly, selection, deletion, and parametric diameter/material controls.

### Phase 2: production editing

Add node handles, insert, branch, move, tee/cross derivation, numeric length,
variant cycling, and connected pool ports. Add focused tests for graph
mutations and fitting selection.

### Phase 3: accessories and polish

Add valves, brackets/supports, surface-following placement, kit swapping, and
better validation/ghost previews.

### Phase 4: output and simulation

Add instanced/baked output if performance requires it, save/load stability, and
optional hydraulic behavior.

## Important decisions before implementation

The first implementation should decide whether pipes are strictly level-local
or can move vertically in 3D. For swimming-pool plumbing, support both plan
view drawing and explicit elevation edits; do not infer a 3D route from a flat
floorplan alone.

It should also decide the initial kit scope. I recommend one complete PVC kit:
straight, 90-degree elbow, 45-degree elbow, tee, cross, reducer, union, cap,
and pool-port connector. A smaller kit makes the UX appear broken as soon as a
branch or diameter change is attempted.

## Source limitations

The official documentation domain redirects through the product site and was
not fetchable as text in this research pass. The vendor site and Fab listing
provide the behavior claims above, but not the internal data model, snapping
tolerances, fitting-selection algorithm, or mesh-authoring file format. Those
details should be treated as recommendations to reproduce the UX, not claims
about Pipe-It's implementation.
