$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root "vendor\Formelopslag\docs\index.html"
$www = Join-Path $root "www"
$utf8 = New-Object System.Text.UTF8Encoding $false

if (-not (Test-Path -LiteralPath $source)) {
    $vendor = Join-Path $root "vendor\Formelopslag"
    New-Item -ItemType Directory -Force -Path (Join-Path $root "vendor") | Out-Null
    if (-not (Test-Path -LiteralPath (Join-Path $vendor ".git"))) {
        git clone --depth 1 --filter=blob:none --sparse https://github.com/grumskull-art/Formelopslag.git $vendor
    }
    Push-Location $vendor
    try {
        git sparse-checkout set --no-cone "/docs/index.html"
    } finally {
        Pop-Location
    }
}
if (-not (Test-Path -LiteralPath $source)) {
    throw "Mangler $source"
}

$html = [System.IO.File]::ReadAllText($source)
$marker = '<script id="database" type="application/json">'
$start = $html.IndexOf($marker)
if ($start -lt 0) { throw "Database-script blev ikke fundet." }
$jsonStart = $start + $marker.Length
$jsonEnd = $html.IndexOf("</script>", $jsonStart)
if ($jsonEnd -lt 0) { throw "Database-script slutter ikke." }

$tempIn = Join-Path ([System.IO.Path]::GetTempPath()) "martec-buddy-db-in.json"
$tempOut = Join-Path ([System.IO.Path]::GetTempPath()) "martec-buddy-db-out.json"
[System.IO.File]::WriteAllText($tempIn, $html.Substring($jsonStart, $jsonEnd - $jsonStart), $utf8)
$strip = Join-Path $root "tools\StripMathcad\StripMathcad.csproj"
$elTek = Join-Path $root "catalogs\el-maalbroer.json"
if (-not (Test-Path -LiteralPath $elTek)) { throw "Mangler $elTek" }
& dotnet run --project $strip -c Release -- $tempIn $tempOut $elTek
if ($LASTEXITCODE -ne 0) { throw "Mathcad-data kunne ikke fjernes." }
$json = [System.IO.File]::ReadAllText($tempOut)
Remove-Item -LiteralPath $tempIn, $tempOut -ErrorAction SilentlyContinue
$html = $html.Remove($jsonStart, $jsonEnd - $jsonStart).Insert($jsonStart, $json)

$button = '<button type="button" data-mathcad(?:-options)?="[^"]*">[^<]*</button>'
$buttonCount = [regex]::Matches($html, $button).Count
if ($buttonCount -lt 2) { throw "Fandt ikke Mathcad-knapperne ($buttonCount)." }
$html = [regex]::Replace($html, $button, "")
$html = $html.Replace('<div class="card-actions"></div>', "")

$dialogAt = $html.IndexOf('<dialog id="mathcad-dialog"')
if ($dialogAt -lt 0) { throw "Mathcad-dialog blev ikke fundet." }
$dialogEnd = $html.IndexOf("</dialog>", $dialogAt)
if ($dialogEnd -lt 0) { throw "Mathcad-dialog slutter ikke." }
$html = $html.Remove($dialogAt, $dialogEnd + "</dialog>".Length - $dialogAt)

$scriptAt = $html.IndexOf("/* Prime XML is compiled by Python.")
if ($scriptAt -lt 0) { throw "Mathcad-script blev ikke fundet." }
$scriptEnd = $html.IndexOf("</script>", $scriptAt)
if ($scriptEnd -lt 0) { throw "Mathcad-script slutter ikke." }
$html = $html.Remove($scriptAt, $scriptEnd - $scriptAt)

