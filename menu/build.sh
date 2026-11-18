#!/usr/bin/env bash
# Atualiza os preços a partir de price.ods e reconstrói assets/menu-shanti.pdf.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 menu/import-prices.py
node menu/build-menu.mjs
