# Gera o pacote .zip da extensao para enviar a Chrome Web Store.
#
# Uso (na pasta do projeto):  powershell -ExecutionPolicy Bypass -File tools\empacotar.ps1
#
# Descobre sozinho quais arquivos entram: le o manifest.json (icones, popup, scripts) e o
# popup.html (css e js). Assim nao entra nada a mais (.git, docs, *.md, tools) e nao falta nada.
# O .zip sai em dist\gastos-para-steam-<versao>.zip.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$raiz = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $raiz 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json

# 1) lista de arquivos, sempre com barras "/" (o formato zip exige)
$arquivos = New-Object System.Collections.Generic.List[string]
$arquivos.Add('manifest.json')
foreach ($caminho in $manifest.icons.PSObject.Properties.Value) { $arquivos.Add($caminho) }
foreach ($caminho in $manifest.action.default_icon.PSObject.Properties.Value) { $arquivos.Add($caminho) }
$arquivos.Add($manifest.action.default_popup)
foreach ($grupo in $manifest.content_scripts) { foreach ($js in $grupo.js) { $arquivos.Add($js) } }

# css e js usados pelo popup
$html = Get-Content (Join-Path $raiz $manifest.action.default_popup) -Raw -Encoding UTF8
foreach ($m in [regex]::Matches($html, '(?:href|src)="([^"#:]+\.(?:css|js))"')) { $arquivos.Add($m.Groups[1].Value) }

$arquivos = $arquivos | ForEach-Object { $_ -replace '\\', '/' } | Sort-Object -Unique

# 2) confere que todos existem
$faltando = $arquivos | Where-Object { -not (Test-Path (Join-Path $raiz $_)) }
if ($faltando) { throw "Arquivos citados no manifest/popup que nao existem: $($faltando -join ', ')" }

# 3) monta o zip
$pasta = Join-Path $raiz 'dist'
New-Item -ItemType Directory -Force -Path $pasta | Out-Null
$destino = Join-Path $pasta ("gastos-para-steam-{0}.zip" -f $manifest.version)
if (Test-Path $destino) { Remove-Item $destino -Force }

$zip = [System.IO.Compression.ZipFile]::Open($destino, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($arquivo in $arquivos) {
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip, (Join-Path $raiz $arquivo), $arquivo, [System.IO.Compression.CompressionLevel]::Optimal)
  }
} finally { $zip.Dispose() }

Write-Host ("Pacote criado: {0}" -f $destino)
Write-Host ("Versao: {0} | {1} arquivos | {2:N1} KB" -f $manifest.version, $arquivos.Count, ((Get-Item $destino).Length / 1KB))
