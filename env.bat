@echo off

if "%1"=="d" (
    .\venv\Scripts\deactivate.bat
)
if "%1"=="a" (
    .\venv\Scripts\activate.bat
)