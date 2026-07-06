param(
  [Parameter(Mandatory = $true)]
  [string]$RemoteUrl,

  [string]$Branch = "main",
  [string]$CommitMessage = "Prepare dashboard for Vercel deploy"
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Comando '$Name' nao encontrado. Instale o Git for Windows antes de publicar."
  }
}

Require-Command "git"

Write-Host "Inicializando repositorio Git, se necessario..."
git init

Write-Host "Configurando branch $Branch..."
git checkout -B $Branch

Write-Host "Adicionando arquivos versionaveis..."
git add .

$status = git status --porcelain
if ($status) {
  Write-Host "Criando commit..."
  git commit -m $CommitMessage
} else {
  Write-Host "Nenhuma alteracao nova para commit."
}

$existingOrigin = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0 -and $existingOrigin) {
  Write-Host "Atualizando remote origin..."
  git remote set-url origin $RemoteUrl
} else {
  Write-Host "Configurando remote origin..."
  git remote add origin $RemoteUrl
}

Write-Host "Enviando para GitHub..."
git push -u origin $Branch

Write-Host "Publicado com sucesso em $RemoteUrl"
