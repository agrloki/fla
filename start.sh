#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && \
     "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; then
    exec "$candidate" serve.py "$@"
  fi
done

printf '%s\n' \
  'Python 3.8+ не найден.' \
  'Linux: sudo apt install python3   (Debian/Ubuntu)' \
  '       sudo dnf install python3   (Fedora)' \
  '       sudo pacman -S python      (Arch)' \
  'macOS: brew install python' \
  'Можно также открыть index.html напрямую и выбрать CSV вручную.'
exit 1
