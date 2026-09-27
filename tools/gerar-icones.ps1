# Gera os icones da extensao (icons\icone16/32/48/128.png): um controle de videogame com uma
# moeda dourada ("gastos em jogos"). E um desenho proprio, sem relacao com o logo de nenhuma loja.
#
# Uso (na pasta do projeto):  powershell -ExecutionPolicy Bypass -File tools\gerar-icones.ps1
# Os tamanhos grandes (48 e 128) usam o desenho detalhado, feito em uma grade de 128x128. Os pequenos
# (16 e 32, os da barra do Chrome) tem um desenho proprio, mais simples e com as formas alinhadas
# aos pixels, porque reduzir o desenho grande deixaria tudo borrado.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$raiz = Split-Path -Parent $PSScriptRoot
$pasta = Join-Path $raiz 'icons'

$fundo = [System.Drawing.ColorTranslator]::FromHtml('#162232')
$controle = [System.Drawing.ColorTranslator]::FromHtml('#e6edf5')
$ouro = [System.Drawing.ColorTranslator]::FromHtml('#f5b82e')
$ouroEscuro = [System.Drawing.ColorTranslator]::FromHtml('#c98a0b')

function Novo-Retangulo-Arredondado($x, $y, $l, $a, $r) {
  $caminho = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $caminho.AddArc($x, $y, $d, $d, 180, 90)
  $caminho.AddArc($x + $l - $d, $y, $d, $d, 270, 90)
  $caminho.AddArc($x + $l - $d, $y + $a - $d, $d, $d, 0, 90)
  $caminho.AddArc($x, $y + $a - $d, $d, $d, 90, 90)
  $caminho.CloseFigure()
  return $caminho
}

# Desenho simples para 16 e 32 px: grade de 16x16, ampliada por 1 ou 2 (as coordenadas sao inteiras,
# entao as bordas retas ficam nitidas).
function Desenhar-Pequeno($tamanho) {
  $bmp = New-Object System.Drawing.Bitmap($tamanho, $tamanho, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'Half'
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.ScaleTransform($tamanho / 16.0, $tamanho / 16.0)

  $pincelFundo = New-Object System.Drawing.SolidBrush($fundo)
  $g.FillPath($pincelFundo, (Novo-Retangulo-Arredondado 0 0 16 16 3))

  # Controle
  $corpo = New-Object System.Drawing.Drawing2D.GraphicsPath
  $corpo.FillMode = 'Winding'
  $corpo.AddPath((Novo-Retangulo-Arredondado 1 3 14 7 3), $false)
  $corpo.AddEllipse(1, 6, 5, 7)
  $corpo.AddEllipse(10, 6, 5, 7)
  $g.FillRegion((New-Object System.Drawing.SolidBrush($controle)), (New-Object System.Drawing.Region($corpo)))

  # Cruzeta e botoes
  $g.FillRectangle($pincelFundo, 3, 6, 3, 1)
  $g.FillRectangle($pincelFundo, 4, 5, 1, 3)
  $g.FillRectangle($pincelFundo, 10, 5, 1, 1)
  $g.FillRectangle($pincelFundo, 12, 6, 1, 1)

  # Moeda (menor que no desenho grande, para nao esconder o controle) com um aro fino da cor do fundo
  $g.FillEllipse($pincelFundo, 7.25, 7.25, 9, 9)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush($ouroEscuro)), 8, 8, 7.5, 7.5)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush($ouro)), 8.75, 8.75, 6, 6)

  $g.Dispose()
  return $bmp
}

function Desenhar($tamanho) {
  if ($tamanho -le 32) { return Desenhar-Pequeno $tamanho }
  $bmp = New-Object System.Drawing.Bitmap($tamanho, $tamanho, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.ScaleTransform($tamanho / 128.0, $tamanho / 128.0)

  # Fundo: quadrado arredondado
  $g.FillPath((New-Object System.Drawing.SolidBrush($fundo)), (Novo-Retangulo-Arredondado 0 0 128 128 28))

  # Controle: corpo + dois "cabos" (uniao de formas)
  $corpo = New-Object System.Drawing.Drawing2D.GraphicsPath
  $corpo.FillMode = 'Winding'  # sem isso, onde as formas se sobrepoem apareceriam buracos
  $corpo.AddPath((Novo-Retangulo-Arredondado 18 34 92 46 22), $false)
  $corpo.AddEllipse(14, 56, 40, 44)
  $corpo.AddEllipse(74, 56, 40, 44)
  $regiao = New-Object System.Drawing.Region($corpo)
  $g.FillRegion((New-Object System.Drawing.SolidBrush($controle)), $regiao)

  # Cruzeta (esquerda) e botoes (direita), em "furos" da cor do fundo
  $furo = New-Object System.Drawing.SolidBrush($fundo)
  $g.FillPath($furo, (Novo-Retangulo-Arredondado 28 55 22 8 2.5))
  $g.FillPath($furo, (Novo-Retangulo-Arredondado 35 48 8 22 2.5))
  $g.FillEllipse($furo, 79, 46, 11, 11)
  $g.FillEllipse($furo, 91, 58, 11, 11)

  # Moeda dourada no canto, com um aro da cor do fundo para separar do controle
  $g.FillEllipse($furo, 60, 66, 64, 64)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush($ouroEscuro)), 65, 71, 54, 54)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush($ouro)), 68, 74, 48, 48)

  # Cifrao (so nos tamanhos em que ainda fica legivel)
  if ($tamanho -ge 40) {
    $fonte = New-Object System.Drawing.Font('Arial', 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $formato = New-Object System.Drawing.StringFormat
    $formato.Alignment = 'Center'
    $formato.LineAlignment = 'Center'
    $g.DrawString('$', $fonte, (New-Object System.Drawing.SolidBrush($ouroEscuro)), (New-Object System.Drawing.RectangleF(68, 76, 48, 46)), $formato)
  }

  $g.Dispose()
  return $bmp
}

foreach ($t in 16, 32, 48, 128) {
  $bmp = Desenhar $t
  $arquivo = Join-Path $pasta "icone$t.png"
  $bmp.Save($arquivo, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "gerado: $arquivo"
}
