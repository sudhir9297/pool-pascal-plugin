# Pool filter data

This directory is reserved for swimming-pool filter data. Keep filter product
and specification data in `data/`; runtime filter behavior can be added under
`core/`, placement and connection logic under `design/`, and editor-only code
under `editor/` as the filter item is implemented.

## Data layout

Each catalog entry should describe one filter model and keep physical values in
SI units (metres, cubic metres per hour, and square metres). Add manufacturer
or product-specific details to the optional `metadata` object instead of
changing the shared shape for one model.

