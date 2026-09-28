param([switch]$Recapture,[string]$PythonExe,[string]$BrowserExe)
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
$nodeExe=(Get-Command node).Source
if (!(Test-Path node_modules)) { & npm.cmd ci; if ($LASTEXITCODE) { throw 'npm ci failed' } }
$ownedProcesses=@()
try {
 if ($Recapture) {
  foreach ($port in @(5199,8009)) { if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is in use; choose a free local capture session." } }
  if (!$PythonExe) {
   $pythonCommand=Get-Command python -ErrorAction SilentlyContinue
   if ($pythonCommand) { $PythonExe=$pythonCommand.Source }
   else { $PythonExe=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' }
  }
  if (!(Test-Path $PythonExe)) { throw 'Supply -PythonExe with a Python executable path.' }
  if (!(Test-Path python-deps/fastapi)) { & $PythonExe -m pip install --target python-deps -r requirements-demo.txt; if ($LASTEXITCODE) { throw 'Python dependency setup failed' } }
  New-Item -ItemType Directory -Force audit | Out-Null
  $ownedProcesses += Start-Process $nodeExe -ArgumentList 'server.cjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput audit/site.log -RedirectStandardError audit/site-error.log
  $ownedProcesses += Start-Process $PythonExe -ArgumentList 'local-api.py' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput audit/api.log -RedirectStandardError audit/api-error.log
  $ready=$false
  for($attempt=0;$attempt -lt 30;$attempt++) { try { Invoke-WebRequest http://127.0.0.1:8009/health -UseBasicParsing | Out-Null; Invoke-WebRequest http://127.0.0.1:5199/index.html -UseBasicParsing | Out-Null; $ready=$true; break } catch { Start-Sleep -Seconds 1 } }
  if (!$ready) { throw 'Local capture servers did not become ready.' }
  & $nodeExe capture.cjs
  if ($LASTEXITCODE) { throw 'Capture failed' }
 }
 & $nodeExe prepare-frames.cjs
 if ($LASTEXITCODE) { throw 'Source frame preparation failed' }
 $renderArguments=@('node_modules/@remotion/cli/remotion-cli.js','render','src/index.tsx','DarbGoDemo','out/DarbGo-demo-89s.mp4','--concurrency=4','--image-format=jpeg','--jpeg-quality=95')
 if ($BrowserExe) { $renderArguments += "--browser-executable=$BrowserExe" }
 & $nodeExe @renderArguments
 if ($LASTEXITCODE) { throw 'Render failed' }
 & $nodeExe verify.cjs
 if ($LASTEXITCODE) { throw 'Verification failed' }
} finally { foreach($owned in $ownedProcesses) { if (!$owned.HasExited) { Stop-Process -Id $owned.Id -ErrorAction SilentlyContinue } } }
