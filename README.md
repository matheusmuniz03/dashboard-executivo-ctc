# Dashboard Executivo CTC O2C Royalties

Aplicação web em HTML, CSS e JavaScript puro para acompanhamento executivo do projeto CTC O2C Royalties. O projeto agora possui Home, dashboard público e área administrativa para editar as bases que alimentam o dashboard.

## Rotas

- `/` - Home inicial.
- `/dashboard` - Dashboard executivo público.
- `/atualizar-dados` - Área administrativa protegida por login.
- `/epico-01`, `/epico-02`, etc. - Detalhes dos épicos.

## Bases editáveis

A área administrativa lista e edita as bases reais usadas pelo dashboard:

- `dashboardConfig` - `config/dashboard-config.json`
- `epicosExecutivos` - `config/epicos-executivos.json`
- `frentesSemana` - `config/frentes-semana.json`
- `proximosPassos` - `config/proximos-passos.json`
- `statusNormalization` - `config/status-normalization.json`
- `generatedData` - `data/generated-data.json`

Listas de objetos abrem em modo tabela. Todas as bases também podem ser editadas em modo JSON bruto.

## APIs

- `POST /api/auth/login` - valida `ADMIN_USER` e `ADMIN_PASSWORD` e retorna token temporário.
- `GET /api/auth/session` - valida o token temporário da área administrativa.
- `GET /api/data` - retorna todas as bases editáveis e status do storage.
- `GET /api/data/:name` - retorna uma base específica.
- `PUT /api/data/:name` - salva uma base específica. Requer `Authorization: Bearer <token>`.
- `GET /api/data-manifest` - retorna manifesto das bases.

## Variáveis de ambiente

Copie `.env.example` para `.env` no ambiente local quando for usar a área administrativa:

```text
ADMIN_USER=matheus.muniz
ADMIN_PASSWORD=mudar123
ADMIN_SESSION_SECRET=
BLOB_READ_WRITE_TOKEN=
DATA_BLOB_PREFIX=ctc-dashboard/data
```

Na Vercel, configure pelo painel do projeto:

- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET` opcional, recomendado
- `BLOB_READ_WRITE_TOKEN`
- `DATA_BLOB_PREFIX` opcional

Sem `BLOB_READ_WRITE_TOKEN`, o dashboard continua funcionando com os JSONs locais. Em desenvolvimento, o servidor Node salva alterações em `.tmp/data-store/`. Em produção na Vercel, configure Vercel Blob para persistência compartilhada.

## Configurar Vercel Blob

1. No painel da Vercel, abra o projeto.
2. Vá em `Storage`.
3. Crie ou conecte um store do tipo Blob.
4. Copie o `BLOB_READ_WRITE_TOKEN` para as variáveis de ambiente do projeto.
5. Faça novo deploy.

## Rodar localmente

Instale dependências:

```bash
npm install
```

Defina as variáveis administrativas antes de subir o servidor:

```powershell
$env:ADMIN_USER="matheus.muniz"
$env:ADMIN_PASSWORD="mudar123"
npm run dev
```

Acesse:

```text
http://localhost:4173/
```

O `npm run dev` serve também as APIs locais. Sem Blob, salvamentos locais ficam em `.tmp/data-store/`.

## Build e preview

```bash
npm run build
npm run validate
npm run preview
```

Preview:

```text
http://localhost:4174/
```

## Atualizar bases brutas

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

Depois rode `npm run build`.

## Validar uma alteração salva

1. Acesse `/`.
2. Clique em `Atualizar Dados`.
3. Faça login com as variáveis configuradas.
4. Edite uma base, por exemplo `Frentes da semana`.
5. Clique em `Salvar alterações`.
6. Abra `/dashboard` e atualize a página.
7. Confirme que o dashboard refletiu a alteração.

Se a API ou o storage falhar, o dashboard usa fallback nos JSONs locais para não quebrar a visualização pública.

## Deploy na Vercel

Configuração esperada:

```text
Framework Preset: Other
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

O `vercel.json` já define rewrites para as rotas SPA e headers para evitar cache agressivo nos dados estáticos. As API routes ficam em `api/`.

## Segurança e limitações atuais

- A autenticação é temporária e usa token simples assinado no backend.
- Não há controle de papéis, auditoria completa ou rotação automática de sessão.
- O editor de tabela é indicado para listas de objetos simples; bases aninhadas devem ser editadas em JSON bruto.
- Em produção, sem Vercel Blob configurado, a API não grava alterações compartilhadas.

Próximos passos recomendados: autenticação real, auditoria de alterações, validação de schema por base e migração para um banco como Supabase, Neon/Postgres ou outro storage transacional.

## Exportar

Use o botão de impressão no cabeçalho do dashboard ou `Ctrl+P`. O CSS define página 16:9 para exportar como PDF.
