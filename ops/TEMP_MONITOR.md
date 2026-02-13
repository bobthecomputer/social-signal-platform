# Temperature Monitor (night safety)

## What is set up

- Script: `ops/temp-watch.ps1`
- Scheduled task: `OpenClaw-TempWatch`
- Frequency: every **1 minute**

## Data files

- Latest state: `data/temp-state.json`
- Log history: `data/temp-log.csv`
- Critical flag file: `data/hot.flag` (exists only on critical state)

## Current thresholds

- GPU warn: 75°C
- GPU critical: 82°C
- Thermal zone warn: 70°C
- Thermal zone critical: 78°C
- CPU usage warn: 85%

## Critical mitigation

On critical state, script will try to stop obvious heavy local build processes:
- `rustc`, `cargo`, `cl`, `link`, `msbuild`

(Does **not** directly change fan speed; fan control is hardware/vendor specific.)
