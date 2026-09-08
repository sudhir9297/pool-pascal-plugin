# Pool fitting layout research

Checked 8 September 2026. These references support automatic **planning estimates**. They do not establish a complete hydraulic design or compliance with the rules at a particular project location.

| Item | Planning calculation | Basis |
| --- | --- | --- |
| Skimmers | `max(1, ceil(surfaceAreaM2 / 25))` | AstralPool manufacturer guidance |
| Return inlets | `max(2, ceil(surfaceAreaM2 / 27.870912), ceil(perimeterM / 6.096))` | Georgia public-pool count benchmark |
| Floor drains | `max(2, ceil(designFlowM3h / 13) + 1)` | Assumed 13 m³/h fitting capacity, with one fitting unavailable |
| Stairs | One automatic stair | Product choice requested by the user |

## Skimmers

AstralPool recommends one skimmer per 25 m² of water surface and placement opposite return inlets. Its installation manual places one or two skimmers across the width at the deep end; three or more go on a length side. It also calls for considering prevailing winds and circulation. Equal spacing on the selected wall is an application layout choice; these sources do not give a universal distance between skimmers. [AstralPool skimmers](https://www.astralpool.com/en/en/pool-shell-equipment/skimmers.html), [AstralPool installation manual](https://fluidra.bynder.com/m/4c6fe134eada92b/original/installationmanual_skimmer175lpanelprotect_ALL_2021_12.pdf).

Manufacturer recommendations vary. Pentair's U-3 manual uses one per 500 ft², approximately 46.45 m². The application deliberately chooses the AstralPool 25 m² guide. The Pentair manual also calls for at least two main drains separated by at least three feet. [Pentair U-3 installation guide](https://www.pentair.com/content/dam/extranet/nam/pentair-pool/pool-manuals/u-3-skimmers/395010028C.pdf).

## Return inlets

Georgia rule 511-3-5-.10 requires at least two returns, with count based on the greater of one per 300 ft² of surface or one per 20 ft of perimeter. It also specifies wall returns within five feet of corners and at least five feet from skimmers, and requires distribution that promotes uniform circulation. This is a public-pool rule, used here as a documented planning benchmark rather than a claim about residential requirements everywhere. [Georgia official rules](https://rules.sos.ga.gov/GAC/511-3-5).

The exact metric conversions are 27.870912 m² and 6.096 m. Distributing that count around the perimeter does not by itself prove a maximum gap after fittings are moved away from corners, skimmers, or stairs. It also does not demonstrate uniform circulation in concave pools. The generated arrangement remains editable.

## Drains and flow

Fluidra lists 13 m³/h for its AstralPool 01467 drain. This is an explicit planning capacity, not a rating for every drain model or a certification of the rendered asset. [Fluidra product specification](https://www.fluidra.co.th/en/product/item/01467).

Washington's WAC 246-260-031 requires at least two main drains, separation of at least three feet measured between cover centers, and enough remaining rated capacity for the maximum pump flow when one drain is blocked. It locates drains at low points and also specifies manifold piping. The count formula above applies that remaining-capacity principle to the assumed rating. These are Washington water-recreation-facility rules, not a universal residential specification. [Washington official rule](https://app.leg.wa.gov/WAc/default.aspx?cite=246-260-031).

Use 0.9144 m as the sourced minimum center separation. If the pool cannot fit the selected count with that separation, report the placement limitation rather than silently squeeze the drains together. Additional drains need not come in pairs; three or more can share an appropriately designed suction system.

For an initial estimate, `designFlowM3h = poolVolumeM3 / 6`. AstralPool's pump-sizing article identifies six hours for outdoor residential turnover and four hours for indoor pools. Its opening also mentions a general eight-hour guide, so six hours is a stated outdoor-pool assumption, not a universal standard. [AstralPool pump sizing](https://www.astralpool.com.au/blog/what-size-pump-do-I-need-for-my-pool).

Turnover-derived flow is not necessarily the pump's maximum possible flow. Allow the designer to override it. Final suction design requires the selected covers' ratings, actual maximum system flow, plumbing layout, and applicable requirements. Pool width alone cannot determine this count.

## Implemented behavior

New pools enable `automaticFittings`. Existing saved pools keep manual mode until this option is enabled. Turning it off retains the generated nodes and allows individual placement or deletion. Manually added fittings are preserved and are additional to the calculated layout.

Pool options display generated counts, water area and design flow. `turnoverHours` defaults to 6. `fittingFlowRate = 0` uses estimated water volume divided by turnover; a positive value overrides it. `drainFlowCapacity` defaults to 13 m³/h and should be replaced with the selected outlet's rating. Water volume uses triangle-centroid integration over the outline and floor depth, with the waterline offset. Slopes are approximated; benches and entry features are not subtracted.

Skimmers use the actual polygon area. One or two target the +X end, the deep end for this plugin's sloped pools. Larger groups target a long side. Skimmers remain on the selected outward-facing side; return inlets are evenly targeted on the opposite side. If these sides cannot fit the calculated quantities, Pool options reports the shortage instead of scattering the remaining fittings around the perimeter. Returns stay at least 1.524 m from generated skimmer centers. Other generated wall fittings use a 0.65 m center clearance chosen for the default asset sizes. These layout choices do not model prevailing wind or certify circulation, corner coverage, maximum return gaps or compliance with every clause of the cited public-pool rule.

Drains form an evenly spaced straight row with 1 m between centers. For flat rectangular pools the group is centered in the basin. For sloped pools it is centered across the deep-floor region. Irregular outlines search for a straight row contained in one interior region, with all drains at the same floor depth. Straight alignment and the 1 m target are application layout choices; the sourced minimum separation remains 0.9144 m. Their covers keep a margin from the wall and cove, and all generated drain centers stay at least 0.9144 m apart. If the requested count cannot fit, the generator omits the drain group and displays the reason in Pool options. It never reduces the required spacing or leaves one generated drain.

Resize updates counts and positions in the scene. Stable generated IDs preserve names and fitting appearance when a slot survives. Shrinking removes surplus generated slots only. Turning automatic layout on for an older pool does not adopt or delete its existing manually identified attachments.

Automated checks cover creation, resize and shrink reconciliation, restored scene snapshots, manual mode, flow thresholds, actual polygon area, floor depth and drain spacing. The installed `@pascal-app/core` beta's generic node parser throws `Duplicate discriminator value "undefined"` under this repository's dependency set; the scene-subscription test uses a store adapter, so host parsing and end-to-end UI operation remain unverified.

## Placement clarification

The AstralPool manual explicitly groups one or two skimmers on the deep-end width wall and three or more on one length side, opposite the returns. Wind and pool shape may require a different design; being on the same wall is the selected manufacturer's general layout guidance, not a universal rule for all pools. [AstralPool manual, page 2](https://fluidra.bynder.com/m/4c6fe134eada92b/original/installationmanual_skimmer175lpanelprotect_ALL_2021_12.pdf).

Drains should serve the lowest floor region rather than always occupying the geometric center. Pentair's AVSC installation guide locates its drain centrally in the deepest region. Its StarGuard guide illustrates two hydraulically balanced outlets separated by at least three feet center to center. These support deep-region placement and separation, but do not make collinearity a universal requirement. Our symmetric row is a deliberate, predictable layout convention. [Pentair AVSC guide](https://flowandfiltrationsolutions.pentair.com/content/dam/extranet/nam/pentair-pool/residential/in-floor-cleaning-and-circulation/avsc-heavy-debris-removal/user-docs/avsc-drain-install-and-user-guide.pdf), [Pentair StarGuard guide](https://www.pentair.com/content/dam/extranet/nam/pentair-pool/residential/white-goods/starguard/starguard-8-inch-main-drain-installation-guide-english.pdf).
