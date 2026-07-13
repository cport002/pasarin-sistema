# ================================================
# ACADEMIA DE BAILE - CONTROL DE MENSUALIDADES
# ================================================
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

Write-Host ""
Write-Host "Academia de Baile - Control de Mensualidades" -ForegroundColor Cyan
Write-Host ""

# Backend
Write-Host "Iniciando Backend (puerto 3002)..." -ForegroundColor Yellow
$backend = Start-Process -FilePath "node" -ArgumentList "src/server.js" `
  -WorkingDirectory "$PSScriptRoot\backend" `
  -PassThru -WindowStyle Minimized
Write-Host "  Backend PID: $($backend.Id)" -ForegroundColor Green

Start-Sleep -Seconds 3

# Frontend
Write-Host "Iniciando Frontend (puerto 5180)..." -ForegroundColor Yellow
$frontend = Start-Process -FilePath "npx" -ArgumentList "vite" `
  -WorkingDirectory "$PSScriptRoot\frontend" `
  -PassThru -WindowStyle Minimized
Write-Host "  Frontend PID: $($frontend.Id)" -ForegroundColor Green

Start-Sleep -Seconds 4

Write-Host ""
Write-Host "Abriendo navegador..." -ForegroundColor Yellow
Start-Process "http://localhost:5180"

Write-Host ""
Write-Host "Sistema listo en http://localhost:5180" -ForegroundColor Green
Write-Host "Usuario: admin@academiabaile.local" -ForegroundColor Green
Write-Host "Clave:   Academia2026!" -ForegroundColor Green
Write-Host ""
Write-Host "Para detener: cierre las ventanas de Node.js o presione Ctrl+C aqui" -ForegroundColor Gray
Write-Host ""

Read-Host "Presione Enter para detener el sistema"
Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
Write-Host "Sistema detenido." -ForegroundColor Red
