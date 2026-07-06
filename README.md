# Dashboard Executivo CTC O2C Royalties

Aplicação web estática em HTML, CSS e JavaScript puro para acompanhamento executivo do projeto CTC O2C Royalties. O deploy recomendado é estático na Vercel, com build para a pasta `dist/`.

## Stack

- HTML/CSS/JS puro, sem React, Vite ou Next.js.
- Dados consumidos no navegador a partir de `config/*.json` e `data/generated-data.json`.
- As planilhas brutas em `data/source/` ficam fora do build e não são publicadas.

## Rodar localmente

Instale as dependências. Atualmente não há pacotes externos, mas o comando mantém o fluxo padrão da Vercel.

```bash
npm install
```

Suba o servidor local:

```bash
npm run dev
```

Acesse:

```text
http://localhost:4173/
```

## Build e preview

Gerar build:

```bash
npm run build
```

Validar o build:

```bash
npm run validate
```

Abrir o preview do build:

```bash
npm run preview
```

Preview:

```text
http://localhost:4174/
```

## Atualizar dados

Substitua os arquivos mantendo estes nomes:

```text
data/source/base-historias.csv
data/source/epico-feature.csv
data/source/backlog-riscos-pendencias.xlsx
```

Gere novamente os JSONs usados pelo navegador:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\update-data.ps1
```

Depois rode:

```bash
npm run build
```

## Editar textos manuais

Use os arquivos em `config/`:

```text
config/dashboard-config.json
config/epicos-executivos.json
config/frentes-semana.json
config/proximos-passos.json
config/status-normalization.json
```

## Deploy na Vercel

Configuração esperada:

```text
Framework Preset: Other
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

O arquivo `vercel.json` já define `buildCommand`, `outputDirectory`, headers de cache para dados/configurações e rewrite para rota direta de detalhe de épico.

## Deploy via GitHub

1. Crie um repositório no GitHub.
2. Faça commit dos arquivos do projeto.
3. No painel da Vercel, clique em `Add New > Project`.
4. Importe o repositório.
5. Confirme as configurações acima.
6. Clique em `Deploy`.

A cada push na branch conectada, a Vercel cria um novo deploy automaticamente.

## Publicar no GitHub pelo terminal

Depois de instalar o Git for Windows e criar um repositório vazio no GitHub, rode:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1 -RemoteUrl "https://github.com/SEU-USUARIO/NOME-DO-REPO.git"
```

O script inicializa o Git, cria commit, configura o remote `origin` e faz push para a branch `main`.

As pastas `.agents/`, `.codex/`, `data/source/`, `dist/`, `node_modules/` e `.vercel/` ficam fora do versionamento.

## Variáveis de ambiente

Nenhuma variável de ambiente é obrigatória na versão estática atual. O arquivo `.env.example` existe apenas para documentar futuras integrações.

## Exportar

Use o botão de impressão no cabeçalho ou `Ctrl+P`. O CSS define página 16:9 para exportar como PDF.
