#Requires -Version 5.1
<#
.SYNOPSIS
  pg_dump backup for GuardTrak (PostgreSQL 18, custom format -Fc).

.DESCRIPTION
  Reads DATABASE_URL from the environment or guardtrak-api/.env.
  Compatible with local PostgreSQL 18 (Mode A) and production Postgres.

.PARAMETER OutputPath
  Optional output .dump path. Default: backups/guardtrak_YYYYMMDD_HHmmss.dump

.PARAMETER DatabaseUrl
  Override connection string (postgresql://...).

.EXAMPLE
  .\scripts\backup-database.ps1
  .\scripts\backup-database.ps1 -OutputPath "C:\backups\guardtrak.dump"
#>
param(
  [string]$OutputPath = "",
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

$dbUrl = Get-DatabaseUrl -Override $DatabaseUrl
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump not found. Install PostgreSQL 18 client tools and add to PATH."
}

if (-not $OutputPath) {
  $BackupDir = Join-Path $ProjectRoot "backups"
  if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
  }
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $OutputPath = Join-Path $BackupDir "guardtrak_$stamp.dump"
} else {
  $parent = Split-Path -Parent $OutputPath
  if ($parent -and -not (Test-Path $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
}

Write-Host "Backing up to $OutputPath ..."
& pg_dump $dbUrl -Fc -f $OutputPath
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }

$size = (Get-Item $OutputPath).Length
if ($size -le 0) { throw "Backup file is empty" }
Write-Host "Backup complete ($size bytes): $OutputPath"
