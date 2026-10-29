@echo off
rem Arranca la aplicacion y abre el panel en el navegador.
rem Colocar este archivo junto a arcusur-encuestas-1.0.jar. La base de datos queda en la carpeta .\data
cd /d "%~dp0"
start "" http://localhost:8080/dashboard.html
java -jar arcusur-encuestas-1.0.jar
pause
