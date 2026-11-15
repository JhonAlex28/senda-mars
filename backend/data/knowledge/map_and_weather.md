# Map layers and the weather card

## Layers (left panel)
Each layer has an on/off switch and, when on, an opacity slider. A dot tells where the data comes from:
measured (instrument data), modeled (computed) or assumed.

- **Terrain**: real elevation from the USGS MSL Gale Merged DEM (1 m, HiRISE + CTX + MOLA).
- **Slope**: computed from that DEM. Orange = steeper than 10 degrees (caution), red = steeper than
  18 degrees (too steep for the rover). The slider hides gentle slopes.
- **Science targets**: the rocks you can visit.
- **Routes**: the planned rover and walking routes.
- **Danger zones**: circles marked by the crew that routes avoid.
- **Orbital photo**: real NASA Mars Trek imagery (MRO CTX, 6 m per pixel; Viking as fallback).
  Needs internet. Lower the Terrain opacity to see it better.
- **Minerals**: Mount Sharp rock units drawn by elevation band (a model, not a measurement).
- **Radiation shelter**: steep walls and slopes that block part of the radiation (an estimate).

The readout at the bottom of the map shows latitude, longitude, height, slope and ground under the cursor.

## Weather card (left panel)
**Right now** shows the real measurements of the current sol, from Curiosity's REMS (temperature,
wind) and RAD (radiation) instruments and Mastcam (dust): a plain word, the value and a face for
each one, plus the overall verdict GO / CAUTION / NO GO. It is one snapshot of the current sol,
not a forecast.

**Try a scenario** (collapsed) is a practice simulator: dust in the air, time of day and a solar
flare. Its numbers are estimates, not measurements. It changes the final launch check (a solar
flare forces NO GO) but not the computed routes. **Back to normal** resets it.

The **battery to come back** bar under the weather card shows the rover battery left at the end of
the chosen route.
