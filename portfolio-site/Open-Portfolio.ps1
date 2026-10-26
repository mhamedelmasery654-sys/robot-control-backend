$ErrorActionPreference = 'Stop'
$siteRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 4173
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCommand) { $pythonCommand = Get-Command py -ErrorAction SilentlyContinue }
if (-not $pythonCommand) { throw 'Python is required to serve the local 3D preview.' }
while ($true) {
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    try { $probe.Start(); $probe.Stop(); break }
    catch { $port++; if ($port -gt 4300) { throw 'No free local preview port was found.' } }
}
$arguments = @('-m', 'http.server', "$port", '--bind', '127.0.0.1', '--directory', $siteRoot)
Start-Process -FilePath $pythonCommand.Source -ArgumentList $arguments -WindowStyle Hidden
Start-Sleep -Seconds 1
Start-Process "http://127.0.0.1:$port/"
