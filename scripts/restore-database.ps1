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

function ConvertTo-LibpqUrl {
  param([string]$Url)
  # pg_dump/psql reject Prisma-only query params such as schema=
  $base, $query = $Url.Split('?', 2)
  if (-not $query) { return $Url }
  $kept = @()
  foreach ($part in $query.Split('&')) {
    if (-not $part) { continue }
    $key = ($part.Split('='))[0].ToLowerInvariant()
    if ($key -eq 'schema') { continue }
    $kept += $part
  }
  if ($kept.Count -eq 0) { return $base }
  return "$base`?$($kept -join '&')"
}

function Get-DatabaseUrl {
  param([string]$Override)
  $raw = $Override
  if (-not $raw -and $env:DATABASE_URL) { $raw = $env:DATABASE_URL }
  if (-not $raw) {
    $EnvFile = Join-Path $ProjectRoot ".env"
    if (Test-Path $EnvFile) {
      foreach ($line in Get-Content $EnvFile) {
        if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)\s*$') {
          $raw = $Matches[1].Trim().Trim('"').Trim("'")
          break
        }
      }
    }
  }
  if (-not $raw) {
    throw "DATABASE_URL not set. Export it or add to .env"
  }
  return ConvertTo-LibpqUrl $raw
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
