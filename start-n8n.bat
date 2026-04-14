@echo off
REM N8N startup script with environment variables
REM Fill in WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN, ADMIN_WHATSAPP from Meta dashboard

set BACKEND_URL=http://localhost:3000
set RESTAURANT_ID=2571a187-0de6-4b58-b99b-cac9fb8c2b5e
set WA_PHONE_NUMBER_ID=FILL_FROM_META
set WA_ACCESS_TOKEN=FILL_FROM_META
set ADMIN_WHATSAPP=92300XXXXXXX

set N8N_BASIC_AUTH_ACTIVE=false
set WEBHOOK_URL=https://swinging-wizard-extent.ngrok-free.dev/

echo Starting N8N with restaurant env vars...
echo Backend:        %BACKEND_URL%
echo Restaurant ID:  %RESTAURANT_ID%
echo.
n8n start
