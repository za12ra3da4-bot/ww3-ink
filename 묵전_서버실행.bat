@echo off
cd /d "%~dp0"
title 묵전 WW3 서버
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  pause
  exit /b
)
if not exist node_modules\express (
  echo 처음 실행: 필요한 파일을 설치합니다...
  call npm install
)
:loop
echo.
echo  아래 주소를 친구에게 알려 주세요. 이 창을 닫으면 서버가 꺼집니다.
node server.js
if %errorlevel%==2 (
  pause
  exit /b
)
echo.
echo  서버가 멈췄습니다. 5초 뒤 자동으로 다시 켭니다. 끄려면 이 창을 닫으세요.
timeout /t 5 /nobreak >nul
goto loop