$html = $html.Replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
$html = $html.Replace("<title>Formelopslag " + [char]0x00B7 + " EL og TM</title>", "<title>Martec Buddy</title>")
$html = $html.Replace('aria-label="Formelopslag, start"', 'aria-label="Martec Buddy, start"')
$html = $html.Replace("> Formelopslag</a>", "> Martec Buddy</a>")
$footer = "Formelopslag " + [char]0x00B7 + " fungerer ogs" + [char]0x00E5 + " offline"
$html = $html.Replace("<span>$footer</span>", "<span>Martec Buddy " + [char]0x00B7 + " fungerer offline</span>")
$html = $html.Replace("<body data-view=`"formulas`">", "<body class=`"martec-app`" data-view=`"formulas`">")
$html = $html.Replace("Formelopslag feedback", "Martec Buddy feedback")
$copyOld = "Mark" + [char]0x00E9 + "r teksten og kopi" + [char]0x00E9 + "r med Ctrl+C eller browserens kopieringsmenu."
$copyNew = "Hold p" + [char]0x00E5 + " teksten og v" + [char]0x00E6 + "lg Kopi" + [char]0x00E9 + "r. P" + [char]0x00E5 + " en computer kan du bruge Ctrl+C."
$html = $html.Replace($copyOld, $copyNew)
$html = $html.Replace(
    "</style></head>",
    "</style><meta name=`"theme-color`" content=`"#f5f7f8`" media=`"(prefers-color-scheme: light)`"><meta name=`"theme-color`" content=`"#101b22`" media=`"(prefers-color-scheme: dark)`"><meta name=`"apple-mobile-web-app-capable`" content=`"yes`"><meta name=`"mobile-web-app-capable`" content=`"yes`"><meta name=`"apple-mobile-web-app-status-bar-style`" content=`"default`"><meta name=`"apple-mobile-web-app-title`" content=`"Martec Buddy`"><link rel=`"manifest`" href=`"manifest.webmanifest`"><link rel=`"stylesheet`" href=`"mobile.css`"></head>")
