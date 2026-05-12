@echo off

start "Backend - node index.js" powershell -NoExit -WorkingDirectory "%~dp0server" -Command "node index.js"

start "Frontend - npm run dev" powershell -NoExit -WorkingDirectory "%~dp0client" -Command "npm run dev"

timeout /t 8 /nobreak >nul

start http://localhost:5173
