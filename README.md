# RLV Lander

RLV Lander is a single-player browser game about recovering a reusable first-stage booster. It combines the feel of a classic lunar-lander game with a two-dimensional, Earth-centered flight model and two recovery missions:

- **ASDS — Autonomous Spaceport Drone Ship:** brake an overshooting downrange arc while the ship repositions beneath the estimated coast impact, then land on its 90 m deck.
- **RTLS — Return to Launch Site:** flip, perform a boost-back burn, and return to an 80 m pad.

The game is an unofficial educational project. Its vehicle and engine values are representative approximations, not an exact model of Falcon 9 or any real flight.

## Play and controls

Select a mission from the briefing, then use:

| Input | Action |
| --- | --- |
| Up / Down | Increase or decrease throttle |
| Left / Right | Command pitch using RCS and grid fins |
| Space | Deploy the landing legs once |
| P or Escape | Pause or resume |
| R | Restart the mission |
| Speed button | Cycle simulation speed through 1×, 2×, 5×, 10×, and 20× |
| Base / Zoom / Auto | Select a fixed wide view, fixed landing view, or automatic approach zoom |

Touch controls provide the same flight commands on smaller screens.

Each mission has two flight profiles. **Standard** keeps the original reserves and touchdown limits. **Easy** adds propellant and RCS endurance, lowers the minimum throttle, widens the landing zone, raises the leg deployment limit, and allows gentler practice margins. Best scores are stored separately for each profile. The camera defaults to **Auto**.

Grid fins need airflow: their force scales with dynamic pressure. Cold-gas RCS provides control in thin air but has a finite reserve. In Standard, deploying the legs above 5 kPa breaks them, and touchdown limits are 2.5 m/s lateral speed, 3 m/s downward speed, 5° tilt, and 5°/s angular rate. Easy raises those limits to 10 kPa, 5 m/s, 6 m/s, 10°, and 10°/s respectively.

## Local development

Requirements: Node.js 22 and pnpm 11.

```bash
pnpm install
pnpm dev
```

Vite serves the project beneath `/RLVLander/`, matching its GitHub Pages project path.

Quality checks:

```bash
pnpm check
```

This runs linting, TypeScript checking, deterministic simulation tests, and a production build. The production files are written to `dist/`.

## Simulation model

- A fixed 120 Hz simulation step with render interpolation and a clamped frame accumulator.
- SI units internally; display conversions happen only in telemetry formatting.
- Inverse-square gravity in a two-dimensional Earth-centered plane with a curved surface.
- An interpolated 0–120 km atmosphere table for density, pressure, speed of sound, Mach, and dynamic pressure.
- Body drag, aggregate grid-fin normal and axial forces, a changing pitch moment of inertia, propellant mass flow, and pressure-dependent thrust and specific impulse.
- Axial thrust only—there is no thrust-vector control. Three engines are available above 15 km and the center engine below it.
- Dynamic-pressure blending between finite cold-gas RCS and grid-fin pitch control.
- Positive tail-first static margin with aerodynamic pitch damping during atmospheric flight.
- A gravity-only trajectory estimate recalculated twice per simulated second for the minimap.
- A drag-aware coast-impact estimate drives the ASDS station-keeping controller. The ship has capped speed and acceleration, and touchdown lateral speed is measured relative to the moving deck.

The camera offers a fixed Base scale, a fixed close Zoom scale, and an Auto mode that transitions smoothly as altitude and target distance fall. The altitude-responsive sky, RCS jets, reentry shock/plasma envelope, and departing second stage are presentation effects driven by deterministic flight state; they do not add hidden forces to the simulation.

The pure simulation transition lives in `src/sim/simulation.ts`; scenario data is in `src/sim/scenarios.ts`. Rendering is performed on an HTML Canvas, while React supplies the mission briefing, HUD, touch controls, pause screen, and debrief.

## Scenario calibration

The bundled scenario values are gameplay-tuned against qualitative reference envelopes:

- The initial passive ASDS trajectory overshoots the ship. The ship can chase the estimate within limited speed and acceleration, while the player uses drag and retroburn to close the remaining gap.
- Passive RTLS flight misses the launch site by more than 200 km, so a boost-back is required.
- RTLS produces the higher peak Mach number and dynamic pressure.
- A deterministic test controller can land both missions with positive main-propellant and RCS reserves.

The seed values differ from an exact historical trajectory where needed to preserve a playable 2–4 minute mission. Raw trajectory CSV data can replace the qualitative calibration later.

## References

- Lee et al. (2020), *Aerodynamic Characteristics of the Grid Fins on SpaceX Falcon 9*: [`reference_files/2020_Lee et al._Aerodynamic Characteristics of the Grid Fins on SpaceX Falcon 9.pdf`](reference_files/2020_Lee%20et%20al._Aerodynamic%20Characteristics%20of%20the%20Grid%20Fins%20on%20SpaceX%20Falcon%209.pdf). The v1 aggregate fin model digitizes the side-fin trend as a Mach-independent normal coefficient and uses a constant axial coefficient.
- Supplied qualitative trajectory plots: [`reference_trajectory/`](reference_trajectory/). The written mission identification is authoritative: the higher-Mach trace is treated as RTLS pending raw data.

## GitHub Pages deployment

The repository includes `.github/workflows/deploy-pages.yml`. On every push to `main`, GitHub Actions installs dependencies, runs all checks, builds the site, and deploys `dist/` through the official Pages artifact and deployment actions.

After pushing the repository to GitHub:

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push `main` or run the **Deploy to GitHub Pages** workflow manually.

The project URL will be `https://<owner>.github.io/RLVLander/`. If the repository is renamed, update `base` in `vite.config.ts` to match the new `/<repository-name>/` path.

## License

[MIT](LICENSE)
