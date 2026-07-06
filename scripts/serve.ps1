param(
  [int]$Port = 4173,
  [string]$Root
)

$ErrorActionPreference = "Stop"
if (-not $Root) { $Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path }
$Root = [System.IO.Path]::GetFullPath($Root)

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".csv" = "text/csv; charset=utf-8"
  ".xlsx" = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
}

function Send-Response($Client, [int]$Status, [string]$Reason, [string]$ContentType, [byte[]]$Body, [bool]$HeadOnly) {
  $stream = $Client.GetStream()
  $headers = @(
    "HTTP/1.1 $Status $Reason",
    "Content-Type: $ContentType",
    "Content-Length: $($Body.Length)",
    "Connection: close",
    "",
    ""
  ) -join "`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if (-not $HeadOnly -and $Body.Length -gt 0) {
    $stream.Write($Body, 0, $Body.Length)
  }
}

function Send-StaticText($Client, [int]$Status, [string]$Text, [bool]$HeadOnly) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  Send-Response $Client $Status "OK" "text/plain; charset=utf-8" $bytes $HeadOnly
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
$listener.Start()
$prefix = "http://127.0.0.1:$Port/"
Write-Host "Dashboard disponível em $prefix"
Write-Host "Pressione Ctrl+C para parar."

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        $client.Close()
        continue
      }

      do {
        $line = $reader.ReadLine()
      } while ($line -ne $null -and $line -ne "")

      $parts = $requestLine.Split(" ")
      $method = $parts[0]
      $target = if ($parts.Count -gt 1) { $parts[1] } else { "/" }
      $headOnly = $method -eq "HEAD"

      if ($method -ne "GET" -and $method -ne "HEAD") {
        Send-StaticText $client 405 "Método não permitido" $headOnly
        continue
      }

      if ($target.Contains("?")) { $target = $target.Split("?")[0] }
      $relativePath = [System.Uri]::UnescapeDataString($target.TrimStart("/")).Replace("/", "\")
      if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = "index.html" }

      $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, $relativePath))
      if (-not $fullPath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-StaticText $client 403 "Acesso negado" $headOnly
        continue
      }

      if ((Test-Path -LiteralPath $fullPath -PathType Container)) {
        $fullPath = Join-Path $fullPath "index.html"
      }

      if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        Send-StaticText $client 404 "Arquivo não encontrado" $headOnly
        continue
      }

      $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
      $contentType = "application/octet-stream"
      if ($contentTypes.ContainsKey($extension)) { $contentType = $contentTypes[$extension] }

      $bytes = [System.IO.File]::ReadAllBytes($fullPath)
      Send-Response $client 200 "OK" $contentType $bytes $headOnly
    }
    finally {
      $client.Close()
    }
  }
}
finally {
  $listener.Stop()
}
