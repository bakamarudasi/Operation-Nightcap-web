@echo off
chcp 65001 >nul 2>&1
title Operation Nightcap - CG Editor

echo ========================================
echo  Operation Nightcap - CG Editor Launcher
echo ========================================
echo.

:: --- HTMLをブラウザで開く ---
start "" "%~dp0tools\cg-inventory-editor.html"
echo [OK] CG Inventory Editor を開きました
echo.

:: --- Claude Code を起動 ---
where claude >nul 2>&1
if %ERRORLEVEL%==0 (
    echo [..] Claude Code 起動中...
    echo     プロジェクト: %~dp0
    echo.
    cd /d "%~dp0"
    claude
) else (
    echo [!!] Claude Code が見つかりません
    echo     インストール: npm install -g @anthropic-ai/claude-code
    echo.
    pause
)
