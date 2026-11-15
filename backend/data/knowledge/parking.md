# Rover parking spots

The rover does not drive onto the outcrops. Targets are grouped greedily into walking zones:
each zone starts at the highest-priority pending target and takes every target within 300 m.
For each zone the planner looks, within 250 m of the zone centre, for the closest cell that is
flat (slope at most 10 degrees), outside hazard zones and at least 70 m from every target.
Parking spots are named P1, P2... in priority order and list the targets they serve.
The walking EVA starts and ends at the parking spot.
