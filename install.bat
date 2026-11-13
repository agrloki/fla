@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PY="
set "PYVER="

py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul
if not errorlevel 1 set "PY=py -3"

if not defined PY (
  python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul
  if not errorlevel 1 set "PY=python"
)

if not defined PY (
  echo.
  echo Python 3.8+ не найден.
  echo Установите Python с https://www.python.org/downloads/windows/
  echo При установке включите "Add Python to PATH".
  echo Можно также открыть index.html напрямую и выбрать CSV вручную.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('%PY% -V 2^>^&1') do set "PYVER=%%v"

if /I "%~1"=="--desktop" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell; $d=[Environment]::GetFolderPath('Desktop'); $s=$w.CreateShortcut((Join-Path $d 'Анализ логов двигателя.lnk')); $s.TargetPath=(Join-Path '%~dp0' 'start.bat'); $s.WorkingDirectory='%~dp0'; $s.Description='Просмотр CSV-логов и автоматический анализ'; $s.Save()"
  if errorlevel 1 (
    echo Не удалось создать ярлык на рабочем столе.
  ) else (
    echo Ярлык на рабочем столе создан.
  )
)

echo.
echo %PYVER%
echo Установка завершена. Запуск: start.bat
echo.
pause
