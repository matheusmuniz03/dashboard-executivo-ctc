param(
  [string]$StoriesCsv,
  [string]$EpicsCsv,
  [string]$BacklogXlsx
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if (-not $StoriesCsv) { $StoriesCsv = Join-Path $ProjectRoot "data\source\base-historias.csv" }
if (-not $EpicsCsv) { $EpicsCsv = Join-Path $ProjectRoot "data\source\epico-feature.csv" }
if (-not $BacklogXlsx) { $BacklogXlsx = Join-Path $ProjectRoot "data\source\backlog-riscos-pendencias.xlsx" }

function Assert-File($Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Arquivo não encontrado: $Path"
  }
}

function Read-ZipEntryText($Zip, [string]$Path) {
  $entry = $Zip.GetEntry($Path)
  if (-not $entry) { return $null }
  $reader = [System.IO.StreamReader]::new($entry.Open())
  try { return $reader.ReadToEnd() }
  finally { $reader.Close() }
}

function Convert-ColumnReference([string]$Reference) {
  $letters = ([regex]::Match($Reference, "^[A-Z]+")).Value
  $number = 0
  foreach ($char in $letters.ToCharArray()) {
    $number = ($number * 26) + ([int][char]$char - [int][char]'A' + 1)
  }
  return $number
}

function Convert-ExcelSerialDate([string]$Value) {
  $serial = 0.0
  if ([double]::TryParse($Value, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$serial) -and $serial -gt 20000) {
    return ([datetime]::FromOADate($serial)).ToString("yyyy-MM-dd")
  }
  return $Value
}

function Get-CellText($Cell, $Namespace, $SharedStrings) {
  $inline = $Cell.SelectSingleNode("x:is", $Namespace)
  if ($inline) {
    $parts = @($inline.SelectNodes(".//x:t", $Namespace) | ForEach-Object { $_.InnerText })
    return ($parts -join "")
  }

  $valueNode = $Cell.SelectSingleNode("x:v", $Namespace)
  if (-not $valueNode) { return "" }

  $value = $valueNode.InnerText
  if ($Cell.t -eq "s") {
    $index = [int]$value
    if ($index -ge 0 -and $index -lt $SharedStrings.Count) {
      return $SharedStrings[$index]
    }
  }

  if ($Cell.t -eq "b") {
    if ($value -eq "1") { return "TRUE" }
    return "FALSE"
  }

  return $value
}

function Get-UniqueHeaders($HeaderValues) {
  $seen = @{}
  $headers = @()
  for ($i = 0; $i -lt $HeaderValues.Count; $i++) {
    $header = ([string]$HeaderValues[$i]).Trim()
    if ([string]::IsNullOrWhiteSpace($header)) { $header = "Column$($i + 1)" }
    if ($seen.ContainsKey($header)) {
      $seen[$header] += 1
      $header = "$header`_$($seen[$header])"
    } else {
      $seen[$header] = 1
    }
    $headers += $header
  }
  return $headers
}