$sourceLink = 'source&&db.source_base_url?`<a href="${esc(db.source_base_url+source.file.split(''/'').map(encodeURIComponent).join(''/''))}"'
$sourceLinkNew = 'source&&db.source_base_url&&source.id!==''ELMB''?`<a href="${esc(db.source_base_url+source.file.split(''/'').map(encodeURIComponent).join(''/''))}"'
if (-not $html.Contains($sourceLink)) { throw "Kildelinket blev ikke fundet." }
$html = $html.Replace($sourceLink, $sourceLinkNew)
$sourceHint = '${link||`<small>Find filen i projektets ${esc(source?.file||''sources/'')}.</small>`}'
$sourceHintNew = '${link||(source&&source.id===''ELMB''?'''' : `<small>Find filen i projektets ${esc(source?.file||''sources/'')}.</small>`)}'
if (-not $html.Contains($sourceHint)) { throw "Kildehenvisningen blev ikke fundet." }
$html = $html.Replace($sourceHint, $sourceHintNew)
$html = $html.Replace("</body>", "<script src=`"mobile.js`" defer></script></body>")
$mainTab = [System.IO.File]::ReadAllText((Join-Path $root "vaerktoejer\main-tab.html"), $utf8).Trim()
$viewMarker = 'id="view-diagrams" aria-pressed="false">Diagrammer</button></nav>'
if (-not $html.Contains($viewMarker)) { throw "View switch marker was not found." }
$html = $html.Replace($viewMarker, 'id="view-diagrams" aria-pressed="false">Diagrammer</button>' + $mainTab + '</nav>')

$copyMathcad = "Kopi" + [char]0x00E9 + "r til Mathcad"
foreach ($needle in @($copyMathcad, "Mathcad-valg", 'id="mathcad-dialog"', "data-mathcad=", "Prime XML is compiled by Python", '"mathcad":')) {
    if ($html.Contains($needle)) { throw "Bygget side indeholder stadig: $needle" }
}
foreach ($needle in @("Martec Buddy", 'id="global-search"', 'id="view-formulas"', 'id="view-diagrams"', 'id="view-tools"', 'href="vaerktoejer/index.html"', 'id="diagram-list"', 'id="gas"', 'id="motor"', 'id="gas-canvas"', 'id="motor-pv"', 'id="ph-svg"', 'id="saved-toggle"', "ELMB01", "mobile.css", "mobile.js")) {
    if (-not $html.Contains($needle)) { throw "Bygget side mangler: $needle" }
}

New-Item -ItemType Directory -Force -Path $www | Out-Null
[System.IO.File]::WriteAllText((Join-Path $www "index.html"), $html, $utf8)
Copy-Item -Force (Join-Path $root "mobile\mobile.css") (Join-Path $www "mobile.css")
Copy-Item -Force (Join-Path $root "mobile\mobile.js") (Join-Path $www "mobile.js")
Copy-Item -Force (Join-Path $root "mobile\manifest.webmanifest") (Join-Path $www "manifest.webmanifest")
Copy-Item -Force (Join-Path $root "mobile\icon.svg") (Join-Path $www "icon.svg")

$toolsSrc = Join-Path $root "vaerktoejer"
$toolsOut = Join-Path $www "vaerktoejer"
New-Item -ItemType Directory -Force -Path $toolsOut | Out-Null
$tools = [System.IO.File]::ReadAllText((Join-Path $toolsSrc "index.html"), $utf8)
$toolsTitle = "<title>Martec Buddy " + [char]0x00B7 + " V" + [char]0x00E6 + "rkt" + [char]0x00F8 + "jer</title>"
if (-not $tools.Contains("<title>VektorLab | AC-beregninger</title>")) { throw "Tools title was not found." }
$tools = $tools.Replace("<title>VektorLab | AC-beregninger</title>", $toolsTitle)
if (-not $tools.Contains("<strong>VektorLab</strong>")) { throw "Tools brand was not found." }
$tools = $tools.Replace("<strong>VektorLab</strong>", "<strong>Martec Buddy</strong>")
$tools = $tools.Replace('aria-label="VektorLab forside"', 'aria-label="Martec Buddy forside"')
$tools = $tools.Replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
if (-not $tools.Contains("<body>")) { throw "Tools body was not found." }
$tools = $tools.Replace("<body>", '<body class="martec-tools">')
$styleLink = '<link rel="stylesheet" href="styles.css?v=iron-core-coil-2">'
if (-not $tools.Contains($styleLink)) { throw "Tools stylesheet was not found." }
$tools = $tools.Replace($styleLink, $styleLink + '<link rel="stylesheet" href="phone.css">')
$topicLabel = '<p class="nav-label">Emner</p>'
if (-not $tools.Contains($topicLabel)) { throw "Tools topic label was not found." }
$sidebarLinks = [System.IO.File]::ReadAllText((Join-Path $toolsSrc "sidebar-links.html"), $utf8).Trim()
$tools = $tools.Replace($topicLabel, $sidebarLinks + $topicLabel)
$scriptTag = '<script src="app.js?v=iron-core-coil-2"></script>'
if (-not $tools.Contains($scriptTag)) { throw "Tools script was not found." }
$tabs = [System.IO.File]::ReadAllText((Join-Path $toolsSrc "tabs.html"), $utf8).Trim()
$tools = $tools.Replace($scriptTag, $scriptTag + $tabs)
foreach ($needle in @('id="acP"', 'id="serie"', 'id="trefaset"', 'id="ellove"', 'id="menuButton"', "phone.css", "phone.js", "buddy-tabs", "buddy-links", "Martec Buddy", "viewport-fit=cover")) {
    if (-not $tools.Contains($needle)) { throw "Tools page is missing: $needle" }
}
if ($tools.Contains("<strong>VektorLab</strong>")) { throw "Tools brand was not replaced." }
[System.IO.File]::WriteAllText((Join-Path $toolsOut "index.html"), $tools, $utf8)
Copy-Item -Force (Join-Path $toolsSrc "styles.css") (Join-Path $toolsOut "styles.css")
Copy-Item -Force (Join-Path $toolsSrc "app.js") (Join-Path $toolsOut "app.js")
Copy-Item -Force (Join-Path $toolsSrc "phone.css") (Join-Path $toolsOut "phone.css")
Copy-Item -Force (Join-Path $toolsSrc "phone.js") (Join-Path $toolsOut "phone.js")
$srcJs = Get-FileHash -Algorithm SHA256 (Join-Path $toolsSrc "app.js")
$outJs = Get-FileHash -Algorithm SHA256 (Join-Path $toolsOut "app.js")
$srcCss = Get-FileHash -Algorithm SHA256 (Join-Path $toolsSrc "styles.css")
$outCss = Get-FileHash -Algorithm SHA256 (Join-Path $toolsOut "styles.css")
if ($srcJs.Hash -ne $outJs.Hash -or $srcCss.Hash -ne $outCss.Hash) { throw "Tools calculation files were modified." }

$bytes = (Get-Item -LiteralPath (Join-Path $www "index.html")).Length
$toolBytes = (Get-Item -LiteralPath (Join-Path $toolsOut "index.html")).Length
Write-Host "Martec Buddy www er bygget ($bytes bytes, tools $toolBytes bytes)."
