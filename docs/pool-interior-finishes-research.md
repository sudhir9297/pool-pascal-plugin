# Pool interior finishes

This note records the visual categories behind the implemented
`interiorFinish` options. It is not a product specification or durability guide.

## Visual families

| Family | Visual treatment in the plugin |
| --- | --- |
| Clean plaster | Continuous solid color without cells or aggregate speckle |
| Quartz aggregate | Fine, low-contrast mineral speckle |
| Pebble aggregate | Larger irregular speckles with natural color variation |
| Polished aggregate | Fine aggregate with moderate highlights |
| Glass bead | Aggregate with sparse bright flecks and stronger sparkle |
| Mosaic | Repeating geometric cells with visible grout |

These categories follow the broad finish families described by NPT, CL
Industries, and PebbleTec. Color choices are simulator palettes, not claims that
a manufacturer offers an exact match.

## Implemented options

| Saved value | Family |
| --- | --- |
| `clean-white-plaster` | Clean plaster |
| `clean-pale-blue-plaster` | Clean plaster |
| `white-plaster` | Clean plaster retained as a distinct neutral option |
| `quartz-white` | Quartz aggregate |
| `quartz-blue-gray` | Quartz aggregate |
| `natural-pebble-aqua` | Pebble aggregate |
| `natural-pebble-gray` | Pebble aggregate |
| `polished-aggregate-blue` | Polished aggregate |
| `glass-bead-aqua` | Glass bead |
| `light-mosaic` | Mosaic |
| `blue-mosaic` | Mosaic |
| `dark-mosaic` | Mosaic |

The three plaster values use the solid material path. Quartz, pebble, polished,
glass, and mosaic values use family-specific procedural settings. Unknown input
falls back to `light-mosaic` through `getPoolFinishSettings`.

The saved enum is defined in `src/core/pool-options.ts`; material settings are in
`src/design/pool-finishes.ts`. Add both data and visual tests when introducing a
finish.

## Sources

- [NPT pool finish guide](https://www.nptpool.com/pool-finishes/)
- [CL Industries Pool Finishes 101](https://clindustries.com/pool-finishes-101/)
- [PebbleTec finish overview](https://pebbletec.com/products/pool-finishes/)
- [PebbleTec original finish colors](https://pebbletec.com/products/pool-finishes/pebbletec/)
- [PebbleTec glass tile overview](https://pebbletec.com/products/pebbletec-glass-tile/)
