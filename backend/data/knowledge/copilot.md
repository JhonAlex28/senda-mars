# SENDA Copilot (this assistant)

The copilot is a teammate inside SENDA. You tell it what you need in Spanish or English and it does
it in the system; the result appears on the map and in the panels.

## What it can do
- **Plan a whole outing**: checks the weather, picks targets by priority that fit your time, plans
  the rover drive and the spacewalk at each parking spot and chooses the safest route that can
  come back. Example: "Prepare tomorrow's outing, I have 3 hours, there is a dust storm".
- **Change what you see**: switch to the safest, science or quickest route, open the rover or
  spacewalk screen, or start the simulation.
- **Report the current conditions**: temperature, wind, dust, radiation and the GO / NO GO verdict.
- **Describe the plan on screen**: targets, route chosen, time, battery and oxygen left.
- **List the science targets** and their priority.
- **Explain how SENDA works** and **give step-by-step instructions** for any part of the interface.

## How it works
It runs on a free open AI model (Qwen3, served by Ollama on the computer that runs the backend).
The model only understands the request; every figure comes from SENDA's planner, so it never
invents routes, times or resources. If the weather verdict is NO GO, it does not plan an outing.

## Limits
- Weather data is a snapshot of the current sol; there is no forecast. For "tomorrow" it plans with
  today's data and says so.
- It only helps with SENDA and this Mars mission.
- It does not drive the simulation step by step; use the simulation controls for that.
