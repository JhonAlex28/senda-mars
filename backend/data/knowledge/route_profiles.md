# Route profiles and the planner

Routes are computed with A* on a terrain grid (rover: 16 m cells over the whole site; EVA:
3 m cells in a window around the stops with a 120 m margin). Waypoints are chained in order.

Each profile uses a different step cost:
- fast: only travel time. Shortest duration, accepts steeper ground.
- safe: travel time strongly penalized by slope risk (weight 6) and by being within 40 m of a
  hazard zone (penalty x2). Longer but keeps away from steep ground and hazards.
- scientific: moderate slope penalty (weight 1.5) and a 0.7 cost multiplier near the science
  targets, so the path passes close to them with the smallest detour.

Slope risk is 0 up to 10 degrees (caution threshold) and grows linearly to 1 at the mode's
maximum slope (rover 18 degrees, EVA 20 degrees). Cells steeper than the maximum, or inside a
hazard zone, are impassable. If no passable path exists the planner reports "No passable route".

Metrics of every route:
- distance_m, duration_min (travel + on-site task time)
- max_slope_deg, obstacles (number of separate stretches steeper than 10 degrees)
- safety_pct = 100 x (1 - share of distance above 10 degrees) x (1 - 0.5 x slope risk of the max slope)
- resource remaining_pct and return_ok (see mobility_and_resources)
