@echo off
cd /d "C:\Users\kentt\Desktop\claude\news\the-boardroom-brief"
echo === File info: >> publish-output.log
for %%F in (scripts\publish-global-office.mjs) do echo Size: %%~zF bytes, Date: %%~tF >> publish-output.log
echo === Running node: >> publish-output.log
node scripts\publish-global-office.mjs >> publish-output.log 2>&1
echo Exit code: %ERRORLEVEL% >> publish-output.log
