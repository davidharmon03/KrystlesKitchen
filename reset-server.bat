@echo off
cd /d "%~dp0server"

if exist data.db (
    echo Deleting data.db...
    del data.db
    echo Done.
) else (
    echo No data.db found, skipping delete.
)

echo Starting server...
node index.js