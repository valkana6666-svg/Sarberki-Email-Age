# Copies an already-completed owner backup to another location and verifies ciphertext hashes.
# Never connects to Supabase, decrypts data, changes the source, or claims isolated restore.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SourceBackupPath,
    [Parameter(Mandatory = $true)][string]$DestinationRoot
)
$ErrorActionPreference = 'Stop'
$requiredEncrypted = @('database.dump.gpg', 'roles.sql.gpg', 'manifest.json.gpg')
$requiredFiles = @($requiredEncrypted) + @('SHA256SUMS.txt', 'STATUS.txt')
$stage = $null

function Test-OutsideGit([string]$Path) {
    for ($parent = [IO.DirectoryInfo]$Path; $null -ne $parent; $parent = $parent.Parent) {
        if (Test-Path -LiteralPath (Join-Path $parent.FullName '.git')) {
            throw 'A biztonsagi mentes nem lehet Git-taroloban.'
        }
    }
}

function Assert-EncryptedFiles([string]$Folder) {
    foreach ($name in $requiredFiles) {
        $file = Join-Path $Folder $name
        if (!(Test-Path -LiteralPath $file -PathType Leaf) -or (Get-Item -LiteralPath $file).Length -eq 0) {
            throw ('Hianyzo vagy ures fajl: ' + $name)
        }
    }
    if ((Test-Path -LiteralPath (Join-Path $Folder 'FAILED.txt')) -or
        (Test-Path -LiteralPath (Join-Path $Folder 'temporary-plaintext')) -or
        @(Get-ChildItem -LiteralPath $Folder -File | Where-Object { $_.Name -like '*.partial' }).Count -ne 0) {
        throw 'A forras nem igazoltan teljes, csak titkositott mentes.'
    }
    $unexpectedEncrypted = @(Get-ChildItem -LiteralPath $Folder -File -Filter '*.gpg' |
        Where-Object { $requiredEncrypted -cnotcontains $_.Name })
    if ($unexpectedEncrypted.Count -ne 0) { throw 'Nem vart titkositott fajl a mentest tartalmazo mappaban.' }

    $status = Get-Content -LiteralPath (Join-Path $Folder 'STATUS.txt') -Raw
    if ($status -notmatch '(?i)Encrypted logical' -or
        $status -notmatch '(?i)isolated.*restore.*NOT VERIFIED') {
        throw 'A STATUS.txt nem a vart, csak reszben ellenorzott owner-backup allapot.'
    }
    $expected = @{}
    $lines = @(Get-Content -LiteralPath (Join-Path $Folder 'SHA256SUMS.txt') |
        Where-Object { $_.Trim().Length -gt 0 })
    if ($lines.Count -ne $requiredEncrypted.Count) { throw 'A SHA256SUMS.txt sorainak szama hibas.' }
    foreach ($line in $lines) {
        if ($line -cnotmatch '^([a-fA-F0-9]{64})  ([^\s]+)$') { throw 'Hibas SHA256SUMS.txt sor.' }
        $hash = $Matches[1].ToLowerInvariant()
        $name = $Matches[2]
        if ($requiredEncrypted -cnotcontains $name -or $expected.ContainsKey($name)) {
            throw 'Ismeretlen vagy tobbszor szereplo ellenorzoosszeg.'
        }
        $expected[$name] = $hash
    }
    foreach ($name in $requiredEncrypted) {
        if (!$expected.ContainsKey($name)) { throw 'Hianyzo SHA256.' }
        $actual = (Get-FileHash -LiteralPath (Join-Path $Folder $name) -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -cne $expected[$name]) { throw ('SHA256 elteres: ' + $name) }
    }
    return $expected
}

try {
    $source = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $SourceBackupPath).Path)
    if (!(Test-Path -LiteralPath $source -PathType Container)) { throw 'A forras nem egy letezo mappa.' }
    $root = [IO.Path]::GetFullPath($DestinationRoot)
    Test-OutsideGit $source
    Test-OutsideGit $root
    if (!(Test-Path -LiteralPath $root -PathType Container)) {
        throw 'A celmeghajto vagy celmappa nem erheto el. Elobb csatlakoztasd es hozd letre.'
    }
    $sourcePath = $source.TrimEnd('\', '/')
    $rootPath = $root.TrimEnd('\', '/')
    $separator = [IO.Path]::DirectorySeparatorChar
    if ($rootPath.Equals($sourcePath, [StringComparison]::OrdinalIgnoreCase) -or
        $rootPath.StartsWith($sourcePath + $separator, [StringComparison]::OrdinalIgnoreCase) -or
        $sourcePath.StartsWith($rootPath + $separator, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'A forras es a cel nem fedheti at egymast.'
    }
    $originalHashes = Assert-EncryptedFiles $source
    $sourceRoot = [IO.Path]::GetPathRoot($source)
    $destinationVolume = [IO.Path]::GetPathRoot($root)
    if ($sourceRoot.Equals($destinationVolume, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Ugyanazon meghajtora nem keszitunk fuggetlen biztonsagi masolatot.'
    }
    $folderName = Split-Path -Path $source -Leaf
    if ($folderName -notmatch '^sarberki-\d{8}T\d{6}Z(?:-[a-f0-9]{8})?$') {
        throw 'Nem felismerheto tulajdonosi mentosmappa-nev.'
    }
    $target = Join-Path $root $folderName
    if (Test-Path -LiteralPath $target) { throw 'A celban mar van ilyen mappa: nem irjuk felul.' }
    $stage = Join-Path $root ('.copying-' + $folderName + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
    New-Item -ItemType Directory -Path $stage -ErrorAction Stop | Out-Null
    foreach ($name in $requiredFiles) {
        Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $stage $name) -ErrorAction Stop
    }
    $copiedHashes = Assert-EncryptedFiles $stage
    foreach ($name in $requiredEncrypted) {
        if ($copiedHashes[$name] -cne $originalHashes[$name]) { throw 'Masolasi osszegelteres.' }
    }
    # Reports ciphertext byte integrity only, not database restore or storage independence.
    [IO.File]::WriteAllText((Join-Path $stage 'COPY-VERIFIED.txt'),
        ('Ciphertext SHA256 source/destination match. No decryption or restore performed.' + [Environment]::NewLine + 'Independent physical device: OPERATOR MUST VERIFY.' + [Environment]::NewLine + 'Isolated SQL/Auth/RLS/CAS restore: NOT VERIFIED.' + [Environment]::NewLine), [Text.Encoding]::UTF8)
    Rename-Item -LiteralPath $stage -NewName $folderName -ErrorAction Stop
    $stage = $null
    Write-Host ('KESZ: titkositott masolat, SHA256 egyezes: ' + $target)
    Write-Host 'FONTOS: izolalt visszaallitas es a fuggetlen fizikai adathordozo kulon ellenorzendo.'
} catch {
    if ($stage -and (Test-Path -LiteralPath $stage)) {
        Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Host ('BLOKKOLVA: ' + $_.Exception.Message)
    exit 1
}