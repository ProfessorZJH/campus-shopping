# Installs the official xfg-ddd-skills repository into the current Codex project.
# Execute from the campus-shopping root: powershell -ExecutionPolicy Bypass -File scripts/install-xfg-ddd-skills.ps1
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SkillParent = Join-Path $ProjectRoot '.agents\skills'
$Destination = Join-Path $SkillParent 'xfg-ddd-skills'
$Temp = Join-Path $SkillParent ('.xfg-ddd-skills.tmp-' + [guid]::NewGuid().ToString('N'))

if (Test-Path $Destination) {
    throw "Skill already exists: $Destination. Back it up and remove it before reinstalling; refusing to overwrite."
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is required. Install Git for Windows first.'
}

New-Item -ItemType Directory -Force -Path $SkillParent | Out-Null
try {
    & git clone --depth 1 https://github.com/fuzhengwei/xfg-ddd-skills.git $Temp
    if ($LASTEXITCODE -ne 0) { throw 'Git clone failed. Check network access to GitHub.' }
    $Commit = (& git -C $Temp rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not resolve upstream Git commit.' }

    # The upstream skill is intended for QClaw and its YAML includes extra fields.
    # Normalize frontmatter to the two standard Codex fields without changing the instructions.
    $SkillPath = Join-Path $Temp 'SKILL.md'
    $Source = [System.IO.File]::ReadAllText($SkillPath)
    $Match = [regex]::Match($Source, '\A---\r?\n(?s:.*?)\r?\n---\r?\n')
    if (-not $Match.Success) { throw 'Upstream SKILL.md has no valid YAML frontmatter.' }
    $Body = $Source.Substring($Match.Length)
    $Front = "---`nname: xfg-ddd-skills`ndescription: Apply XiaoFuGe DDD domain modeling, aggregates, Repository/Port, Case and Trigger conventions when building this Java Spring Boot project.`n---`n"
    [System.IO.File]::WriteAllText($SkillPath, $Front + $Body, (New-Object System.Text.UTF8Encoding($false)))

    Remove-Item -Recurse -Force (Join-Path $Temp '.git')
    Move-Item -Path $Temp -Destination $Destination
    Write-Host "Installed project skill: $Destination"
    Write-Host "Upstream: https://github.com/fuzhengwei/xfg-ddd-skills @ $Commit"
    Write-Host 'Reload Codex or reopen the project if the skill is not listed yet.'
} finally {
    if (Test-Path $Temp) { Remove-Item -Recurse -Force $Temp }
}
