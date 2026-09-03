# Pool return inlet

This directory is for the pool return inlet, also called a return jet or
return fitting. It is the wall fitting that sends filtered water back into the
pool.

Planned layout:

```text
inlet/
  core/       schema, node definition, and geometry
  design/     wall placement and pipe connection logic
  editor/     placement tool, preview, and parametrics
```

The first inlet node is registered as `pool:inlet`. Its wall position follows
the linked pool, and its rear socket is ready for PVC pipe connections.
