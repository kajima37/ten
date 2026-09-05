param(
  [string]$Source = 'docs/deployment/assets/google-play/app-icon.png'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$root = (Get-Location).Path
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$androidRoot = Join-Path $root 'apps/web/android/app/src/main/res'

function Save-Png {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $temporaryPath = [System.IO.Path]::GetTempFileName()
  try {
    $Bitmap.Save($temporaryPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
  } finally {
    if (Test-Path -LiteralPath $temporaryPath) {
      Remove-Item -LiteralPath $temporaryPath -Force
    }
  }
}

function New-ScaledBitmap {
  param(
    [System.Drawing.Image]$Image,
    [int]$Width,
    [int]$Height
  )

  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.DrawImage($Image, 0, 0, $Width, $Height)
  $graphics.Dispose()
  return $bitmap
}

function New-ForegroundBitmap {
  param(
    [System.Drawing.Image]$Image,
    [int]$Size
  )

  $bitmap = New-ScaledBitmap -Image $Image -Width $Size -Height $Size
  for ($x = 0; $x -lt $Size; $x += 1) {
    for ($y = 0; $y -lt $Size; $y += 1) {
      $color = $bitmap.GetPixel($x, $y)
      if ($color.A -gt 0 -and [Math]::Abs($color.R - 9) -le 10 -and [Math]::Abs($color.G - 9) -le 10 -and [Math]::Abs($color.B - 10) -le 10) {
        $bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $color.R, $color.G, $color.B))
      }
    }
  }
  return $bitmap
}

function Remove-BorderLightPixels {
  param(
    [System.Drawing.Bitmap]$Bitmap
  )

  $visited = New-Object 'bool[,]' $Bitmap.Width, $Bitmap.Height
  $queue = [System.Collections.Generic.Queue[System.Drawing.Point]]::new()

  function Add-IfLightBorderPixel {
    param([int]$X, [int]$Y)

    if ($X -lt 0 -or $Y -lt 0 -or $X -ge $Bitmap.Width -or $Y -ge $Bitmap.Height -or $visited[$X, $Y]) {
      return
    }
    $visited[$X, $Y] = $true
    $color = $Bitmap.GetPixel($X, $Y)
    $isLightNeutral = $color.A -gt 0 -and $color.R -gt 180 -and $color.G -gt 180 -and $color.B -gt 180 -and [Math]::Max([Math]::Abs($color.R - $color.G), [Math]::Abs($color.G - $color.B)) -lt 24
    if ($isLightNeutral) {
      $queue.Enqueue([System.Drawing.Point]::new($X, $Y))
    }
  }

  for ($i = 0; $i -lt $Bitmap.Width; $i += 1) {
    Add-IfLightBorderPixel -X $i -Y 0
    Add-IfLightBorderPixel -X $i -Y ($Bitmap.Height - 1)
  }
  for ($i = 1; $i -lt ($Bitmap.Height - 1); $i += 1) {
    Add-IfLightBorderPixel -X 0 -Y $i
    Add-IfLightBorderPixel -X ($Bitmap.Width - 1) -Y $i
  }

  while ($queue.Count -gt 0) {
    $point = $queue.Dequeue()
    $Bitmap.SetPixel($point.X, $point.Y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    Add-IfLightBorderPixel -X ($point.X - 1) -Y $point.Y
    Add-IfLightBorderPixel -X ($point.X + 1) -Y $point.Y
    Add-IfLightBorderPixel -X $point.X -Y ($point.Y - 1)
    Add-IfLightBorderPixel -X $point.X -Y ($point.Y + 1)
  }
}

$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
try {
  $cleanSource = New-ScaledBitmap -Image $sourceImage -Width 512 -Height 512
} finally {
  $sourceImage.Dispose()
}

try {
  Remove-BorderLightPixels -Bitmap $cleanSource
  Save-Png -Bitmap $cleanSource -Path $sourcePath

  $iconSizes = @{
    'mipmap-mdpi' = 48
    'mipmap-hdpi' = 72
    'mipmap-xhdpi' = 96
    'mipmap-xxhdpi' = 144
    'mipmap-xxxhdpi' = 192
  }

  foreach ($entry in $iconSizes.GetEnumerator()) {
    $directory = Join-Path $androidRoot $entry.Key
    $icon = New-ScaledBitmap -Image $cleanSource -Width $entry.Value -Height $entry.Value
    try {
      Save-Png -Bitmap $icon -Path (Join-Path $directory 'ic_launcher.png')
      Save-Png -Bitmap $icon -Path (Join-Path $directory 'ic_launcher_round.png')
    } finally {
      $icon.Dispose()
    }

    $foreground = New-ForegroundBitmap -Image $cleanSource -Size $entry.Value
    try {
      Save-Png -Bitmap $foreground -Path (Join-Path $directory 'ic_launcher_foreground.png')
    } finally {
      $foreground.Dispose()
    }
  }

  $splashPaths = Get-ChildItem -LiteralPath $androidRoot -Recurse -Filter 'splash.png'
  foreach ($path in $splashPaths) {
    $existing = [System.Drawing.Image]::FromFile($path.FullName)
    try {
      $width = $existing.Width
      $height = $existing.Height
    } finally {
      $existing.Dispose()
    }
    $splash = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($splash)
      $graphics.Clear([System.Drawing.Color]::FromArgb(9, 9, 10))
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $drawSize = [Math]::Max(96, [int]([Math]::Min($width, $height) * 0.28))
      $left = [int](($width - $drawSize) / 2)
      $top = [int](($height - $drawSize) / 2)
      $graphics.DrawImage($cleanSource, $left, $top, $drawSize, $drawSize)
      $graphics.Dispose()
      Save-Png -Bitmap $splash -Path $path.FullName
    } finally {
      $splash.Dispose()
    }
  }
} finally {
  $cleanSource.Dispose()
}

Write-Output 'Android icon and splash assets generated.'
