#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

find_python() {
  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 && \
       "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

if ! PYTHON="$(find_python)"; then
  printf '%s\n' \
    'Python 3.8+ не найден.' \
    'Linux: sudo apt install python3   (Debian/Ubuntu)' \
    '       sudo dnf install python3   (Fedora)' \
    '       sudo pacman -S python      (Arch)' \
    'macOS: brew install python' \
    'Windows: установите Python с python.org и запустите install.bat.'
  exit 1
fi

chmod +x start.sh start.command serve.py make-dist.py 2>/dev/null || true

if [ "${1:-}" = "--desktop" ] && [ "$(uname -s)" = "Linux" ]; then
  apps_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  desktop_file="$apps_dir/engine-log-analyzer.desktop"
  mkdir -p "$apps_dir"
  cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=Анализ логов двигателя
Comment=Просмотр CSV-логов и автоматический анализ
Exec="$PWD/start.sh"
Path=$PWD
Icon=$PWD/favicon.svg
Terminal=true
Categories=Utility;
EOF
  chmod +x "$desktop_file"
  printf 'Пункт меню создан: %s\n' "$desktop_file"
fi

printf 'Python: %s (%s)\n' "$PYTHON" "$("$PYTHON" -V 2>&1)"
printf 'Установка завершена. Запуск: ./start.sh\n'
