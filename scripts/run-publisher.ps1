# run-publisher.ps1
# Runs the Global Office → Sanity publisher.
# Can be called directly or via Windows Task Scheduler.

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Script      = Join-Path $PSScriptRoot "publish-global-office.mjs"
$LogFile     = Join-Path $PSScriptRoot "publisher.log"

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content $LogFile "[$Timestamp] Starting publisher run"

try {
    $Output = & node $Script 2>&1
    Add-Content $LogFile $Output
    Write-Output $Output
    Add-Content $LogFile "[$Timestamp] Run complete"
} catch {
    $Err = "[$Timestamp] ERROR: $_"
    Add-Content $LogFile $Err
    Write-Error $Err
    exit 1
}
