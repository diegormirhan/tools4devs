<#
.SYNOPSIS
    Sets tools4devs up from a clean checkout: prerequisites, dependencies, the pinned
    tool artifacts, the checks, and the Windows installer.

.DESCRIPTION
    Every step checks whether its work is already done, so running this again is safe and
    fast. Nothing is installed on the machine unless you pass -InstallPrerequisites;
    without it the script reports exactly what is missing and the command that fixes it.

.PARAMETER InstallPrerequisites
    Install anything missing (Node.js, Rust, the Visual Studio C++ build tools) with
    winget. Off by default, because installing a compiler toolchain is the machine
    owner's decision, not a build script's.

.PARAMETER SkipTests
    Skip the domain, interface and host test suites.

.PARAMETER SkipBuild
    Set everything up but do not produce the installer.

.PARAMETER Start
    Launch the app when the build finishes.

.PARAMETER Dev
    Skip the release build and open the development window instead.

.EXAMPLE
    .\setup.ps1
    Checks the toolchain, installs dependencies, stages the bundled tools, runs the
    tests and builds the installer.

.EXAMPLE
    .\setup.ps1 -InstallPrerequisites -Start
    Installs whatever is missing, builds, then opens the app.
#>
[CmdletBinding()]
param(
    [switch]$InstallPrerequisites,
    [switch]$SkipTests,
    [switch]$SkipBuild,
    [switch]$Start,
    [switch]$Dev
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$script:StepNumber = 0
$script:Started = Get-Date

function Write-Step {
    param([string]$Text)
    $script:StepNumber++
    Write-Host ''
    Write-Host ("  {0}  {1}" -f $script:StepNumber, $Text) -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Text)
    Write-Host "     $Text" -ForegroundColor Green
}

function Write-Info {
    param([string]$Text)
    Write-Host "     $Text" -ForegroundColor DarkGray
}

function Write-Warn {
    param([string]$Text)
    Write-Host "     $Text" -ForegroundColor Yellow
}

function Invoke-Native {
    param([scriptblock]$Action)
    # Many of these tools write progress to stderr. Under $ErrorActionPreference = Stop,
    # PowerShell 5.1 turns each of those lines into a terminating error even when the
    # command succeeds, so the exit code is the only thing worth trusting here.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Action } finally { $ErrorActionPreference = $previous }
}

function Invoke-Step {
    param([string]$Command, [string]$Description)
    Write-Info $Command
    Invoke-Native { cmd /c "$Command" }
    if ($LASTEXITCODE -ne 0) { throw "$Description failed (exit $LASTEXITCODE)" }
}

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-WithWinget {
    param([string]$Id, [string]$Label)
    if (-not $InstallPrerequisites) {
        Write-Warn "$Label is missing. Install it with:"
        Write-Warn "    winget install -e --id $Id"
        Write-Warn "  or re-run this script with -InstallPrerequisites."
        throw "$Label is required"
    }
    if (-not (Test-Command 'winget')) {
        throw "$Label is missing and winget is not available to install it."
    }
    Write-Info "winget install -e --id $Id"
    Invoke-Native { winget install -e --id $Id --accept-source-agreements --accept-package-agreements --disable-interactivity }
    if ($LASTEXITCODE -ne 0) { throw "Could not install $Label" }
    Write-Ok "$Label installed. A new terminal may be needed for PATH changes."
}

function Get-VisualStudioBuildTools {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    if (-not (Test-Path $vswhere)) { return $null }
    $found = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    if ([string]::IsNullOrWhiteSpace($found)) { return $null }
    return $found
}

Write-Host ''
Write-Host '  tools4devs setup' -ForegroundColor White
Write-Host '  Windows x64 - local tools, no cloud, no AI' -ForegroundColor DarkGray

# ---------------------------------------------------------------- prerequisites
Write-Step 'Checking the toolchain'

if (Test-Command 'node') {
    $nodeVersion = (node --version).TrimStart('v')
    $nodeMajor = [int]($nodeVersion.Split('.')[0])
    if ($nodeMajor -lt 24) {
        Write-Warn "Node $nodeVersion found; this project needs 24 or newer."
        Install-WithWinget -Id 'OpenJS.NodeJS' -Label 'Node.js 24+'
    }
    else {
        Write-Ok "Node $nodeVersion"
    }
}
else {
    Install-WithWinget -Id 'OpenJS.NodeJS' -Label 'Node.js'
}

if (Test-Command 'cargo') {
    Write-Ok ((cargo --version) -replace '\s+$', '')
}
else {
    Install-WithWinget -Id 'Rustlang.Rustup' -Label 'Rust'
}

