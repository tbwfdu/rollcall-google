Write-Host '==================================================================== 
        8888888b.          888 888                   888 888
        888   Y88b         888 888                   888 888
        888    888         888 888                   888 888
        888   d88P .d88b.  888 888  .d8888b  8888b.  888 888
        8888888P" d88""88b 888 888 d88P"        "88b 888 888
        888 T88b  888  888 888 888 888      .d888888 888 888
        888  T88b Y88..88P 888 888 Y88b.    888  888 888 888
        888   T88b "Y88P"  888 888  "Y8888P "Y888888 888 888
====================================================================
    Running Rollcall for Google installer...
===================================================================='

#Run the npm install command to install depedencies for Rollcall
Write-Host "Installing Rollcall and Dependencies..."
npm install --silent

#Install pm2 to manage the processes
Write-Host "Installing PM2 for process management..."
npm install -g pm2 --silent

#Reload PATH variables after PM2 install and install log-rotate addon
Write-Host "Installing Log-Rotate to rotate logs at 10MB..."
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") 
pm2 install pm2-logrotate -s

#Set PM2 to run api-server and server-ui
#pm2 start .\ui-server.js --name 'Rollcall UI' --watch --log .\rollcall-ui.log
#pm2 start .\api-server.js --name 'Rollcall Access Sync Service' --watch --log .\rollcall-ui.log