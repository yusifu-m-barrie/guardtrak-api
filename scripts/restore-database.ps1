#Requires -Version 5.1
<#
.SYNOPSIS
  pg_restore GuardTrak database from custom-format (-Fc) dump.

.PARAMETER DumpPath
  Path to .dump file (required).

.PARAMETER DatabaseUrl
  Target DATABASE_URL. Default: from env or .env.

.EXAMPLE
  .\scripts\restore-database.ps1 -DumpPath ".\backups\guardtrak_20260720.dump"
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$DumpPath,
  [string]$DatabaseUrl = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

function Get-DatabaseUrl {
  param([string]$Override)
  if ($Override) { return $Override }
  if ($env:DATABASE_URL) { return $env:DATABASE_URL }
  $EnvFile = Join-Path $ProjectRoot ".env"
  if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
      if ($_ -match '^\s*DATABASE_URL\s*=\s*(.+)\s*$') {
        return $Matches[1].Trim().Trim('"').Trim("'")
      }
    }
  }
  throw "DATABASE_URL not set. Export it or add to .env"
}

if (-not (Test-Path $DumpPath)) {
  throw "Dump file not found: $DumpPath"
}
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  throw "pg_restore not found. Install PostgreSQL 18 client tools."
}

$dbUrl = Get-DatabaseUrl -Override $DatabaseUrl
Write-Warning "This will run pg_restore with --clean --if-exists on the target database."
Write-Host "Restoring $DumpPath ..."

& pg_restore -d $dbUrl --clean --if-exists --no-owner --no-acl $DumpPath
if ($LASTEXITCODE -ne 0) {
  Write-Warning "pg_restore exited with code $LASTEXITCODE (warnings are common for --clean)."
}

Write-Host "Restore finished. Run: npx prisma generate && npx prisma migrate deploy"
