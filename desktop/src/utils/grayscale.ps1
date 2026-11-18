param(
    [Parameter(Mandatory=$true)][string]$InputPath,
    [Parameter(Mandatory=$true)][string]$OutputPath
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile($InputPath)
$bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)

$cm = New-Object System.Drawing.Imaging.ColorMatrix
$cm.Matrix00 = 0.299; $cm.Matrix01 = 0.299; $cm.Matrix02 = 0.299
$cm.Matrix10 = 0.587; $cm.Matrix11 = 0.587; $cm.Matrix12 = 0.587
$cm.Matrix20 = 0.114; $cm.Matrix21 = 0.114; $cm.Matrix22 = 0.114
$cm.Matrix33 = 1.0;   $cm.Matrix44 = 1.0

$ia = New-Object System.Drawing.Imaging.ImageAttributes
$ia.SetColorMatrix($cm)

$rect = New-Object System.Drawing.Rectangle(0, 0, $img.Width, $img.Height)
$g.DrawImage($img, $rect, 0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel, $ia)

$g.Dispose()
$img.Dispose()

$ext = [System.IO.Path]::GetExtension($OutputPath).ToLower()
$format = [System.Drawing.Imaging.ImageFormat]::Jpeg
if ($ext -eq ".png") {
    $format = [System.Drawing.Imaging.ImageFormat]::Png
} elseif ($ext -eq ".bmp") {
    $format = [System.Drawing.Imaging.ImageFormat]::Bmp
}

# Save grayscale output
$bmp.Save($OutputPath, $format)
$bmp.Dispose()
Write-Host "✓ Successfully converted image to Black & White (Grayscale)"
