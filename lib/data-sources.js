export const DATA_SOURCES = [
  {
    name: "dashboardConfig",
    label: "Configurações gerais do dashboard",
    path: "config/dashboard-config.json",
    dashboardKey: "dashboardConfig",
    description: "Título, subtítulo, status geral, marcos, resumo e rodapé."
  },
  {
    name: "epicosExecutivos",
    label: "Épicos executivos",
    path: "config/epicos-executivos.json",
    dashboardKey: "epicosExecutivos",
    description: "Cards executivos, responsáveis, status e ações por épico."
  },
  {
    name: "frentesSemana",
    label: "Frentes da semana",
    path: "config/frentes-semana.json",
    dashboardKey: "frentesSemana",
    description: "Principais frentes conduzidas exibidas na parte inferior."
  },
  {
    name: "proximosPassos",
    label: "Próximos passos",
    path: "config/proximos-passos.json",
    dashboardKey: "proximosPassos",
    description: "Linha de próximos passos sugeridos e responsáveis."
  },
  {
    name: "statusNormalization",
    label: "Status e normalizações",
    path: "config/status-normalization.json",
    dashboardKey: "statusNormalization",
    description: "Ordem, cores e regras de normalização de status."
  },
  {
    name: "generatedData",
    label: "Dados gerados",
    path: "data/generated-data.json",
    dashboardKey: "generatedData",
    description: "Base consolidada de DevOps, planilhas, riscos e pendências."
  }
];

export function getDataSourceDefinition(name) {
  return DATA_SOURCES.find((source) => source.name === name) || null;
}

export function inferDataShape(value) {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value && typeof value === "object") {
    return "object";
  }
  return typeof value;
}

export function getRecordCount(value) {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length;
  }
  return 0;
}
