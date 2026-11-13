@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul
if not errorlevel 1 (
  py -3 serve.py %*
  goto :end
)

python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul
if not errorlevel 1 (
  python serve.py %*
  goto :end
)

echo.
echo Python 3.8+ не найден.
echo Установите Python с https://www.python.org/downloads/windows/
echo При установке включите "Add Python to PATH".
echo Можно также открыть index.html напрямую и выбрать CSV вручную.
echo.
pause

:end
endlocal
