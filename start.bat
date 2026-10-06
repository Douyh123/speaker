@echo off
chcp 65001 >nul
REM Do not change this file to LF line endings. cmd.exe mis-parses LF-only .bat
REM files, producing bogus "command not found" errors. Keep CRLF, no BOM.
REM Chinese text below only renders correctly because of the chcp on the line above.
cd /d "%~dp0"

set "PORT=8080"
set "DIR=dist"

if not exist "%DIR%\index.html" (
  echo [x] 没找到 %DIR%\index.html
  echo     请先构建: npm install ^&^& npm run build
  pause
  exit /b 1
)

echo.
echo   讲明白  -^>  http://localhost:%PORT%
echo   关闭此窗口即停止服务
echo.

start "" http://localhost:%PORT%
python -m http.server %PORT% --directory "%DIR%"
