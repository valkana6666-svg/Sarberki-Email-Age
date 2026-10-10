# Synthetic, offline regression tests. Uses temporary SUBST drives: does not connect to cloud.
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'copy-owner-encrypted-backup.ps1'
$base = Join-Path ([IO.Path]::GetTempPath()) ('sarberki-copy-fixture-' + [Guid]::NewGuid().ToString('N'))
$sourceRoot = Join-Path $base 'source'
$destRoot = Join-Path $base 'destination'
$fixtureName = 'sarberki-20261010T090000Z-abcdef12'
$fixture = Join-Path $sourceRoot $fixtureName
try {
    New-Item -ItemType Directory -Path $fixture -Force | Out-Null
    New-Item -ItemType Directory -Path $destRoot -Force | Out-Null
    foreach ($name in @('database.dump.gpg','roles.sql.gpg','manifest.json.gpg')) {
        [IO.File]::WriteAllText((Join-Path $fixture $name), 'SYNTHETIC CIPHERTEXT ' + $name)
    }
    $hashes = foreach ($name in @('database.dump.gpg','roles.sql.gpg','manifest.json.gpg')) {
        (Get-FileHash -LiteralPath (Join-Path $fixture $name) -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $name
    }
    [IO.File]::WriteAllLines((Join-Path $fixture 'SHA256SUMS.txt'), [string[]]$hashes)
    [IO.File]::WriteAllText((Join-Path $fixture 'STATUS.txt'), 'Encrypted logical export. Isolated SQL/Auth/RLS/CAS restore: NOT VERIFIED.')

    # SUBST simulates a different drive letter for testing the copying logic.
    # It is physically the same disk: this test does NOT verify independent hardware.
    $drive = 'W:'
    $badDrive = 'V:'
    if ((Test-Path ($drive + '\')) -or (Test-Path ($badDrive + '\'))) {
        throw 'The synthetic fixture drives W: and V: must be unused.'
    }
    & subst $drive $destRoot
    if ($LASTEXITCODE -ne 0) { throw 'Could not create synthetic destination mapping.' }
    try {
        & pwsh -NoProfile -File $script -SourceBackupPath $fixture -DestinationRoot ($drive + '\')
        if ($LASTEXITCODE -ne 0) { throw 'Synthetic copy did not succeed.' }
        $target = Join-Path $destRoot $fixtureName
        foreach ($name in @('database.dump.gpg','roles.sql.gpg','manifest.json.gpg','SHA256SUMS.txt','STATUS.txt','COPY-VERIFIED.txt')) {
            if (!(Test-Path -LiteralPath (Join-Path $target $name))) { throw ('Missing synthetic copy file: ' + $name) }
        }
        # Existing output is never overwritten.
        & pwsh -NoProfile -File $script -SourceBackupPath $fixture -DestinationRoot ($drive + '\')
        if ($LASTEXITCODE -eq 0) { throw 'Overwrite unexpectedly succeeded.' }
        # Corruption must be rejected before creating a new destination.
        [IO.File]::AppendAllText((Join-Path $fixture 'database.dump.gpg'), 'TAMPERED')
        $badRoot = Join-Path $base 'bad-destination'
        New-Item -ItemType Directory -Path $badRoot -Force | Out-Null
        & subst $badDrive $badRoot
        if ($LASTEXITCODE -ne 0) { throw 'Could not create second synthetic mapping.' }
        try {
            & pwsh -NoProfile -File $script -SourceBackupPath $fixture -DestinationRoot ($badDrive + '\')
            if ($LASTEXITCODE -eq 0) { throw 'Tampered source unexpectedly accepted.' }
            if (Test-Path -LiteralPath (Join-Path $badRoot $fixtureName)) { throw 'Tampered destination published.' }
        } finally { & subst $badDrive /D | Out-Null }
    } finally { & subst $drive /D | Out-Null }
    Write-Host 'PASS: synthetic copy, duplicate refusal, altered archive refusal.'
} finally {
    if (Test-Path -LiteralPath $base) { Remove-Item -LiteralPath $base -Recurse -Force }
}