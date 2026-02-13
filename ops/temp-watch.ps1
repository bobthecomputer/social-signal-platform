param(
  [int]$GpuWarnC = 70,
  [int]$GpuCritC = 78,
  [double]$ThermalWarnC = 70,
  [double]$ThermalCritC = 78,
  [double]$CpuWarnPct = 85
)

$ErrorActionPreference = 'SilentlyContinue'

$base = 'C:\Users\paul\Projects\social-signal-platform\data'
if (-not (Test-Path $base)) { New-Item -ItemType Directory -Path $base | Out-Null }

$logPath = Join-Path $base 'temp-log.csv'
$statePath = Join-Path $base 'temp-state.json'
$hotFlag = Join-Path $base 'hot.flag'

function Get-GpuTemp {
  $nvsmi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
  if (-not $nvsmi) { return $null }
  $line = (& nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits | Select-Object -First 1)
  if (-not $line) { return $null }
  $val = 0
  if ([int]::TryParse(($line.Trim()), [ref]$val)) { return $val }
  return $null
}

function Get-ThermalZoneC {
  $obj = Get-CimInstance -ClassName Win32_PerfFormattedData_Counters_ThermalZoneInformation -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $obj) { return $null }

  $raw = [double]$obj.Temperature
  # On this machine, Win32_PerfFormattedData_Counters_ThermalZoneInformation appears to report tenths of °C.
  return [Math]::Round(($raw / 10.0), 1)
}

function Get-CpuUtil {
  $cpus = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue
  if (-not $cpus) { return $null }
  $vals = $cpus | ForEach-Object { [double]$_.LoadPercentage }
  if (-not $vals.Count) { return $null }
  return [Math]::Round((($vals | Measure-Object -Average).Average), 1)
}

$now = (Get-Date).ToString('o')
$gpu = Get-GpuTemp
$tz = Get-ThermalZoneC
$cpu = Get-CpuUtil

$level = 'ok'
if (($gpu -ne $null -and $gpu -ge $GpuCritC) -or ($tz -ne $null -and $tz -ge $ThermalCritC)) {
  $level = 'critical'
} elseif (($gpu -ne $null -and $gpu -ge $GpuWarnC) -or ($tz -ne $null -and $tz -ge $ThermalWarnC) -or ($cpu -ne $null -and $cpu -ge $CpuWarnPct)) {
  $level = 'warn'
}

if (-not (Test-Path $logPath)) {
  'timestamp,gpuC,thermalZoneC,cpuUtilPct,level' | Out-File -FilePath $logPath -Encoding utf8
}
"$now,$gpu,$tz,$cpu,$level" | Out-File -FilePath $logPath -Append -Encoding utf8

$state = [ordered]@{
  timestamp = $now
  gpuC = $gpu
  thermalZoneC = $tz
  cpuUtilPct = $cpu
  level = $level
}
$state | ConvertTo-Json | Out-File -FilePath $statePath -Encoding utf8

if ($level -eq 'critical') {
  Set-Content -Path $hotFlag -Value "critical at $now" -Encoding utf8
} elseif (Test-Path $hotFlag) {
  Remove-Item $hotFlag -Force
}

# Thermal mitigation.
if ($level -eq 'warn') {
  Get-Process -Name rustc,cargo,cl,link,msbuild -ErrorAction SilentlyContinue | Stop-Process -Force
  powercfg /setacvalueindex scheme_current SUB_PROCESSOR PROCTHROTTLEMAX 45 | Out-Null
  powercfg /setactive scheme_current | Out-Null
}

if ($level -eq 'critical') {
  Get-Process -Name rustc,cargo,cl,link,msbuild,python -ErrorAction SilentlyContinue | Stop-Process -Force

  powercfg /setacvalueindex scheme_current SUB_PROCESSOR PROCTHROTTLEMAX 35 | Out-Null
  powercfg /setactive scheme_current | Out-Null
}
