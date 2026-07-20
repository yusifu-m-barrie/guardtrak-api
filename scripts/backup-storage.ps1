#Requires -Version 5.1
<#
.SYNOPSIS
  Zip local object storage (STORAGE_LOCAL_ROOT) for GuardTrak Mode A backups.

.PARAMETER StorageRoot
  Directory to archive. Default: STORAGE_LOCAL_ROOT from .env or ./storage

.PARAMETER OutputPath
  Output .zip path. Default: backups/storage_YYYYMMDD_HHmmss.zip
#>
param(
  [string]$StorageRoot = "",
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

function Get-StorageRoot {
  param([string]$Override)
  if ($Override) { return $Override }
  if ($env:STORAGE_LOCAL_ROOT) { return $env:STORAGE_LOCAL_ROOT }
  $EnvFile = Join-Path $ProjectRoot ".env"
  if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
      if ($_ -match '^\s*STORAGE_LOCAL_ROOT\s*=\s*(.+)\s*$') {
        return $Matches[1].Trim().Trim('"').Trim("'")
      }
    }
  }
  return (Join-Path $ProjectRoot "storage")
}

$root = Get-StorageRoot -Override $StorageRoot
if (-not (Test-Path $root)) {
  Write-Warning "Storage root does not exist: $root — creating empty archive placeholder."
  New-Item -ItemType Directory -Path $root -Force | Out-Null
}

if (-not $OutputPath) {
  $BackupDir = Join-Path $ProjectRoot "backups"
  if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
  }
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $OutputPath = Join-Path $BackupDir "storage_$stamp.zip"
} else {
  $parent = Split-Path -Parent $OutputPath
  if ($parent -and -not (Test-Path $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
}

Write-Host "Archiving $root to $OutputPath ..."
Compress-Archive -Path (Join-Path $root "*") -DestinationPath $OutputPath -Force
$size = (Get-Item $OutputPath).Length
Write-Host "Storage backup complete ($size bytes): $OutputPath"
