@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 묵전 WW3 서버
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 가 설치되어 있지 않습니다. https://nodejs.org 에서 설치한 뒤 다시 실행하세요.
  pause
  exit /b
)
if not exist node_modules (
  echo 처음 실행: 필요한 파일을 설치합니다...
  call npm install
)
echo.
echo  아래 주소 중 하나를 친구에게 알려 주세요. 이 창을 닫으면 서버가 꺼집니다.
node server.js
pause
