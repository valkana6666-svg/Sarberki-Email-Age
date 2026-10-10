# Owner-run Windows helper; PostgreSQL 17 and Gpg4win must already be installed.
# No source writes, no password reset, no automatic restore or service activation.
[CmdletBinding()]
param([string]$BackupRoot = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Sarberki\Biztonsagi-mentesek'))
$ErrorActionPreference = 'Stop'
function Find-Tool([string]$Name) {
    $command = Get-Command ($Name + '.exe') -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $paths = @(
        (Join-Path $env:ProgramFiles ('PostgreSQL\17\bin\' + $Name + '.exe')),
        (Join-Path ${env:ProgramFiles(x86)} ('GnuPG\bin\' + $Name + '.exe')),
        (Join-Path $env:ProgramFiles ('GnuPG\bin\' + $Name + '.exe'))
    )
    foreach ($path in $paths) { if (Test-Path -LiteralPath $path -PathType Leaf) { return $path } }
    throw ('Hianyzo helyi program: ' + $Name)
}
function Invoke-Private([string]$Program, [string[]]$Arguments) {
    # Never echo upstream errors, connection details, SQL or credentials.
    $oldPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $result = & $Program @Arguments 2>$null
        $exitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $oldPreference }
    if ($exitCode -ne 0) { throw 'Egy helyi muvelet sikertelen. Nincs igazolt teljes mentes.' }
    return $result
}
function Protect-File([string]$Source, [string]$Target) {
    # Gpg4win's local pinentry asks for the encryption passphrase; never put it here.
    Invoke-Private $gpg @('--symmetric', '--cipher-algo', 'AES256', '--output', ($Target + '.partial'), $Source) | Out-Null
    if (!(Test-Path -LiteralPath ($Target + '.partial')) -or (Get-Item -LiteralPath ($Target + '.partial')).Length -eq 0) {
        throw 'Nem keszult titkositott fajl.'
    }
    Move-Item -LiteralPath ($Target + '.partial') -Destination $Target
}
$savedEnvironment = @{}
$destination = $null
$temporary = $null
$secretPointer = [IntPtr]::Zero
try {
    if ($env:OS -ne 'Windows_NT') { throw 'Ez a seged a tulajdonos Windows gepen futtathato.' }
    $pgdump = Find-Tool 'pg_dump'; $pgdumpall = Find-Tool 'pg_dumpall'
    $pgrestore = Find-Tool 'pg_restore'; $psql = Find-Tool 'psql'; $gpg = Find-Tool 'gpg'
    if ((Invoke-Private $pgdump @('--version')) -notmatch '\b17\.') { throw 'PostgreSQL 17 kliens szukseges.' }
    $manifest = Join-Path $PSScriptRoot 'case-store-recovery-manifest.sql'
    if (!(Test-Path -LiteralPath $manifest -PathType Leaf)) { throw 'A verziozott SQL manifest hianyzik.' }
    $root = [IO.Path]::GetFullPath($BackupRoot)
    for ($parent = [IO.DirectoryInfo]$root; $null -ne $parent; $parent = $parent.Parent) {
        if (Test-Path -LiteralPath (Join-Path $parent.FullName '.git')) { throw 'Mentes nem kerulhet Git repoba.' }
    }
    if ((Read-Host 'A cel sajat titkositott lemez, az ugyiras szunetel. Ird be: MENTES') -cne 'MENTES') { throw 'Megszakitva.' }
    $poolHost = Read-Host 'Connect / Session pooler Host (csak a hostnev)'
    if ($poolHost -notmatch '^aws-\d+-eu-west-2\.pooler\.supabase\.com$') { throw 'A London Session pooler host szukseges.' }
    $dbUser = Read-Host 'Session pooler User'
    if ($dbUser -cne 'postgres.mojnqizbcaczstguikpv') { throw 'Csak a kijelolt tesztprojekt engedelyezett.' }
    $configuration = @{
        PGHOST=$poolHost; PGPORT='5432'; PGUSER=$dbUser; PGDATABASE='postgres';
        PGSSLMODE='require'; PGCONNECT_TIMEOUT='20'; PGOPTIONS='-c default_transaction_read_only=on'; PGPASSWORD='';
        PGSERVICE=$null; PGSERVICEFILE=$null
    }
    foreach ($key in $configuration.Keys) { $savedEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
    $securePassword = Read-Host 'Adatbazis-jelszo (csak helyben, rejtve)' -AsSecureString
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $configuration.PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    if (!$configuration.PGPASSWORD) { throw 'Ures jelszo.' }
    foreach ($key in $configuration.Keys) { [Environment]::SetEnvironmentVariable($key, $configuration[$key], 'Process') }
    $configuration.PGPASSWORD = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer); $secretPointer = [IntPtr]::Zero
    $securePassword.Dispose()
    $version = Invoke-Private $psql @('-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', 'show server_version_num')
    if ($version -notmatch '^17\d{4}$') { throw 'Nem PostgreSQL 17 forras.' }
    $destination = Join-Path $root ('sarberki-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
    New-Item -ItemType Directory -Path $destination | Out-Null
    $account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    Invoke-Private 'icacls.exe' @($destination, '/inheritance:r', '/grant:r', ($account + ':(OI)(CI)F')) | Out-Null
    $temporary = Join-Path $destination 'temporary-plaintext'
    New-Item -ItemType Directory -Path $temporary | Out-Null
    # Temporary plaintext is necessary for Windows PowerShell 5 binary safety.
    # Its directory inherits the restricted ACL on the confirmed encrypted disk.
    $before = (Invoke-Private $psql @('-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-f', $manifest)) -join "`n"
    $archive = Join-Path $temporary 'database.dump'
    Invoke-Private $pgdump @('-w', '--format=custom', '--file', $archive) | Out-Null
    $toc = (Invoke-Private $pgrestore @('--list', $archive)) -join "`n"
    foreach ($table in @('sc_tenants','sc_memberships','sc_cases','sc_message_keys','sc_audit')) {
        foreach ($kind in @('TABLE','TABLE DATA')) {
            if ($toc -notmatch ('\b' + $kind + ' public ' + $table + '\s')) { throw 'Hiannyos ugytar-archivum.' }
        }
    }
    foreach ($table in @('users','identities')) {
        if ($toc -notmatch ('\bTABLE DATA auth ' + $table + '\s')) { throw 'Hiannyos Auth-adatmentes.' }
    }
    $roles = Join-Path $temporary 'roles.sql'
    Invoke-Private $pgdumpall @('-w', '--roles-only', '--no-role-passwords', '--file', $roles) | Out-Null
    $after = (Invoke-Private $psql @('-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-f', $manifest)) -join "`n"
    if (!$before -or $before -cne $after) { throw 'Az ugytar valtozott az export alatt. Nincs stabil recovery manifest.' }
    [IO.File]::WriteAllText((Join-Path $temporary 'manifest.json'), $before, [Text.UTF8Encoding]::new($false))
    foreach ($name in @('database.dump','roles.sql','manifest.json')) {
        Protect-File (Join-Path $temporary $name) (Join-Path $destination ($name + '.gpg'))
    }
    $readback = Join-Path $temporary 'readback.dump'
    Invoke-Private $gpg @('--output', $readback, '--decrypt', (Join-Path $destination 'database.dump.gpg')) | Out-Null
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -cne (Get-FileHash -LiteralPath $readback -Algorithm SHA256).Hash) {
        throw 'A visszafejtett archivum elter a forrastol.'
    }
    $hashes = Get-ChildItem -LiteralPath $destination -Filter '*.gpg' | Sort-Object Name | ForEach-Object {
        (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $_.Name
    }
    [IO.File]::WriteAllLines((Join-Path $destination 'SHA256SUMS.txt'), [string[]]$hashes, [Text.Encoding]::ASCII)
    [IO.File]::WriteAllText((Join-Path $destination 'STATUS.txt'), "Encrypted logical export and local archive readback completed.`r`nIndependent storage readback: NOT VERIFIED.`r`nIsolated SQL/Auth/RLS/CAS restore: NOT VERIFIED.`r`nPlatform settings, Storage binaries, Vault and role passwords require separate inventory.`r`nCASE_STORE_ENABLED must remain disabled.`r`n")
    Write-Host ('Titkositott logikai export es helyi visszaolvasas kesz: ' + $destination)
    Write-Host 'A teljes mentes feltetele meg NEM teljesult: kulon tarolas es izolalt restore szukseges.'
} catch {
    Write-Host 'BLOKKOLVA: egy elofeltetel vagy muvelet nem teljesult. Nincs igazolt teljes mentes.'
    if ($destination -and (Test-Path -LiteralPath $destination)) {
        [IO.File]::WriteAllText((Join-Path $destination 'FAILED.txt'), 'Incomplete attempt. Not a verified backup.')
    }
    exit 1
} finally {
    if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
    foreach ($key in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $savedEnvironment[$key], 'Process') }
    if ($temporary -and (Test-Path -LiteralPath $temporary)) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
