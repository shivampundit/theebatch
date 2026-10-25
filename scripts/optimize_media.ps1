param(
  [string]$ManifestPath = "build/media-manifest.json",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path ".").Path
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $ManifestPath | ConvertFrom-Json
Add-Type -AssemblyName System.Drawing

function Save-PortalImage {
  param(
    [string]$Source,
    [string]$Destination,
    [int]$MaxWidth,
    [int]$MaxHeight,
    [int]$Quality
  )

  $sourcePath = Join-Path $workspace $Source
  $destinationPath = Join-Path $workspace $Destination
  $destinationDirectory = Split-Path -Parent $destinationPath
  New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null

  $input = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    if ($input.PropertyIdList -contains 0x0112) {
      $orientation = [BitConverter]::ToUInt16($input.GetPropertyItem(0x0112).Value, 0)
      switch ($orientation) {
        3 { $input.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
        6 { $input.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
        8 { $input.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
      }
    }
    $scale = [Math]::Min(1.0, [Math]::Min($MaxWidth / $input.Width, $MaxHeight / $input.Height))
    $width = [Math]::Max(1, [int][Math]::Round($input.Width * $scale))
    $height = [Math]::Max(1, [int][Math]::Round($input.Height * $scale))
    $canvas = New-Object System.Drawing.Bitmap($width, $height)
    try {
      $canvas.SetResolution(96, 96)
      $graphics = [System.Drawing.Graphics]::FromImage($canvas)
      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($input, 0, 0, $width, $height)
      } finally {
        $graphics.Dispose()
      }
      $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq "image/jpeg"
      $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
      $canvas.Save($destinationPath, $codec, $parameters)
      $parameters.Dispose()
    } finally {
      $canvas.Dispose()
    }
  } finally {
    $input.Dispose()
  }
}

$completed = 0
$skipped = 0
foreach ($item in $manifest) {
  $sourceInfo = Get-Item -LiteralPath (Join-Path $workspace $item.source)
  $outputPath = Join-Path $workspace $item.destination
  if (-not $Force -and (Test-Path -LiteralPath $outputPath) -and (Get-Item -LiteralPath $outputPath).LastWriteTimeUtc -ge $sourceInfo.LastWriteTimeUtc) {
    $skipped++
    continue
  }
  Save-PortalImage -Source $item.source -Destination $item.destination -MaxWidth $item.width -MaxHeight $item.height -Quality $item.quality
  $completed++
}

Write-Output "Optimized $completed images; retained $skipped existing web images."
