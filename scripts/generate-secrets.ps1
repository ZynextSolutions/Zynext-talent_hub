# Generate production secrets for Railway / Docker (PowerShell)
Write-Host "JWT_ACCESS_SECRET=$(-join ((48..57 + 65..70 + 97..102 | Get-Random -Count 64 | ForEach-Object { [char]$_ })))"
Write-Host "JWT_REFRESH_SECRET=$(-join ((48..57 + 65..70 + 97..102 | Get-Random -Count 64 | ForEach-Object { [char]$_ })))"
Write-Host "JOB_SECRET=$(-join ((48..57 + 65..70 + 97..102 | Get-Random -Count 64 | ForEach-Object { [char]$_ })))"
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
Write-Host "ENCRYPTION_KEY=$([Convert]::ToBase64String($bytes))"
Write-Host ""
Write-Host "Copy each value into Railway api (and JOB_SECRET on jobs). Do not commit these."
