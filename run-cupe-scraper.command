#!/bin/bash
set -e
cd "$(dirname "$0")"

clear
printf "\n============================================\n"
printf " CUPE / SCFP locals scraper - Fortisia\n"
printf "============================================\n\n"

if ! command -v node >/dev/null 2>&1; then
  printf "ERROR: Node.js is not installed or not available in PATH.\n"
  printf "Install Node.js 22 LTS, then run this file again.\n"
  printf "https://nodejs.org/\n\n"
  read -r -p "Press Enter to close..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  printf "Installing dependencies with npm ci...\n"
  npm ci
fi

if [ ! -f "scripts/scrape-cupe-locals.mjs" ]; then
  printf "ERROR: scripts/scrape-cupe-locals.mjs not found.\n"
  printf "Make sure you are running this from the cartographie-syndicale repo.\n"
  read -r -p "Press Enter to close..."
  exit 1
fi

export CUPE_MAX_PAGES=999
export CUPE_DETAIL_CONCURRENCY=6

printf "Starting full CUPE scrape...\n"
printf "This can take several minutes because CUPE has thousands of entries.\n\n"

npm run scrape:cupe

printf "\n============================================\n"
printf " Scrape finished.\n"
printf "============================================\n\n"
printf "Outputs generated:\n"
printf "- data/cupe/cupe-locals.csv\n"
printf "- data/cupe/cupe-locals-raw.json\n"
printf "- data/cupe/cupe-locals-by-province.json\n"
printf "- quartz/static/data/cupe-locals.json\n"
printf "- content/sections-locales/scfp-cupe.md\n\n"

if command -v open >/dev/null 2>&1; then
  open "data/cupe"
fi

printf "Send me the generated output files or paste the terminal summary if you want me to inspect it.\n\n"
read -r -p "Press Enter to close..."
