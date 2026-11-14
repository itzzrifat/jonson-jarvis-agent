@echo off
cd /d "%~dp0"
title Deploy Jonson AI to Hugging Face Spaces
color 0b
cls
echo ====================================================================
echo      Jonson AI - 24/7 Cloud Autonomous Agent Deployment Tool
echo             Founder: Rifat Uddin | Sohoz Karbar Tech
echo ====================================================================
echo.
echo This tool will deploy your Full Agent (Telegram, Chrome, FB/IG)
echo to Hugging Face Spaces (2 vCPU / 16 GB RAM - 100%% Free Forever).
echo.
echo [PREREQUISITE]
echo 1. Go to https://huggingface.co/new-space
echo 2. Enter Space name: jonson-ai-cloud-agent
echo 3. Select License: Apache 2.0 (or MIT)
echo 4. Select Space SDK: Docker
echo 5. Choose template: Blank
echo 6. Click "Create Space"
echo.
echo ====================================================================
set /p HF_REPO="Enter your Hugging Face Space Git URL (e.g. https://huggingface.co/spaces/itzzrifat/jonson-ai-cloud-agent): "

if "%HF_REPO%"=="" (
    echo [ERROR] Space URL cannot be empty!
    pause
    exit /b
)

echo.
echo [1/4] Initializing Git repository...
if not exist ".git" (
    git init
)

echo [2/4] Configuring remote repository...
git remote remove origin 2>nul
git remote add origin %HF_REPO%

echo [3/4] Staging and committing files...
git add .
git commit -m "feat: deploy Jonson AI 24/7 full cloud autonomous agent"

echo [4/4] Pushing to Hugging Face Spaces (main branch)...
git branch -M main
git push -u origin main --force

echo.
echo ====================================================================
echo                 DEPLOYMENT PUSH COMPLETED!
echo ====================================================================
echo.
echo IMPORTANT NEXT STEP (1-Time Setup):
echo 1. Open your Space page on Hugging Face.
echo 2. Go to "Settings" -> "Variables and secrets" -> "New secret".
echo 3. Add these Secrets:
echo    - TELEGRAM_BOT_TOKEN : 8251961572:AAGUddQiFE67EoUBXH9PbkMzxwi1aEKHRmo
echo    - TELEGRAM_CHAT_ID   : 8656634699
echo    - GEMINI_API_KEY     : YOUR_GEMINI_API_KEY_HERE
echo.
echo 4. Under Settings, copy your Space Public URL (e.g. https://itzzrifat-jonson-ai-cloud-agent.hf.space)
echo    and set the Telegram webhook if needed, or simply run the bot!
echo.
echo Hugging Face is now building your Docker container. It will be live
echo within 2-3 minutes!
echo.
pause
