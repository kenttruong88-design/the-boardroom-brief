@echo off
cd /d "%~dp0.."
echo Publishing 2 Global Office articles to Sanity...
echo.
node scripts\publish-global-office.mjs
echo.
pause
