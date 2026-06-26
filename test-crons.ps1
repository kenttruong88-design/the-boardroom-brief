# test-crons.ps1
# Full cron test runner for The Boardroom Brief
# Usage: .\test-crons.ps1
# Usage (include newsletter): .\test-crons.ps1 -SendNewsletter

param(
    [switch]$SendNewsletter  # Pass -SendNewsletter to also trigger the email blast
)

$BASE    = "http://localhost:3000"
$SECRET  = "boardroom-cron"
$HEADERS = @{ "Authorization" = "Bearer $SECRET" }

$pass = 0
$fail = 0

function Write-Header($title) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor DarkGray
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor DarkGray
}

function Invoke-Cron($label, $path, $timeoutSec = 30) {
    Write-Host ""
    Write-Host "-> $label" -ForegroundColor Yellow
    Write-Host "   GET $BASE$path" -ForegroundColor DarkGray

    $start = Get-Date
    try {
        $resp = Invoke-RestMethod `
            -Uri "$BASE$path" `
            -Method GET `
            -Headers $HEADERS `
            -TimeoutSec $timeoutSec `
            -ErrorAction Stop

        $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)
        Write-Host "   OK  ${elapsed}s" -ForegroundColor Green
        $resp | ConvertTo-Json -Depth 4 | ForEach-Object {
            Write-Host "   $_" -ForegroundColor DarkGray
        }
        $script:pass++
    } catch {
        $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)
        Write-Host "   FAIL ${elapsed}s -- $_" -ForegroundColor Red
        $script:fail++
    }
}

# --- 0. Health check -----------------------------------------------------------
Write-Header "0 / 5  Health check"
try {
    $health = Invoke-RestMethod -Uri "$BASE/api/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   Dev server is UP" -ForegroundColor Green
    $health | ConvertTo-Json | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
} catch {
    Write-Host ""
    Write-Host "   ERROR: Dev server not reachable at $BASE" -ForegroundColor Red
    Write-Host "   Run 'npm run dev' in another terminal first, then re-run this script." -ForegroundColor Yellow
    exit 1
}

# --- 1. Market sync (quick) ----------------------------------------------------
Write-Header "1 / 5  Market Sync  (*/15 8-18 UTC Mon-Fri)"
Invoke-Cron "Sync market prices from Polygon.io" "/api/market-sync" 30

# --- 2. Comment counts (quick) -------------------------------------------------
Write-Header "2 / 5  Comment Counts  (02:00 UTC daily)"
Invoke-Cron "Refresh article comment counts in Supabase" "/api/cron/update-comment-counts" 30

# --- 3. News Intelligence Agent (~15s) ----------------------------------------
Write-Header "3 / 5  News Intelligence Agent  (03:00 UTC daily)"
Write-Host "   Fetching RSS feeds + Claude scoring -- expect ~15 seconds..." -ForegroundColor DarkGray
Invoke-Cron "Fetch RSS + score stories into news_feed" "/api/newsroom/news-intel" 120

# --- 4. Editorial Pipeline (slow -- up to 5 min) ------------------------------
Write-Header "4 / 5  Editorial Pipeline  (04:00 UTC daily)"
Write-Host "   This runs the full AI pipeline: context -> topics -> write -> review -> digest" -ForegroundColor DarkGray
Write-Host "   Expect 3-5 minutes. Do not cancel." -ForegroundColor Yellow
Invoke-Cron "Full editorial pipeline (all journalist agents)" "/api/newsroom/run" 360

# --- 5. Newsletter (optional -- sends real emails) ----------------------------
Write-Header "5 / 5  Newsletter Send  (07:30 UTC daily)"
if ($SendNewsletter) {
    Write-Host "   WARNING: This sends real emails to subscribers!" -ForegroundColor Red
    $confirm = Read-Host "   Type YES to continue"
    if ($confirm -eq "YES") {
        Invoke-Cron "Send morning brief to subscribers" "/api/newsletter/send" 120
    } else {
        Write-Host "   Skipped." -ForegroundColor DarkGray
    }
} else {
    Write-Host "   Skipped (pass -SendNewsletter flag to include)." -ForegroundColor DarkGray
    Write-Host "   This sends real emails -- opt-in only." -ForegroundColor DarkGray
}

# --- Summary ------------------------------------------------------------------
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor DarkGray
if ($fail -eq 0) {
    Write-Host "  RESULTS: $pass passed  |  $fail failed" -ForegroundColor Green
} else {
    Write-Host "  RESULTS: $pass passed  |  $fail failed" -ForegroundColor Red
}
Write-Host ("=" * 60) -ForegroundColor DarkGray
Write-Host ""
