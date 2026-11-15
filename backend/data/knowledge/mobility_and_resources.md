# Mobility models and resources

Rover (pressurized, design assumptions):
- Battery capacity 30 kWh, nominal speed 2.5 m/s (slows with slope, never below 25%).
- Consumption: rolling 0.35 kWh/km + climbing energy (3000 kg, Mars gravity 3.721 m/s2,
  80% drivetrain efficiency) + 0.4 kW hotel load while driving or parked.
- Maximum slope 18 degrees.

Astronaut on EVA (suit + life support):
- Oxygen capacity 300 L, nominal walking speed 0.75 m/s (slows with slope, never below 30%).
- Metabolic power from the Pandolf equation (75 kg body, 45 kg load) scaled to Mars gravity
  (0.38 g) and a pressurized-suit penalty of 1.25; oxygen = energy / 20.1 kJ per liter.
- Science tasks at each target cost 220 W for their duration.
- Maximum slope 20 degrees.

return_ok (return margin rule, from the physiology block of the environment data):
the resource used x 1.3 (safety factor) must stay below 80% of capacity (20% reserve).
A route with return_ok = false must not be flown as planned.

Scenario modifiers:
- speed_factor < 1 slows travel (0.7 simulates a dust storm).
- o2_multiplier > 1 increases oxygen use (1.5 simulates a suit leak).
- hazards: circular no-go zones (radius up to 500 m) reported by the crew.