function Read-XlsxWorkbook([string]$Path) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $sharedStrings = @()
    $sharedText = Read-ZipEntryText $zip "xl/sharedStrings.xml"
    if ($sharedText) {
      $sharedXml = [xml]$sharedText
      $sharedNs = [System.Xml.XmlNamespaceManager]::new($sharedXml.NameTable)
      $sharedNs.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
      foreach ($item in $sharedXml.SelectNodes("//x:si", $sharedNs)) {
        $sharedStrings += (@($item.SelectNodes(".//x:t", $sharedNs) | ForEach-Object { $_.InnerText }) -join "")
      }
    }

    $workbookXml = [xml](Read-ZipEntryText $zip "xl/workbook.xml")
    $bookNs = [System.Xml.XmlNamespaceManager]::new($workbookXml.NameTable)
    $bookNs.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    $bookNs.AddNamespace("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")

    $relsXml = [xml](Read-ZipEntryText $zip "xl/_rels/workbook.xml.rels")
    $rels = @{}
    foreach ($rel in $relsXml.Relationships.Relationship) {
      $rels[$rel.Id] = $rel.Target
    }

    $result = [ordered]@{
      sheetNames = @()
      sheets = [ordered]@{}
    }

    foreach ($sheet in $workbookXml.SelectNodes("//x:sheets/x:sheet", $bookNs)) {
      $name = $sheet.name
      $rid = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
      $target = $rels[$rid]
      if (-not $target) { continue }
      $target = $target.TrimStart("/")
      if (-not $target.StartsWith("xl/")) { $target = "xl/$target" }
      $sheetText = Read-ZipEntryText $zip $target
      if (-not $sheetText) { continue }

      $sheetXml = [xml]$sheetText
      $sheetNs = [System.Xml.XmlNamespaceManager]::new($sheetXml.NameTable)
      $sheetNs.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
      $rows = $sheetXml.SelectNodes("//x:sheetData/x:row", $sheetNs)

      $headers = $null
      $items = @()

      foreach ($row in $rows) {
        $cells = @{}
        foreach ($cell in $row.SelectNodes("x:c", $sheetNs)) {
          $column = Convert-ColumnReference $cell.r
          $cells[$column] = Get-CellText $cell $sheetNs $sharedStrings
        }

        if ($cells.Count -eq 0) { continue }
        $maxColumn = ($cells.Keys | Measure-Object -Maximum).Maximum
        $values = @()
        for ($column = 1; $column -le $maxColumn; $column++) {
          if ($cells.ContainsKey($column)) { $values += $cells[$column] } else { $values += "" }
        }

        if (-not $headers) {
          $headers = Get-UniqueHeaders $values
          continue
        }

        $object = [ordered]@{}
        $hasValue = $false
        for ($i = 0; $i -lt $headers.Count; $i++) {
          $value = ""
          if ($i -lt $values.Count) { $value = [string]$values[$i] }
          if ($headers[$i] -match "Data" -and $value -match "^\d+(\.\d+)?$") {
            $value = Convert-ExcelSerialDate $value
          }
          if (-not [string]::IsNullOrWhiteSpace($value)) { $hasValue = $true }
          $object[$headers[$i]] = $value
        }

        if ($hasValue) { $items += [pscustomobject]$object }
      }

      $result.sheetNames += $name
      $result.sheets[$name] = @($items)
    }

    return $result
  }
  finally {
    $zip.Dispose()
  }
}

Assert-File $StoriesCsv
Assert-File $EpicsCsv
Assert-File $BacklogXlsx

$stories = @(Import-Csv -LiteralPath $StoriesCsv -Encoding UTF8)
$epicsFeatures = @(Import-Csv -LiteralPath $EpicsCsv -Encoding UTF8)
$workbook = Read-XlsxWorkbook $BacklogXlsx

$data = [ordered]@{
  metadata = [ordered]@{
    generatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
    sourceFiles = [ordered]@{
      stories = (Split-Path $StoriesCsv -Leaf)
      epicsFeatures = (Split-Path $EpicsCsv -Leaf)
      backlog = (Split-Path $BacklogXlsx -Leaf)
    }
    counts = [ordered]@{
      stories = $stories.Count
      epicsFeatures = $epicsFeatures.Count
      workbookSheets = $workbook.sheetNames.Count
    }
  }
  devopsStories = $stories
  devopsEpicsFeatures = $epicsFeatures
  workbook = $workbook
}

$dataJson = $data | ConvertTo-Json -Depth 100
$dataJsonPath = Join-Path $ProjectRoot "data\generated-data.json"
$dataJsPath = Join-Path $ProjectRoot "data\generated-data.js"
Set-Content -LiteralPath $dataJsonPath -Value $dataJson -Encoding UTF8
Set-Content -LiteralPath $dataJsPath -Value "window.DASHBOARD_GENERATED_DATA = $dataJson;" -Encoding UTF8

$configFiles = [ordered]@{
  dashboardConfig = "dashboard-config.json"
  epicosExecutivos = "epicos-executivos.json"
  frentesSemana = "frentes-semana.json"
  proximosPassos = "proximos-passos.json"
  statusNormalization = "status-normalization.json"
}

$configs = [ordered]@{}
foreach ($key in $configFiles.Keys) {
  $path = Join-Path $ProjectRoot ("config\" + $configFiles[$key])
  if (Test-Path -LiteralPath $path -PathType Leaf) {
    $rawConfig = Get-Content -LiteralPath $path -Raw -Encoding UTF8
    $convertedConfig = $rawConfig | ConvertFrom-Json
    if ($rawConfig.TrimStart().StartsWith("[")) {
      $configs[$key] = @($convertedConfig)
    } else {
      $configs[$key] = $convertedConfig
    }
  }
}

$configJson = $configs | ConvertTo-Json -Depth 100
Set-Content -LiteralPath (Join-Path $ProjectRoot "config\config-globals.js") -Value "window.DASHBOARD_CONFIGS = $configJson;" -Encoding UTF8

Write-Host "Dados gerados em data\generated-data.json"
Write-Host "Fallback local gerado em data\generated-data.js e config\config-globals.js"