if (Test-Command 'rustup') {
    $targets = rustup target list --installed 2>$null
    if ($targets -notcontains 'x86_64-pc-windows-msvc') {
        Write-Info 'rustup target add x86_64-pc-windows-msvc'
        Invoke-Native { rustup target add x86_64-pc-windows-msvc }
        if ($LASTEXITCODE -ne 0) { throw 'Could not add the MSVC target' }
    }
    Write-Ok 'Rust target x86_64-pc-windows-msvc'
}

$buildTools = Get-VisualStudioBuildTools
if ($buildTools) {
    Write-Ok "Visual Studio C++ build tools at $buildTools"
}
else {
    Write-Warn 'The Visual Studio C++ build tools were not found. Tauri needs them to link.'
    Install-WithWinget -Id 'Microsoft.VisualStudio.2022.BuildTools' -Label 'VS 2022 Build Tools'
    Write-Warn 'Open the Visual Studio Installer and add the "Desktop development with C++" workload if the build still fails.'
}

# ---------------------------------------------------------------- dependencies
Write-Step 'Installing the npm dependencies'
if (Test-Path 'node_modules') {
    Write-Ok 'node_modules is already there; refreshing against the lockfile'
}
Invoke-Step -Command 'npm install --no-fund --no-audit' -Description 'npm install'

# ---------------------------------------------------------------- tool artifacts
Write-Step 'Downloading and verifying the tools that ship in the installer'
Write-Info 'Nine executables, pinned by version and SHA-256 in tooling/tools.json.'
Write-Info 'A digest that does not match aborts the setup on purpose.'
Invoke-Step -Command 'npm run tools:stage' -Description 'Staging the bundled tools'

$staged = Get-ChildItem 'apps\desktop\src-tauri\resources\tools' -Filter '*.exe' -ErrorAction SilentlyContinue
if (-not $staged -or $staged.Count -eq 0) { throw 'No tool was staged; the installer would ship empty.' }
$stagedMb = [math]::Round((($staged | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Ok "$($staged.Count) executables staged, $stagedMb MB"

# ---------------------------------------------------------------- checks
if ($SkipTests) {
    Write-Step 'Tests skipped (-SkipTests)'
}
else {
    Write-Step 'Running the checks'
    Invoke-Step -Command 'npm run validate:tools' -Description 'Manifest validation'
    Invoke-Step -Command 'npm run audit:capabilities' -Description 'Capability audit'
    Invoke-Step -Command 'npx tsc --noEmit -p apps/desktop/tsconfig.json' -Description 'TypeScript'
    Invoke-Step -Command 'npm test' -Description 'Domain and interface tests'
    Invoke-Step -Command 'cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml' -Description 'Host tests'
    Write-Ok 'Everything green'
    Write-Info 'The suite that runs every operation against the real binaries is opt-in:'
    Write-Info '  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml -- --include-ignored --nocapture'
}

# ---------------------------------------------------------------- build
if ($Dev) {
    Write-Step 'Opening the development window'
    Write-Info 'Close the window to come back to this prompt.'
    Invoke-Native { npm run tauri:dev }
    return
}

if ($SkipBuild) {
    Write-Step 'Build skipped (-SkipBuild)'
    Write-Host ''
    Write-Host '  Ready. Build it with: npm run tauri:build' -ForegroundColor White
    return
}

Write-Step 'Building the Windows installer'
Write-Info 'The first Rust build takes a few minutes; later ones are incremental.'
Invoke-Step -Command 'npm run tauri:build' -Description 'Tauri build'

$release = 'apps\desktop\src-tauri\target\release'
$executable = Join-Path $release 'tools4devs.exe'
$installers = Get-ChildItem (Join-Path $release 'bundle\nsis\*.exe'), (Join-Path $release 'bundle\msi\*.msi') -ErrorAction SilentlyContinue

Write-Host ''
Write-Host '  Done' -ForegroundColor Green
foreach ($installer in $installers) {
    Write-Host ("     {0}  {1} MB" -f $installer.Name, [math]::Round($installer.Length / 1MB, 1)) -ForegroundColor White
    Write-Host ("       {0}" -f $installer.FullName) -ForegroundColor DarkGray
}
Write-Host ("     took {0:mm\:ss}" -f ((Get-Date) - $script:Started)) -ForegroundColor DarkGray

if ($Start) {
    Write-Host ''
    Write-Host '  Opening tools4devs' -ForegroundColor Cyan
    Start-Process -FilePath (Resolve-Path $executable)
}
else {
    Write-Host ''
    Write-Host '  Run it without installing:' -ForegroundColor White
    Write-Host ("     {0}" -f $executable) -ForegroundColor DarkGray
    Write-Host '  Or install it with either bundle above.' -ForegroundColor White
}
