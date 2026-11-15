# EVA readiness (go / caution / no_go)

The verdict is the worst of four checks on the current environment snapshot:

| Check | Value used | caution at | no_go at | Source |
|---|---|---|---|---|
| Cold | mean temperature in the EVA window | below -40 C | below -60 C | Curiosity REMS |
| Wind | wind speed | 10 m/s | 20 m/s | Curiosity REMS |
| Dust | atmospheric optical depth (tau) | 1.0 | dust storm tau (3.5) | Mastcam |
| Radiation | GCR dose per sol | 1 mSv | 10 mSv | Curiosity RAD |

Data is a single snapshot of the current sol (sol, local solar time, pressure, temperatures and
detailed blocks). There is no forecast: plans for "tomorrow" assume today's conditions.
