# Pool interior finish options

Research notes for expanding the swimming-pool `interiorFinish` visual presets.

## Finish families to represent

| Visual family | Appearance | Suggested simulator treatment |
| --- | --- | --- |
| Clean plaster | Completely continuous surface with no visible pattern | One solid color; no tile cells or aggregate speckles |
| Tinted plaster | Smooth surface with a subtle blue, gray, sand, or white tint | Solid base color with very low-frequency tonal variation |
| Quartz aggregate | Fine, restrained mineral speckle; more visual depth than plaster | Small low-contrast speckles, no grid pattern |
| Pebble aggregate | Clearly natural, textured stone appearance | Larger irregular speckles with restrained color variation |
| Polished aggregate | Smooth, refined surface with soft mineral variation and some shine | Fine aggregate plus a modest specular response |
| Glass bead | Bright, reflective points with more sparkle and water-color shift | Sparse bright flecks and stronger specular highlights |
| Mosaic/tile | Repeating, intentionally geometric pattern | Existing tiled treatment; support small and larger tile scales |

These families are consistent with the finish categories described by NPT and CL Industries, which distinguish plaster, quartz, pebble, polished, and glass-bead/aggregate finishes. PebbleTec similarly separates natural pebble, refined pebble, quartz, and glass-bead-enhanced finishes.

## Color directions

Useful starting palettes are:

- Arctic white / soft white
- Light blue / aqua blue
- Slate blue / deep blue
- Seafoam / emerald green
- French gray / moonlight gray
- Sandy beige / desert gold
- Charcoal / black pearl

These are representative directions rather than claims that every manufacturer offers every exact shade. PebbleTec's published color examples include white, gray, blue, green, sandy, and black families.

## Recommended product options for this plugin

The first expanded set should be:

1. Clean white plaster
2. Clean pale-blue plaster
3. Quartz white
4. Quartz blue-gray
5. Natural pebble aqua
6. Natural pebble gray
7. Polished aggregate blue
8. Glass bead aqua sparkle
9. Light mosaic
10. Blue mosaic
11. Dark mosaic

The clean plaster choices should not call the tile shader at all. That is the important distinction from the current `white-plaster`, which still receives a tiled/patterned material path.

## Sources

- [NPT pool finish guide](https://www.nptpool.com/pool-finishes/) — identifies plaster, quartz, pebble, glass bead, and polished finish families.
- [NPT finish selection guide](https://tst.nptpool.com/resources/blog/how-to-pick-the-perfect-pool-finish/) — describes plaster, quartz, pebble, glass, polished, and color-oriented product lines.
- [CL Industries Pool Finishes 101](https://clindustries.com/pool-finishes-101/) — describes plaster, quartz, pebble, and polished aggregate as distinct finish types.
- [PebbleTec finish overview](https://pebbletec.com/products/pool-finishes/) — distinguishes natural pebble, quartz, refined aggregate, and glass-bead-enhanced finishes.
- [PebbleTec original finish colors](https://pebbletec.com/products/pool-finishes/pebbletec/) — provides examples across blue, green, gray, white, black, and sandy color families.
- [PebbleTec glass tile overview](https://pebbletec.com/products/pebbletec-glass-tile/) — provides white/beige, blue, and dark-blue glass directions with an iridescent appearance.
