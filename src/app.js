(function () {
  "use strict";

  var appState = null;

  var CONFIG_PATHS = {
    dashboardConfig: "config/dashboard-config.json",
    epicosExecutivos: "config/epicos-executivos.json",
    frentesSemana: "config/frentes-semana.json",
    proximosPassos: "config/proximos-passos.json",
    statusNormalization: "config/status-normalization.json"
  };

  var DAY_MS = 24 * 60 * 60 * 1000;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      var configs = await loadConfigs();
      var data = await loadData();
      appState = { configs: configs, data: data };
      window.addEventListener("hashchange", renderCurrentRoute);
      window.addEventListener("popstate", renderCurrentRoute);
      renderCurrentRoute();
    } catch (error) {
      renderError(error);
    }
  }

  async function loadConfigs() {
    var globals = window.DASHBOARD_CONFIGS || {};
    var config = {};
    var keys = Object.keys(CONFIG_PATHS);
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      config[key] = normalizeConfigValue(key, await readJson(CONFIG_PATHS[key], globals[key] || defaultConfig(key)));
    }
    return config;
  }

  function normalizeConfigValue(key, value) {
    if (value && !Array.isArray(value) && Array.isArray(value.value)) {
      return value.value;
    }
    return value;
  }

  async function loadData() {
    return readJson("data/generated-data.json", window.DASHBOARD_GENERATED_DATA || defaultData());
  }

  async function readJson(path, fallback) {
    try {
      var response = await fetch(path, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(path + " retornou HTTP " + response.status);
      }
      return response.json();
    } catch (error) {
      return clone(fallback);
    }
  }

  function clone(value) {
    if (value === undefined || value === null) {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function defaultData() {
    return {
      metadata: { generatedAt: null, counts: { stories: 0, epicsFeatures: 0, workbookSheets: 0 } },
      devopsStories: [],
      devopsEpicsFeatures: [],
      workbook: { sheetNames: [], sheets: {} }
    };
  }

  function defaultConfig(key) {
    if (key === "statusNormalization") {
      return {
        statusOrder: ["Em Produção", "Em Homologação", "Em Andamento", "Bloqueado", "Backlog"],
        statusColors: {
          "Em Produção": "#075a57",
          "Em Homologação": "#159b95",
          "Em Andamento": "#a9d72d",
          "Bloqueado": "#f38b2e",
          "Backlog": "#d8dde3"
        },
        mappings: []
      };
    }
    if (key === "dashboardConfig") {
      return {
        project: {
          title: "Projeto CTC • O2C Royalties",
          subtitle: "Status Report Executivo",
          goLiveDate: "2027-03-01",
          statusGeneral: "Atenção",
          statusCaption: "Em homologação"
        },
        summary: {
          projectStatus: "Em Homologação",
          projectStatusCaption: "Fase atual do projeto",
          projectProgress: 72
        },
        milestones: []
      };
    }
    return [];
  }

  function renderCurrentRoute() {
    if (!appState) {
      return;
    }

    var routeEpicId = getRouteEpicId();
    if (routeEpicId) {
      renderEpicDetail(routeEpicId);
      return;
    }
    renderDashboard();
  }

  function getRouteEpicId() {
    var hash = window.location.hash || "";
    var hashMatch = hash.match(/^#epico-([0-9]{2})$/);
    if (hashMatch) {
      return hashMatch[1];
    }

    var pathMatch = window.location.pathname.match(/^\/epico-([0-9]{2})\/?$/);
    if (pathMatch) {
      return pathMatch[1];
    }

    return null;
  }

  function renderDashboard() {
    var configs = appState.configs;
    var data = appState.data;
    var metrics = calculateMetrics(data, configs);
    var overview = buildEpicOverview(data, configs);
    var app = document.getElementById("app");

    app.innerHTML =
      '<div class="dashboard-shell">' +
        renderHeader(metrics, configs) +
        '<main class="dashboard-main">' +
          renderSummaryCards(metrics, configs) +
          '<div class="main-grid">' +
            renderEpicOverview(overview, configs.statusNormalization) +
            renderExecutiveBoard(asArray(configs.epicosExecutivos), configs.statusNormalization) +
          '</div>' +
          '<div class="lower-grid">' +
            renderWeekHighlights(resolveWeekHighlights(configs, data)) +
            renderNextSteps(resolveNextSteps(configs, data)) +
          '</div>' +
        '</main>' +
        renderFooter(metrics, configs) +
      '</div>';

    bindDashboardEvents();
  }

  function renderHeader(metrics, configs) {
    var project = (configs.dashboardConfig && configs.dashboardConfig.project) || {};
    return (
      '<header class="topbar">' +
        '<div class="brand-block">' +
          '<img class="brand-logo" src="assets/logos/ctc.svg" alt="CTC">' +
          '<span class="brand-separator" aria-hidden="true"></span>' +
          '<div>' +
            '<h1>' + esc(project.title || "Projeto CTC • O2C Royalties") + '</h1>' +
            '<p>' + esc(project.subtitle || "Status Report Executivo") + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="top-actions">' +
          '<button class="icon-button print-button" type="button" title="Exportar PDF/PNG" aria-label="Exportar PDF ou PNG">' + icon("printer") + '</button>' +
        '</div>' +
        '<div class="kpi-strip">' +
          renderTopKpi("Dias para Go-Live", metrics.daysToGoLive, "Go-Live previsto: " + formatDateBr(metrics.goLiveDate), "calendar", "hero") +
          renderTopKpi("Sprint Atual", metrics.currentSprint || "A definir", metrics.currentSprint ? "Sprint " + metrics.currentSprint : "Sem sprint inferida", "sprint") +
          renderTopKpi("Status Geral", metrics.statusGeneral, metrics.statusCaption, "shield") +
          renderTopKpi("Features em Validação", metrics.featuresInValidation, "Itens em validação", "validation") +
          renderTopKpi("Bloqueios", metrics.blockers, "Itens bloqueados", "lock") +
          renderTopKpi("Riscos Críticos", metrics.criticalRisks, "Riscos críticos", "warning") +
          renderTopKpi("Próximo Marco", metrics.nextMilestoneDateLabel, metrics.nextMilestoneName, "flag") +
        '</div>' +
      '</header>'
    );
  }

  function renderTopKpi(label, value, caption, iconName, variant) {
    return (
      '<article class="top-kpi ' + (variant ? "top-kpi-" + variant : "") + '">' +
        '<span class="top-kpi-label">' + esc(label) + '</span>' +
        '<div class="top-kpi-main">' +
          '<strong>' + esc(value) + '</strong>' +
          '<span class="top-kpi-icon">' + icon(iconName) + '</span>' +
        '</div>' +
        '<small>' + esc(caption || "") + '</small>' +
      '</article>'
    );
  }

  function renderSummaryCards(metrics, configs) {
    var summary = (configs.dashboardConfig && configs.dashboardConfig.summary) || {};
    var validationTotalText = metrics.validationTotal > 0
      ? metrics.validationCompleted + " de " + metrics.validationTotal + " priorizadas"
      : "Sem validações priorizadas";

    return (
      '<section class="summary-grid" aria-label="Resumo executivo">' +
        '<article class="summary-card status-summary">' +
          '<div class="summary-icon rocket-icon">' + icon("rocket") + '</div>' +
          '<div class="summary-copy">' +
            '<h2>Status do Projeto</h2>' +
            '<strong>' + esc(summary.projectStatus || "Em Homologação") + '</strong>' +
            '<span>' + esc(summary.projectStatusCaption || "Fase atual do projeto") + '</span>' +
            '<div class="progress-rail" aria-hidden="true"><i style="width: ' + clamp(summary.projectProgress || 0, 0, 100) + '%"></i></div>' +
          '</div>' +
        '</article>' +
        '<article class="summary-card">' +
          '<div class="summary-icon cubes-icon">' + icon("cubes") + '</div>' +
          '<div class="summary-copy">' +
            '<h2>Escopo disponível para testes</h2>' +
            '<strong>' + esc(metrics.testScope) + '</strong>' +
            '<span>Épicos / Features disponíveis para testes</span>' +
          '</div>' +
        '</article>' +
        '<article class="summary-card validation-summary">' +
          '<div class="donut" style="--percent: ' + clamp(metrics.validationPercent, 0, 100) + '"><span>' + esc(metrics.validationPercent) + '%</span></div>' +
          '<div class="summary-copy">' +
            '<h2>Validações concluídas</h2>' +
            '<strong>' + esc(metrics.validationPercent) + '%</strong>' +
            '<span>' + esc(validationTotalText) + '</span>' +
          '</div>' +
        '</article>' +
      '</section>'
    );
  }

  function renderEpicOverview(overview, normalization) {
    var order = getStatusOrder(normalization);
    var legend = order.map(function (status) {
      return '<span class="legend-item"><i style="background:' + escAttr(getStatusColor(status, normalization)) + '"></i>' + esc(status) + '</span>';
    }).join("");

    var rows = overview.map(function (item) {
      var total = Math.max(item.total, 0);
      var segments = order.map(function (status) {
        var count = item.counts[status] || 0;
        if (count <= 0) {
          return "";
        }
        var width = total > 0 ? (count / total) * 100 : 0;
        return (
          '<span class="stack-segment" style="width:' + width + '%;background:' + escAttr(getStatusColor(status, normalization)) + '">' +
            (width >= 12 ? '<b>' + count + '</b>' : '') +
          '</span>'
        );
      }).join("");

      return (
        '<div class="chart-row">' +
          '<div class="chart-label"><span>' + esc(item.id) + '</span>' + esc(item.title) + '</div>' +
          '<div class="stack-bar">' + (segments || '<span class="stack-empty">Sem itens</span>') + '</div>' +
          '<div class="chart-total">' + esc(total) + '</div>' +
        '</div>'
      );
    }).join("");

    return (
      '<section class="panel chart-panel">' +
        sectionTitle("Visão Geral dos Épicos") +
        '<div class="chart-legend">' + legend + '</div>' +
        '<div class="stacked-chart">' + rows + '</div>' +
      '</section>'
    );
  }

  function renderExecutiveBoard(epics, normalization) {
    var cards = asArray(epics).map(function (epic) {
      var palette = getExecutiveStatusPalette(epic.status, normalization);
      return (
        '<button class="epic-card" type="button" data-epic="' + escAttr(epic.id) + '">' +
          '<span class="epic-number">' + esc(epic.id) + '</span>' +
          '<strong>' + esc(epic.title) + '</strong>' +
          '<em style="--pill-bg:' + escAttr(palette.bg) + ';--pill-fg:' + escAttr(palette.fg) + '">' + esc(epic.status) + '</em>' +
          '<dl>' +
            '<div><dt>Responsável</dt><dd>' + icon("user") + esc(epic.responsible || "A definir") + '</dd></div>' +
            '<div><dt>Próxima ação</dt><dd>' + esc(epic.nextAction || "A definir") + '</dd></div>' +
          '</dl>' +
        '</button>'
      );
    }).join("");

    return (
      '<section class="panel executive-panel">' +
        sectionTitle("Quadro Executivo dos Épicos") +
        '<div class="executive-grid">' + cards + '</div>' +
      '</section>'
    );
  }

  function renderWeekHighlights(items) {
    var cards = items.slice(0, 8).map(function (item, index) {
      return (
        '<article class="week-card">' +
          '<span>' + String(index + 1).padStart(2, "0") + '</span>' +
          '<h3>' + esc(item.title || item.Nome || "Frente") + '</h3>' +
          '<p>' + esc(item.description || item.Descrição || "") + '</p>' +
        '</article>'
      );
    }).join("");

    return (
      '<section class="panel week-panel">' +
        sectionTitle("Principais frentes conduzidas na semana") +
        '<div class="week-grid">' + cards + '</div>' +
      '</section>'
    );
  }

  function renderNextSteps(items) {
    var steps = items.slice(0, 6).map(function (item) {
      return (
        '<article class="timeline-item">' +
          '<div class="timeline-icon">' + icon(item.icon || "flag") + '</div>' +
          '<h3>' + esc(item.title || item.Nome || "Próximo passo") + '</h3>' +
          '<p><b>Responsável:</b> ' + esc(item.responsible || item.Responsável || "A definir") + '</p>' +
          '<p class="timeline-date">' + icon("calendar") + esc(item.dateLabel || item.Recorrência || item.Data || "A definir") + '</p>' +
        '</article>'
      );
    }).join("");

    return (
      '<section class="panel timeline-panel">' +
        sectionTitle("Próximos passos sugeridos") +
        '<div class="timeline">' + steps + '</div>' +
      '</section>'
    );
  }

  function renderFooter(metrics, configs) {
    var footerConfig = (configs.dashboardConfig && configs.dashboardConfig.footer) || {};
    var logos = footerConfig.logos || ["sydle", "levty", "ctc", "integra"];
    var logoMarkup = logos.map(function (logo) {
      return '<img src="assets/logos/' + escAttr(logo) + '.svg" alt="' + escAttr(logo) + '">';
    }).join("");

    var updated = footerConfig.showUpdatedAt === false
      ? ""
      : '<span>Dados atualizados em: ' + esc(metrics.updatedAtLabel) + '</span>';

    return (
      '<footer class="dashboard-footer">' +
        '<div class="footer-meta">' + updated + '</div>' +
        '<div class="footer-logos">' + logoMarkup + '</div>' +
      '</footer>'
    );
  }

  function renderEpicDetail(epicId) {
    var configs = appState.configs;
    var data = appState.data;
    var epic = asArray(configs.epicosExecutivos).find(function (item) { return item.id === epicId; });

    if (!epic) {
      window.location.hash = "";
      return;
    }

    var detail = buildEpicDetail(epic, data, configs);
    var app = document.getElementById("app");
    app.innerHTML =
      '<div class="detail-shell">' +
        '<header class="detail-header">' +
          '<button class="back-button" type="button">' + icon("arrow-left") + '<span>Voltar</span></button>' +
          '<div>' +
            '<span>Épico ' + esc(epic.id) + '</span>' +
            '<h1>' + esc(epic.title) + '</h1>' +
          '</div>' +
          '<button class="icon-button print-button" type="button" title="Exportar PDF/PNG" aria-label="Exportar PDF ou PNG">' + icon("printer") + '</button>' +
        '</header>' +
        '<main class="detail-main">' +
          '<section class="detail-summary-band">' +
            renderDetailMetric("Status executivo", epic.status, "shield") +
            renderDetailMetric("Responsável", epic.responsible || "A definir", "user") +
            renderDetailMetric("Features", detail.features.length, "cubes") +
            renderDetailMetric("Histórias", detail.stories.length, "checklist") +
          '</section>' +
          '<section class="detail-section detail-action">' +
            sectionTitle("Próxima ação") +
            '<p>' + esc(epic.nextAction || "A definir") + '</p>' +
          '</section>' +
          renderDiagram(epic) +
          renderDetailTable("Features relacionadas", detail.features, ["ID", "Title", "State"], ["ID", "Título", "Status"]) +
          renderDetailTable("Histórias relacionadas", detail.stories.slice(0, 18), ["ID", "Title", "State", "Iteration Path"], ["ID", "História", "Status", "Sprint"]) +
          renderPendingList(detail.pendingItems) +
        '</main>' +
      '</div>';

    document.querySelector(".back-button").addEventListener("click", function () {
      navigateHome();
    });
    document.querySelector(".print-button").addEventListener("click", function () {
      window.print();
    });
  }

  function renderDetailMetric(label, value, iconName) {
    return (
      '<article>' +
        '<span>' + icon(iconName) + '</span>' +
        '<div><small>' + esc(label) + '</small><strong>' + esc(value) + '</strong></div>' +
      '</article>'
    );
  }

  function renderDiagram(epic) {
    if (!epic.diagram) {
      return "";
    }
    return (
      '<section class="detail-section diagram-section">' +
        sectionTitle("Fluxo navegável de referência") +
        '<div class="diagram-frame"><img src="' + escAttr(epic.diagram) + '" alt="Fluxo de referência do épico ' + escAttr(epic.id) + '"></div>' +
      '</section>'
    );
  }

  function renderDetailTable(title, rows, keys, headers) {
    var body = rows.length
      ? rows.map(function (row) {
          return '<tr>' + keys.map(function (key) { return '<td>' + esc(row[key] || "") + '</td>'; }).join("") + '</tr>';
        }).join("")
      : '<tr><td colspan="' + keys.length + '">Nenhum item relacionado encontrado.</td></tr>';

    return (
      '<section class="detail-section">' +
        sectionTitle(title) +
        '<div class="table-wrap"><table><thead><tr>' + headers.map(function (header) { return '<th>' + esc(header) + '</th>'; }).join("") + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      '</section>'
    );
  }

  function renderPendingList(rows) {
    var items = rows.length
      ? rows.map(function (row) {
          return (
            '<li>' +
              '<strong>' + esc(row.Tipo || "Item") + '</strong>' +
              '<span>' + esc(row.Descrição || row.Nome || "") + '</span>' +
              '<em>' + esc(row.Status || "Sem status") + '</em>' +
            '</li>'
          );
        }).join("")
      : '<li class="empty-list">Nenhuma pendência ou risco relacionado encontrado.</li>';

    return (
      '<section class="detail-section pending-section">' +
        sectionTitle("Pendências e riscos relacionados") +
        '<ul>' + items + '</ul>' +
      '</section>'
    );
  }

  function bindDashboardEvents() {
    var printButton = document.querySelector(".print-button");
    if (printButton) {
      printButton.addEventListener("click", function () { window.print(); });
    }

    var epicCards = document.querySelectorAll(".epic-card");
    for (var i = 0; i < epicCards.length; i += 1) {
      epicCards[i].addEventListener("click", function (event) {
        window.location.hash = "epico-" + event.currentTarget.getAttribute("data-epic");
      });
    }
  }

  function navigateHome() {
    if (window.location.pathname.match(/^\/epico-[0-9]{2}\/?$/)) {
      window.history.pushState({}, "", "/");
      renderCurrentRoute();
      return;
    }
    window.location.hash = "";
  }

  function calculateMetrics(data, configs) {
    var dashboard = configs.dashboardConfig || {};
    var project = dashboard.project || {};
    var summary = dashboard.summary || {};
    var normalization = configs.statusNormalization || {};
    var goLiveDate = project.goLiveDate || "2027-03-01";
    var goLive = parseDate(goLiveDate);
    var today = startOfDay(new Date());
    var validationRows = getSheetRows(data, ["Homologação de features", "Homologacao de features"]);
    var pendingRows = getSheetRows(data, ["Pendencias e Riscos", "Pendências e Riscos"]);
    var refinamentoRows = getSheetRows(data, ["Refinamento Épicos", "Refinamento Epicos"]);
    var validationProgress = calculateValidationProgress(validationRows, dashboard);
    var nextMilestone = getNextMilestone(dashboard.milestones || [], today);

    return {
      goLiveDate: goLiveDate,
      daysToGoLive: goLive ? Math.max(0, Math.ceil((goLive - today) / DAY_MS)) : "A definir",
      currentSprint: findCurrentSprint([].concat(data.devopsStories || [], data.devopsEpicsFeatures || [])),
      statusGeneral: project.statusGeneral || "Atenção",
      statusCaption: project.statusCaption || "Em homologação",
      featuresInValidation: countFeaturesInValidation(validationRows, data, normalization),
      blockers: countBlockers(pendingRows),
      criticalRisks: countCriticalRisks(pendingRows),
      nextMilestoneName: nextMilestone ? nextMilestone.name : "A definir",
      nextMilestoneDateLabel: nextMilestone && nextMilestone.date ? formatDateBr(nextMilestone.date) : "A definir",
      testScope: summary.testScopeOverride !== null && summary.testScopeOverride !== undefined ? summary.testScopeOverride : countTestScope(refinamentoRows, asArray(configs.epicosExecutivos)),
      validationPercent: summary.validationProgressOverride !== null && summary.validationProgressOverride !== undefined ? summary.validationProgressOverride : validationProgress.percent,
      validationCompleted: validationProgress.completed,
      validationTotal: validationProgress.total,
      updatedAtLabel: formatGeneratedAt(data.metadata && data.metadata.generatedAt)
    };
  }

  function buildEpicOverview(data, configs) {
    var normalization = configs.statusNormalization || {};
    var order = getStatusOrder(normalization);
    var epicsConfig = asArray(configs.epicosExecutivos);
    var rows = data.devopsEpicsFeatures || [];
    var features = rows.filter(function (row) { return clean(row["Work Item Type"]) === "feature"; });
    var validationStatusMap = getValidationStatusMap(getSheetRows(data, ["Homologação de features", "Homologacao de features"]));

    return epicsConfig.map(function (epic) {
      var counts = {};
      for (var i = 0; i < order.length; i += 1) {
        counts[order[i]] = 0;
      }

      var epicFeatures = features.filter(function (feature) {
        return String(feature.Parent || "") === String(epic.devopsEpicId || "");
      });

      epicFeatures.forEach(function (feature) {
        var rawStatus = validationStatusMap[String(feature.ID)] || feature.State || "Backlog";
        var normalized = normalizeStatus(rawStatus, normalization);
        if (order.indexOf(normalized) === -1) {
          normalized = "Backlog";
        }
        counts[normalized] += 1;
      });

      return {
        id: epic.id,
        title: epic.title,
        counts: counts,
        total: epicFeatures.length
      };
    });
  }

  function buildEpicDetail(epic, data, configs) {
    var epicsFeatures = data.devopsEpicsFeatures || [];
    var stories = data.devopsStories || [];
    var features = epicsFeatures.filter(function (row) {
      return clean(row["Work Item Type"]) === "feature" && String(row.Parent || "") === String(epic.devopsEpicId || "");
    });
    var featureIds = features.map(function (feature) { return String(feature.ID || ""); });
    var titleNeedles = getEpicNeedles(epic);

    var relatedStories = stories.filter(function (story) {
      if (featureIds.indexOf(String(story.Parent || "")) >= 0) {
        return true;
      }
      return titleNeedles.some(function (needle) { return clean(story.Title).indexOf(needle) >= 0; });
    });

    var pendingRows = getSheetRows(data, ["Pendencias e Riscos", "Pendências e Riscos"]);
    var pendingItems = pendingRows.filter(function (row) {
      var text = clean([row.Descrição, row.Nome, row.Impacto, row.Status].join(" "));
      return titleNeedles.some(function (needle) { return text.indexOf(needle) >= 0; });
    });

    return {
      features: features,
      stories: relatedStories,
      pendingItems: pendingItems,
      configs: configs
    };
  }

  function getEpicNeedles(epic) {
    var needles = [clean(epic.title)];
    if (epic.id) {
      needles.push("epico " + Number(epic.id));
      needles.push(Number(epic.id) + " ");
      needles.push(Number(epic.id) + ".");
    }
    return needles.filter(Boolean);
  }

  function calculateValidationProgress(rows, dashboard) {
    var validationConfig = dashboard.validation || {};
    var completedStatus = validationConfig.completedStatuses || [];
    var prioritizedStatus = validationConfig.prioritizedStatuses || [];

    var relevant = rows.filter(function (row) {
      var statusText = [row["De Para Status"], row.Status].join(" ");
      if (matchesAny(statusText, ["Cancelado", "Removed", "Backlog"])) {
        return false;
      }
      return matchesAny(statusText, prioritizedStatus.concat(completedStatus));
    });

    var completed = relevant.filter(function (row) {
      return matchesAny([row["De Para Status"], row.Status].join(" "), completedStatus);
    });

    return {
      completed: completed.length,
      total: relevant.length,
      percent: relevant.length ? Math.round((completed.length / relevant.length) * 100) : 0
    };
  }

  function countFeaturesInValidation(rows, data, normalization) {
    if (rows.length) {
      var seen = {};
      rows.forEach(function (row, index) {
        var status = normalizeStatus(row["De Para Status"] || row.Status || "", normalization);
        if (status === "Em Homologação") {
          seen[String(row.ID || index)] = true;
        }
      });
      return Object.keys(seen).length;
    }

    return (data.devopsEpicsFeatures || []).filter(function (row) {
      return clean(row["Work Item Type"]) === "feature" && normalizeStatus(row.State, normalization) === "Em Homologação";
    }).length;
  }

  function countBlockers(rows) {
    return rows.filter(function (row) {
      var status = clean(row.Status);
      var text = clean([row.Status, row.Situação, row.Situacao, row.Bloqueio, row.Bloqueado].join(" "));
      return !isClosedStatus(status) && (text.indexOf("bloqueado") >= 0 || text.indexOf("blocked") >= 0 || text.indexOf("impedido") >= 0);
    }).length;
  }

  function countCriticalRisks(rows) {
    return rows.filter(function (row) {
      var status = clean(row.Status);
      var type = clean(row.Tipo);
      var criticality = clean([row.Criticidade, row.Prioridade, row.Risco, row.Status].join(" "));
      var isRisk = type.indexOf("risco") >= 0;
      var isCritical = criticality.indexOf("critica") >= 0 || criticality.indexOf("critico") >= 0;
      return isRisk && isCritical && !isClosedStatus(status);
    }).length;
  }

  function countTestScope(refinamentoRows, executiveEpics) {
    var availableRows = refinamentoRows.filter(function (row) {
      var status = clean(row.Status);
      return status.indexOf("disponivel") >= 0 || status.indexOf("homologacao") >= 0;
    });
    if (availableRows.length) {
      return availableRows.length;
    }

    return (executiveEpics || []).filter(function (epic) {
      var status = clean(epic.status);
      return status.indexOf("disponivel") >= 0 || status.indexOf("homologacao") >= 0;
    }).length;
  }

  function getValidationStatusMap(rows) {
    var map = {};
    rows.forEach(function (row) {
      if (row.ID && row["De Para Status"] && !matchesAny(row["De Para Status"], ["Cancelado"])) {
        map[String(row.ID)] = row["De Para Status"];
      }
    });
    return map;
  }

  function getNextMilestone(milestones, today) {
    var parsed = milestones.map(function (item) {
      return Object.assign({}, item, { parsedDate: parseDate(item.date) });
    }).filter(function (item) { return item.parsedDate; });

    if (!parsed.length) {
      return null;
    }

    var upcoming = parsed.filter(function (item) { return item.parsedDate >= today; })
      .sort(function (a, b) { return a.parsedDate - b.parsedDate; });

    if (upcoming.length) {
      return upcoming[0];
    }

    return parsed.sort(function (a, b) { return b.parsedDate - a.parsedDate; })[0];
  }

  function findCurrentSprint(rows) {
    var maxSprint = null;
    rows.forEach(function (row) {
      var iteration = row["Iteration Path"] || "";
      var match = iteration.match(/Sprint\s*(\d+)/i);
      if (match) {
        var sprint = Number(match[1]);
        if (maxSprint === null || sprint > maxSprint) {
          maxSprint = sprint;
        }
      }
    });
    return maxSprint;
  }

  function resolveWeekHighlights(configs, data) {
    var configItems = asArray(configs.frentesSemana);
    if (configItems.length) {
      return configItems;
    }
    return getSheetRows(data, ["Frentes conduzidas na semana"]);
  }

  function resolveNextSteps(configs, data) {
    var configItems = asArray(configs.proximosPassos);
    if (configItems.length) {
      return configItems;
    }
    return getSheetRows(data, ["Próximos Passos", "Proximos Passos"]);
  }

  function getSheetRows(data, names) {
    var sheets = data && data.workbook && data.workbook.sheets ? data.workbook.sheets : {};
    for (var i = 0; i < names.length; i += 1) {
      if (Array.isArray(sheets[names[i]])) {
        return sheets[names[i]];
      }
    }

    var keys = Object.keys(sheets);
    for (var j = 0; j < keys.length; j += 1) {
      for (var k = 0; k < names.length; k += 1) {
        if (clean(keys[j]) === clean(names[k])) {
          return sheets[keys[j]] || [];
        }
      }
    }
    return [];
  }

  function asArray(value) {
    if (Array.isArray(value)) {
      return value;
    }
    if (value && Array.isArray(value.value)) {
      return value.value;
    }
    if (value === undefined || value === null) {
      return [];
    }
    return [value];
  }

  function normalizeStatus(rawStatus, normalization) {
    var raw = clean(rawStatus);
    if (!raw) {
      return "Backlog";
    }

    var mappings = normalization.mappings || [];
    for (var i = 0; i < mappings.length; i += 1) {
      var matches = mappings[i].match || [];
      for (var j = 0; j < matches.length; j += 1) {
        var target = clean(matches[j]);
        if (raw === target || raw.indexOf(target) >= 0) {
          return mappings[i].normalized;
        }
      }
    }
    return "Backlog";
  }

  function getStatusOrder(normalization) {
    return normalization.statusOrder || ["Em Produção", "Em Homologação", "Em Andamento", "Bloqueado", "Backlog"];
  }

  function getStatusColor(status, normalization) {
    var colors = normalization.statusColors || {};
    return colors[status] || "#d8dde3";
  }

  function getExecutiveStatusPalette(status, normalization) {
    var normalized = normalizeStatus(status, normalization);
    var color = getStatusColor(normalized, normalization);
    if (normalized === "Backlog") {
      return { bg: "#eef1f4", fg: "#586273" };
    }
    if (normalized === "Bloqueado") {
      return { bg: "#fff0df", fg: "#a94c00" };
    }
    if (normalized === "Em Andamento") {
      return { bg: "#eef9ca", fg: "#486305" };
    }
    if (normalized === "Em Homologação") {
      return { bg: "#d9f7ed", fg: "#087064" };
    }
    return { bg: color, fg: "#ffffff" };
  }

  function sectionTitle(title) {
    return '<div class="section-title"><h2>' + esc(title) + '</h2><span aria-hidden="true"></span></div>';
  }

  function matchesAny(value, candidates) {
    var text = clean(value);
    return (candidates || []).some(function (candidate) {
      var candidateText = clean(candidate);
      return candidateText && text.indexOf(candidateText) >= 0;
    });
  }

  function isClosedStatus(status) {
    return matchesAny(status, ["resolvido", "concluido", "cancelado", "closed", "done"]);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }
    var match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return startOfDay(parsed);
  }

  function formatDateBr(value) {
    if (!value) {
      return "A definir";
    }
    var date = parseDate(value);
    if (!date) {
      return String(value);
    }
    return String(date.getDate()).padStart(2, "0") + "/" + String(date.getMonth() + 1).padStart(2, "0") + "/" + date.getFullYear();
  }

  function formatGeneratedAt(value) {
    if (!value) {
      return formatDateBr(new Date().toISOString().slice(0, 10));
    }
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return String(value).slice(0, 10).split("-").reverse().join("/");
    }
    return String(parsed.getDate()).padStart(2, "0") + "/" + String(parsed.getMonth() + 1).padStart(2, "0") + "/" + parsed.getFullYear();
  }

  function clean(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function esc(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escAttr(value) {
    return esc(value).replace(/`/g, "&#096;");
  }

  function clamp(value, min, max) {
    var number = Number(value);
    if (Number.isNaN(number)) {
      return min;
    }
    return Math.max(min, Math.min(max, number));
  }

  function renderError(error) {
    var app = document.getElementById("app");
    app.innerHTML = '<div class="error-state"><h1>Não foi possível carregar o dashboard</h1><p>' + esc(error.message || error) + '</p></div>';
  }

  function icon(name) {
    var icons = {
      "calendar": '<svg viewBox="0 0 24 24"><path d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="M8 13h3M13 13h3M8 17h3M13 17h3"/></svg>',
      "sprint": '<svg viewBox="0 0 24 24"><path d="M4 13a8 8 0 0 1 14-5"/><path d="M18 3v5h-5"/><path d="M20 11a8 8 0 0 1-14 5"/><path d="M6 21v-5h5"/></svg>',
      "shield": '<svg viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-5"/></svg>',
      "validation": '<svg viewBox="0 0 24 24"><path d="M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M9 8h6M9 12h4M9 16h3"/><path d="m15 16 1.5 1.5L20 14"/></svg>',
      "lock": '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg>',
      "warning": '<svg viewBox="0 0 24 24"><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/></svg>',
      "flag": '<svg viewBox="0 0 24 24"><path d="M5 21V4"/><path d="M5 5h12l-2 4 2 4H5"/></svg>',
      "rocket": '<svg viewBox="0 0 24 24"><path d="M13 4c3.5.4 5.6 2.5 6 6l-6 6-5-5 5-7Z"/><path d="m8 11-4 1 3 3-1 4 4-4"/><circle cx="14.5" cy="8.5" r="1.5"/></svg>',
      "cubes": '<svg viewBox="0 0 24 24"><path d="m12 3 7 4-7 4-7-4 7-4Z"/><path d="m5 7 7 4v8l-7-4V7ZM19 7l-7 4v8l7-4V7Z"/></svg>',
      "checklist": '<svg viewBox="0 0 24 24"><path d="M9 5h10M9 12h10M9 19h10"/><path d="m4 5 1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2"/></svg>',
      "people": '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2"/><path d="M15 14a5 5 0 0 1 6 5"/></svg>',
      "chart": '<svg viewBox="0 0 24 24"><path d="M4 20h16"/><path d="M7 17v-5M12 17V7M17 17v-8"/><path d="m6 9 5-4 4 3 4-5"/></svg>',
      "code": '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m9 9-3 3 3 3M15 9l3 3-3 3M13 8l-2 8"/></svg>',
      "printer": '<svg viewBox="0 0 24 24"><path d="M7 8V4h10v4"/><rect x="5" y="12" width="14" height="8" rx="1"/><path d="M5 16H3v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5h-2"/><path d="M8 16h8"/></svg>',
      "user": '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
      "arrow-left": '<svg viewBox="0 0 24 24"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>'
    };
    return icons[name] || icons.flag;
  }
}());
