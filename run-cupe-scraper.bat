@echo off
setlocal

title CUPE / SCFP locals scraper
cd /d "%~dp0"

echo.
echo ============================================
echo  CUPE / SCFP locals scraper - Fortisia
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not available in PATH.
  echo Install Node.js 22 LTS, then run this file again.
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies with npm ci...
  call npm ci
  if errorlevel 1 (
    echo.
    echo ERROR: npm ci failed.
    pause
    exit /b 1
  )
)

if not exist "scripts\scrape-cupe-locals.mjs" (
  echo ERROR: scripts\scrape-cupe-locals.mjs not found.
  echo Make sure you are running this from the cartographie-syndicale repo.
  pause
  exit /b 1
)

set CUPE_MAX_PAGES=999
set CUPE_DETAIL_CONCURRENCY=6

echo Starting full CUPE scrape...
echo This can take several minutes because CUPE has thousands of entries.
echo.

call npm run scrape:cupe
if errorlevel 1 (
  echo.
  echo ERROR: CUPE scrape failed. Check the messages above.
  pause
  exit /b 1
)

echo.
echo ============================================
echo  Scrape finished.
echo ============================================
echo.
echo Outputs generated:
echo - data\cupe\cupe-locals.csv
echo - data\cupe\cupe-locals-raw.json
echo - data\cupe\cupe-locals-by-province.json
echo - quartz\static\data\cupe-locals.json
echo - content\sections-locales\scfp-cupe.md
echo.

if exist "data\cupe" start "" "data\cupe"

echo Send me the generated output files or paste the terminal summary if you want me to inspect it.
echo.
pause
