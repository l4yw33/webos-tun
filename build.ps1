$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$toolRoot = Join-Path $PSScriptRoot '.build'
New-Item -ItemType Directory -Force $toolRoot | Out-Null
$goExe = Join-Path $toolRoot 'go\bin\go.exe'
if (-not (Test-Path -LiteralPath $goExe)) {
    $archive = Join-Path $toolRoot 'go1.27.4.windows-amd64.zip'
    Invoke-WebRequest 'https://go.dev/dl/go1.27.4.windows-amd64.zip' -OutFile $archive
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne '178ab98950ac69ab25069307dc6ade79f3816e414cce95b4da166a115cde1e7e') { throw 'Go archive checksum mismatch' }
    Expand-Archive -LiteralPath $archive -DestinationPath $toolRoot -Force
}
$env:GOTOOLCHAIN='local'
$env:GOCACHE=Join-Path $toolRoot 'cache'
$env:CGO_ENABLED='0'
node parser.test.cjs
if ($LASTEXITCODE -ne 0) { throw 'Parser tests failed' }
node app.test.cjs
if ($LASTEXITCODE -ne 0) { throw 'UI tests failed' }
& $goExe test app/daemon-src/main.go app/daemon-src/subscription.go app/daemon-src/security_test.go app/daemon-src/subscription_test.go app/daemon-src/ipcheck_test.go
if ($LASTEXITCODE -ne 0) { throw 'Security tests failed' }
$env:GOOS='linux'; $env:GOARCH='arm'; $env:GOARM='7'
try {
    & $goExe build -trimpath -ldflags '-s -w' -o app/bin/xraytun-daemon app/daemon-src/main.go app/daemon-src/subscription.go
    if ($LASTEXITCODE -ne 0) { throw 'ARMv7 build failed' }
} finally { Remove-Item Env:GOOS,Env:GOARCH,Env:GOARM -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force dist | Out-Null
npx.cmd --yes --package '@webosose/ares-cli@2.4.0' ares-package -e daemon-src app -o dist
if ($LASTEXITCODE -ne 0) { throw 'IPK packaging failed' }
Write-Host 'Built: dist\com.webosbrew.xraytun_1.3.0_all.ipk'
