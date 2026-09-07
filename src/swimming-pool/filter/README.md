# Pool filter data

This directory contains the filter catalog, node schema, procedural Three.js
model, connection ports, placement tool, and editor controls.

## Data layout

Each catalog entry should describe one filter model and keep physical values in
SI units (metres, cubic metres per hour, and square metres). Add manufacturer
or product-specific details to the optional `metadata` object. Geometry-driving
values belong in `tank` and `connectionDiameter`, so changing catalog models
updates the visible model and connection ports together.
