# Generates a properly-padded adaptive-icon.png for Android.
# The Android launcher applies a circle/squircle/rounded-square mask to the
# foreground; whatever lies outside the inner ~66% (the "safe zone") may be
# cropped. The source icon.png has white-bleed rounded corners which leak in
# when scaled. We fix this by:
#   1. Painting the whole 1024x1024 canvas with the basket's own teal (#78D1BF).
#   2. Clipping draws to a rounded-rectangle (or circle) so the source's white
#      corners are excluded from the composition entirely.
#   3. Scaling the source down so the basket sits squarely inside the safe zone
#      for every Android adaptive-icon mask shape.

param(
    [string]$Source = "C:\Users\liron\Salino\mobile\assets\images\icon.png",
    [string]$Dest   = "C:\Users\liron\Salino\mobile\assets\images\adaptive-icon.png",
    [int]$Size      = 1024,
    [string]$TealHex = "#78D1BF",
    [double]$IconScale = 0.80,
    [double]$CornerRadiusFraction = 0.18
)

Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath {
    param(
        [System.Drawing.RectangleF]$Rect,
        [single]$Radius
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $Radius * 2
    $path.AddArc($Rect.X,                  $Rect.Y,                  $d, $d, 180, 90)
    $path.AddArc($Rect.Right - $d,         $Rect.Y,                  $d, $d, 270, 90)
    $path.AddArc($Rect.Right - $d,         $Rect.Bottom - $d,        $d, $d,   0, 90)
    $path.AddArc($Rect.X,                  $Rect.Bottom - $d,        $d, $d,  90, 90)
    $path.CloseFigure()
    return $path
}

$canvas = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$teal = [System.Drawing.ColorTranslator]::FromHtml($TealHex)
$g.Clear($teal)

$src = [System.Drawing.Image]::FromFile($Source)
try {
    $iconSize = [single]($Size * $IconScale)
    $offset   = [single](($Size - $iconSize) / 2.0)

    # Clip to the same rounded-rectangle the source icon already uses, so the
    # white corners never reach the canvas.
    $rect = New-Object System.Drawing.RectangleF($offset, $offset, $iconSize, $iconSize)
    $radius = [single]($iconSize * $CornerRadiusFraction)
    $clip = New-RoundedRectPath -Rect $rect -Radius $radius
    $g.SetClip($clip)

    $g.DrawImage($src, $rect)

    $clip.Dispose()
} finally {
    $src.Dispose()
}

$g.ResetClip()
$g.Dispose()

$canvas.Save($Dest, [System.Drawing.Imaging.ImageFormat]::Png)
$canvas.Dispose()

Write-Host "Wrote $Dest (canvas $Size x $Size, basket at $($IconScale * 100)%, corner radius $($CornerRadiusFraction * 100)% of icon)"
