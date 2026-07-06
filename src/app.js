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
  var ROUTES = {
    home: "/",
    dashboard: "/dashboard",
    updateData: "/atualizar-dados"
  };
  var AUTH_STORAGE_KEY = "ctcDashboardAdminToken";
  var updateDataState = createUpdateDataState();

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      var apiSources = await loadEditableSources();
      var configs = await loadConfigs(apiSources);
      var data = await loadData(apiSources);
      appState = { configs: configs, data: data };
      window.addEventListener("hashchange", renderCurrentRoute);
      window.addEventListener("popstate", renderCurrentRoute);
      renderCurrentRoute();
    } catch (error) {
      renderError(error);
    }
  }

  async function loadEditableSources() {
    try {
      var response = await fetch("/api/data", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("/api/data retornou HTTP " + response.status);
      }
      var payload = await response.json();
      var sources = {};
      (payload.sources || []).forEach(function (source) {
        if (source && source.dashboardKey) {
          sources[source.dashboardKey] = source.value;
        }
      });
      return sources;
    } catch (error) {
      return null;
    }
  }

  function hasApiSource(apiSources, key) {
    return apiSources && Object.prototype.hasOwnProperty.call(apiSources, key);
  }

  async function loadConfigs(apiSources) {
    var globals = window.DASHBOARD_CONFIGS || {};
    var config = {};
    var keys = Object.keys(CONFIG_PATHS);
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      config[key] = hasApiSource(apiSources, key)
        ? normalizeConfigValue(key, apiSources[key])
        : normalizeConfigValue(key, await readJson(CONFIG_PATHS[key], globals[key] || defaultConfig(key)));
    }
    return config;
  }

  function normalizeConfigValue(key, value) {
    if (value && !Array.isArray(value) && Array.isArray(value.value)) {
      return value.value;
    }
    return value;
  }

  async function loadData(apiSources) {
    if (hasApiSource(apiSources, "generatedData")) {
      return apiSources.generatedData;
    }
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

    var path = normalizePath(window.location.pathname);
    var routeEpicId = getRouteEpicId();
    if (routeEpicId) {
      renderEpicDetail(routeEpicId);
      return;
    }

    if (path === ROUTES.dashboard) {
      renderDashboard();
      return;
    }

    if (path === ROUTES.updateData) {
      if (!isUpdateDataAuthenticated()) {
        window.history.replaceState({}, "", ROUTES.home);
        renderHome(true);
        return;
      }
      renderUpdateDataAdmin();
      return;
    }

    if (path !== ROUTES.home) {
      window.history.replaceState({}, "", ROUTES.home);
    }
    renderHome(false);
  }

  function normalizePath(pathname) {
    var normalized = String(pathname || "/").replace(/\/+$/, "");
    return normalized || "/";
  }

  function navigateTo(path, replace) {
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    renderCurrentRoute();
  }

  function isUpdateDataAuthenticated() {
    return Boolean(getAdminToken());
  }

  function createUpdateDataState() {
    return {
      loading: false,
      loaded: false,
      loadAttempted: false,
      saving: false,
      sources: [],
      activeName: null,
      mode: "table",
      draftValue: null,
      jsonText: "",
      message: "",
      messageType: "info",
      storage: null
    };
  }

  function getAdminToken() {
    try {
      return window.sessionStorage.getItem(AUTH_STORAGE_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function setAdminToken(token) {
    try {
      window.sessionStorage.setItem(AUTH_STORAGE_KEY, token);
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearAdminToken() {
    try {
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      return;
    }
  }

  function resetUpdateDataState() {
    updateDataState = createUpdateDataState();
  }

  function renderHome(openLogin) {
    var project = (appState.configs.dashboardConfig && appState.configs.dashboardConfig.project) || {};
    var app = document.getElementById("app");
    document.title = project.screenTitle || "Projeto CTC • O2C Royalties";

    app.innerHTML =
      '<div class="home-shell">' +
        '<header class="home-header">' +
          '<div class="home-brand">' +
            '<img src="assets/logos/ctc.svg?v=20260705-6" alt="CTC">' +
            '<span aria-hidden="true"></span>' +
            '<strong>' + esc(project.title || "Projeto CTC • O2C Royalties") + '</strong>' +
          '</div>' +
          '<button class="home-header-button" type="button">' + icon("chart") + '<span>Dashboard</span></button>' +
        '</header>' +
        '<main class="home-main">' +
          '<section class="home-hero" aria-labelledby="home-title">' +
            '<div class="home-kicker">Dashboard Executivo CTC</div>' +
            '<h1 id="home-title">' + esc(project.title || "Projeto CTC • O2C Royalties") + '</h1>' +
            '<p>Acompanhe o status executivo do projeto ou acesse a área de atualização de dados.</p>' +
          '</section>' +
          '<section class="home-actions-grid" aria-label="Ações principais">' +
            '<article class="home-action-card">' +
              '<div class="home-action-icon">' + icon("chart") + '</div>' +
              '<h2>Acessar Dashboard</h2>' +
              '<p>Visualize o status executivo, épicos, validações, riscos e próximos marcos do projeto.</p>' +
              '<button class="home-primary-button home-dashboard-button" type="button"><span>Entrar no Dashboard</span>' + icon("arrow-right") + '</button>' +
            '</article>' +
            '<article class="home-action-card">' +
              '<div class="home-action-icon home-action-icon-alt">' + icon("lock") + '</div>' +
              '<h2>Atualizar Dados</h2>' +
              '<p>Acesse a área reservada para atualização das bases utilizadas no dashboard.</p>' +
              '<button class="home-secondary-button home-update-button" type="button"><span>Atualizar Dados</span>' + icon("arrow-right") + '</button>' +
            '</article>' +
          '</section>' +
        '</main>' +
        '<footer class="home-footer">CTC • O2C Royalties • Dashboard Executivo</footer>' +
        renderLoginModal(openLogin) +
      '</div>';

    bindHomeEvents(openLogin);
  }

  function renderLoginModal(openLogin) {
    return (
      '<div class="login-modal-backdrop' + (openLogin ? " is-open" : "") + '" aria-hidden="' + (openLogin ? "false" : "true") + '">' +
        '<section class="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">' +
          '<button class="login-close-button" type="button" title="Fechar" aria-label="Fechar">' + icon("x") + '</button>' +
          '<div class="login-modal-icon">' + icon("lock") + '</div>' +
          '<h2 id="login-modal-title">Atualizar Dados</h2>' +
          '<p>Informe suas credenciais para acessar a área de atualização.</p>' +
          '<form class="login-form" novalidate>' +
            '<label for="ctc-login">Login</label>' +
            '<input id="ctc-login" name="login" type="text" autocomplete="username" required>' +
            '<label for="ctc-password">Senha</label>' +
            '<input id="ctc-password" name="password" type="password" autocomplete="current-password" required>' +
            '<p class="login-error" role="alert" hidden>Login ou senha inválidos.</p>' +
            '<button class="login-submit-button" type="submit"><span>Entrar</span>' + icon("arrow-right") + '</button>' +
          '</form>' +
        '</section>' +
      '</div>'
    );
  }

  function bindHomeEvents(openLogin) {
    var dashboardButtons = document.querySelectorAll(".home-dashboard-button, .home-header-button");
    for (var i = 0; i < dashboardButtons.length; i += 1) {
      dashboardButtons[i].addEventListener("click", function () {
        navigateTo(ROUTES.dashboard);
      });
    }

    var updateButton = document.querySelector(".home-update-button");
    if (updateButton) {
      updateButton.addEventListener("click", openLoginModal);
    }

    var closeButton = document.querySelector(".login-close-button");
    if (closeButton) {
      closeButton.addEventListener("click", closeLoginModal);
    }

    var backdrop = document.querySelector(".login-modal-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", function (event) {
        if (event.target === backdrop) {
          closeLoginModal();
        }
      });
    }

    var form = document.querySelector(".login-form");
    if (form) {
      form.addEventListener("submit", handleLoginSubmit);
    }

    if (openLogin) {
      window.setTimeout(function () {
        var loginInput = document.getElementById("ctc-login");
        if (loginInput) {
          loginInput.focus();
        }
      }, 0);
    }
  }

  function openLoginModal() {
    var backdrop = document.querySelector(".login-modal-backdrop");
    var error = document.querySelector(".login-error");
    if (!backdrop) {
      return;
    }
    backdrop.classList.add("is-open");
    backdrop.setAttribute("aria-hidden", "false");
    if (error) {
      error.hidden = true;
    }
    var loginInput = document.getElementById("ctc-login");
    if (loginInput) {
      loginInput.focus();
    }
  }

  function closeLoginModal() {
    var backdrop = document.querySelector(".login-modal-backdrop");
    if (!backdrop) {
      return;
    }
    backdrop.classList.remove("is-open");
    backdrop.setAttribute("aria-hidden", "true");
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var login = form.elements.login ? form.elements.login.value.trim() : "";
    var password = form.elements.password ? form.elements.password.value : "";
    var error = form.querySelector(".login-error");
    var submitButton = form.querySelector(".login-submit-button");

    if (error) {
      error.hidden = true;
    }
    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      var response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login, password: password })
      });
      var payload = await response.json().catch(function () { return {}; });

      if (!response.ok || !payload.token) {
        throw new Error(payload.message || "Login ou senha inválidos.");
      }

      setAdminToken(payload.token);
      resetUpdateDataState();
      navigateTo(ROUTES.updateData);
      return;
    } catch (loginError) {
      if (error) {
        error.textContent = loginError.message || "Login ou senha inválidos.";
        error.hidden = false;
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  }

  function renderUpdateDataPlaceholder() {
    var app = document.getElementById("app");
    document.title = "Atualizar Dados • CTC O2C Royalties";

    app.innerHTML =
      '<div class="update-shell">' +
        '<header class="update-header">' +
          '<div class="home-brand">' +
            '<img src="assets/logos/ctc.svg?v=20260705-6" alt="CTC">' +
            '<span aria-hidden="true"></span>' +
            '<strong>Projeto CTC • O2C Royalties</strong>' +
          '</div>' +
        '</header>' +
        '<main class="update-main">' +
          '<section class="update-panel">' +
            '<div class="update-panel-icon">' + icon("lock") + '</div>' +
            '<h1>Atualizar Dados</h1>' +
            '<p>Área reservada para atualização das bases do dashboard.</p>' +
            '<strong>Funcionalidade em construção.</strong>' +
            '<div class="update-actions">' +
              '<button class="update-home-button" type="button">' + icon("home") + '<span>Voltar para Home</span></button>' +
              '<button class="update-dashboard-button" type="button">' + icon("chart") + '<span>Acessar Dashboard</span></button>' +
            '</div>' +
          '</section>' +
        '</main>' +
      '</div>';

    bindUpdateDataEvents();
  }

  function bindUpdateDataEvents() {
    var homeButton = document.querySelector(".update-home-button");
    var dashboardButton = document.querySelector(".update-dashboard-button");

    if (homeButton) {
      homeButton.addEventListener("click", function () {
        navigateTo(ROUTES.home);
      });
    }

    if (dashboardButton) {
      dashboardButton.addEventListener("click", function () {
        navigateTo(ROUTES.dashboard);
      });
    }
  }

  function renderUpdateDataAdmin() {
    var app = document.getElementById("app");
    document.title = "Atualizar Dados • CTC O2C Royalties";

    app.innerHTML =
      '<div class="update-shell">' +
        '<header class="update-header">' +
          '<div class="home-brand">' +
            '<img src="assets/logos/ctc.svg?v=20260705-6" alt="CTC">' +
            '<span aria-hidden="true"></span>' +
            '<strong>Projeto CTC • O2C Royalties</strong>' +
          '</div>' +
          '<nav class="update-nav" aria-label="Navegação administrativa">' +
            '<button class="update-home-button" type="button">' + icon("home") + '<span>Home</span></button>' +
            '<button class="update-dashboard-button" type="button">' + icon("chart") + '<span>Dashboard</span></button>' +
            '<button class="update-logout-button" type="button">' + icon("log-out") + '<span>Sair</span></button>' +
          '</nav>' +
        '</header>' +
        '<main class="update-main update-admin-main">' +
          '<section class="update-title-block">' +
            '<div class="update-panel-icon">' + icon("database") + '</div>' +
            '<div>' +
              '<h1>Atualizar Dados</h1>' +
              '<p>Gerencie as bases utilizadas no Dashboard Executivo CTC.</p>' +
            '</div>' +
          '</section>' +
          renderUpdateSummary() +
          '<section class="admin-workspace">' +
            renderUpdateTabs() +
            renderDataEditor() +
          '</section>' +
        '</main>' +
      '</div>';

    bindUpdateDataAdminEvents();
    if (!updateDataState.loaded && !updateDataState.loading && !updateDataState.loadAttempted) {
      loadAdminData();
    }
  }

  function renderUpdateSummary() {
    var sources = updateDataState.sources || [];
    var lastUpdate = getLastDataUpdate(sources);
    var storage = updateDataState.storage || {};
    return (
      '<section class="update-summary-grid" aria-label="Resumo da área administrativa">' +
        '<article><span>Bases disponíveis</span><strong>' + esc(sources.length || "-") + '</strong></article>' +
        '<article><span>Última atualização</span><strong>' + esc(lastUpdate ? formatDateTimeBr(lastUpdate) : "Sem registro") + '</strong></article>' +
        '<article><span>Status do armazenamento</span><strong>' + esc(storage.message || "Carregando") + '</strong></article>' +
      '</section>'
    );
  }

  function renderUpdateTabs() {
    if (updateDataState.loading && !updateDataState.sources.length) {
      return '<aside class="admin-tabs"><div class="admin-loading">Carregando bases...</div></aside>';
    }

    var tabs = (updateDataState.sources || []).map(function (source) {
      return (
        '<button class="admin-tab' + (source.name === updateDataState.activeName ? " is-active" : "") + '" type="button" data-source="' + escAttr(source.name) + '">' +
          '<strong>' + esc(source.label) + '</strong>' +
          '<span>' + esc(source.type || "json") + ' • ' + esc(source.recordCount) + ' registros</span>' +
        '</button>'
      );
    }).join("");

    return '<aside class="admin-tabs" aria-label="Bases editáveis">' + (tabs || '<div class="admin-empty">Nenhuma base encontrada.</div>') + '</aside>';
  }

  function renderDataEditor() {
    var active = getActiveSource();
    if (updateDataState.loading && !active) {
      return '<section class="admin-editor">' + renderAdminMessage() + '<div class="admin-loading">Carregando dados...</div></section>';
    }
    if (!active) {
      return '<section class="admin-editor">' + renderAdminMessage() + '<div class="admin-empty">Selecione uma base para editar.</div></section>';
    }

    var canTable = canUseTableEditor(updateDataState.draftValue);
    var mode = canTable ? updateDataState.mode : "json";
    var editor = mode === "table" ? renderTableEditor() : renderJsonEditor();

    return (
      '<section class="admin-editor">' +
        '<div class="admin-editor-header">' +
          '<div>' +
            '<span>' + esc(active.path) + '</span>' +
            '<h2>' + esc(active.label) + '</h2>' +
            '<p>' + esc(active.description || "") + '</p>' +
          '</div>' +
          '<div class="admin-mode-toggle" role="group" aria-label="Modo de edição">' +
            '<button class="admin-mode-button' + (mode === "table" ? " is-active" : "") + '" type="button" data-mode="table" ' + (canTable ? "" : "disabled") + '>Tabela</button>' +
            '<button class="admin-mode-button' + (mode === "json" ? " is-active" : "") + '" type="button" data-mode="json">JSON bruto</button>' +
          '</div>' +
        '</div>' +
        renderAdminMessage() +
        '<div class="admin-toolbar">' +
          '<button class="admin-add-button" type="button" ' + (canTable && mode === "table" ? "" : "disabled") + '>' + icon("plus") + '<span>Adicionar registro</span></button>' +
          '<button class="admin-save-button" type="button" ' + (updateDataState.saving ? "disabled" : "") + '>' + icon("save") + '<span>' + (updateDataState.saving ? "Salvando..." : "Salvar alterações") + '</span></button>' +
          '<button class="admin-reload-button" type="button">' + icon("sprint") + '<span>Recarregar</span></button>' +
          '<button class="admin-discard-button" type="button">' + icon("x") + '<span>Descartar alterações</span></button>' +
        '</div>' +
        editor +
      '</section>'
    );
  }

  function renderTableEditor() {
    var rows = Array.isArray(updateDataState.draftValue) ? updateDataState.draftValue : [];
    var columns = collectTableColumns(rows);
    var header = columns.map(function (column) {
      return '<th>' + esc(column) + '</th>';
    }).join("");
    var body = rows.map(function (row, rowIndex) {
      var cells = columns.map(function (column) {
        var value = row && Object.prototype.hasOwnProperty.call(row, column) ? row[column] : "";
        return (
          '<td><textarea class="admin-table-input" data-row="' + rowIndex + '" data-field="' + escAttr(column) + '">' +
            esc(formatCellValue(value)) +
          '</textarea></td>'
        );
      }).join("");
      return (
        '<tr>' +
          cells +
          '<td class="admin-row-actions">' +
            '<button class="admin-duplicate-row" type="button" data-row="' + rowIndex + '" title="Duplicar">' + icon("copy") + '</button>' +
            '<button class="admin-remove-row" type="button" data-row="' + rowIndex + '" title="Remover">' + icon("trash") + '</button>' +
          '</td>' +
        '</tr>'
      );
    }).join("");

    return (
      '<div class="admin-table-wrap">' +
        '<table class="admin-table"><thead><tr>' + header + '<th>Ações</th></tr></thead><tbody>' +
          (body || '<tr><td colspan="' + (columns.length + 1) + '">Nenhum registro nesta base.</td></tr>') +
        '</tbody></table>' +
      '</div>'
    );
  }

  function renderJsonEditor() {
    return (
      '<div class="admin-json-editor">' +
        '<textarea class="admin-json-input" spellcheck="false">' + esc(updateDataState.jsonText || "") + '</textarea>' +
      '</div>'
    );
  }

  function bindUpdateDataAdminEvents() {
    var homeButton = document.querySelector(".update-home-button");
    var dashboardButton = document.querySelector(".update-dashboard-button");
    var logoutButton = document.querySelector(".update-logout-button");
    var tabs = document.querySelectorAll(".admin-tab");
    var modeButtons = document.querySelectorAll(".admin-mode-button");
    var tableInputs = document.querySelectorAll(".admin-table-input");
    var jsonInput = document.querySelector(".admin-json-input");
    var addButton = document.querySelector(".admin-add-button");
    var saveButton = document.querySelector(".admin-save-button");
    var reloadButton = document.querySelector(".admin-reload-button");
    var discardButton = document.querySelector(".admin-discard-button");
    var duplicateButtons = document.querySelectorAll(".admin-duplicate-row");
    var removeButtons = document.querySelectorAll(".admin-remove-row");

    if (homeButton) {
      homeButton.addEventListener("click", function () { navigateTo(ROUTES.home); });
    }
    if (dashboardButton) {
      dashboardButton.addEventListener("click", function () { navigateTo(ROUTES.dashboard); });
    }
    if (logoutButton) {
      logoutButton.addEventListener("click", function () {
        clearAdminToken();
        resetUpdateDataState();
        navigateTo(ROUTES.home);
      });
    }

    for (var i = 0; i < tabs.length; i += 1) {
      tabs[i].addEventListener("click", function (event) {
        activateDataSource(event.currentTarget.getAttribute("data-source"));
      });
    }
    for (var j = 0; j < modeButtons.length; j += 1) {
      modeButtons[j].addEventListener("click", function (event) {
        setEditorMode(event.currentTarget.getAttribute("data-mode"));
      });
    }
    for (var k = 0; k < tableInputs.length; k += 1) {
      tableInputs[k].addEventListener("input", handleTableInput);
    }
    if (jsonInput) {
      jsonInput.addEventListener("input", function (event) {
        updateDataState.jsonText = event.currentTarget.value;
      });
    }
    if (addButton) {
      addButton.addEventListener("click", addTableRow);
    }
    if (saveButton) {
      saveButton.addEventListener("click", saveActiveDataSource);
    }
    if (reloadButton) {
      reloadButton.addEventListener("click", reloadAdminData);
    }
    if (discardButton) {
      discardButton.addEventListener("click", discardActiveChanges);
    }
    for (var m = 0; m < duplicateButtons.length; m += 1) {
      duplicateButtons[m].addEventListener("click", function (event) {
        duplicateTableRow(Number(event.currentTarget.getAttribute("data-row")));
      });
    }
    for (var n = 0; n < removeButtons.length; n += 1) {
      removeButtons[n].addEventListener("click", function (event) {
        removeTableRow(Number(event.currentTarget.getAttribute("data-row")));
      });
    }
  }

  async function loadAdminData() {
    updateDataState.loading = true;
    updateDataState.loadAttempted = true;
    var navigatedAway = false;
    renderUpdateDataAdmin();

    try {
      var sessionValid = await verifyAdminSession();
      if (!sessionValid) {
        clearAdminToken();
        resetUpdateDataState();
        navigatedAway = true;
        navigateTo(ROUTES.home);
        return;
      }

      var response = await fetch("/api/data", { cache: "no-store" });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao carregar dados.");
      }
      updateDataState.sources = payload.sources || [];
      updateDataState.storage = payload.storage || null;
      updateDataState.loaded = true;
      updateDataState.activeName = updateDataState.activeName || (updateDataState.sources[0] && updateDataState.sources[0].name);
      prepareDraftFromActive();
      setAdminMessage("Bases carregadas com sucesso.", "success");
    } catch (error) {
      updateDataState.loaded = false;
      setAdminMessage(error.message || "Falha ao carregar dados.", "error");
    } finally {
      updateDataState.loading = false;
      if (!navigatedAway) {
        renderUpdateDataAdmin();
      }
    }
  }

  async function verifyAdminSession() {
    try {
      var response = await fetch("/api/auth/session", {
        cache: "no-store",
        headers: { "Authorization": "Bearer " + getAdminToken() }
      });
      return response.ok;
    } catch (error) {
      setAdminMessage("Não foi possível validar sua sessão administrativa.", "error");
      return false;
    }
  }

  function activateDataSource(name) {
    if (!name || name === updateDataState.activeName) {
      return;
    }
    updateDataState.activeName = name;
    prepareDraftFromActive();
    setAdminMessage("", "info");
    renderUpdateDataAdmin();
  }

  function prepareDraftFromActive() {
    var active = getActiveSource();
    updateDataState.draftValue = active ? clone(active.value) : null;
    updateDataState.jsonText = active ? JSON.stringify(active.value, null, 2) : "";
    updateDataState.mode = canUseTableEditor(updateDataState.draftValue) ? "table" : "json";
  }

  function getActiveSource() {
    return (updateDataState.sources || []).find(function (source) {
      return source.name === updateDataState.activeName;
    }) || null;
  }

  function canUseTableEditor(value) {
    return Array.isArray(value) && value.every(function (item) {
      return item && typeof item === "object" && !Array.isArray(item);
    });
  }

  function collectTableColumns(rows) {
    var columns = [];
    rows.forEach(function (row) {
      Object.keys(row || {}).forEach(function (key) {
        if (columns.indexOf(key) === -1) {
          columns.push(key);
        }
      });
    });
    return columns.length ? columns : ["title", "description"];
  }

  function formatCellValue(value) {
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  function coerceCellValue(raw, original) {
    if (original === null) {
      return raw === "" ? null : raw;
    }
    if (typeof original === "number") {
      var number = Number(raw);
      return Number.isNaN(number) ? raw : number;
    }
    if (typeof original === "boolean") {
      return clean(raw) === "true" || clean(raw) === "sim";
    }
    if (typeof original === "object" && original !== null) {
      try {
        return JSON.parse(raw);
      } catch (error) {
        return raw;
      }
    }
    return raw;
  }

  function handleTableInput(event) {
    var rowIndex = Number(event.currentTarget.getAttribute("data-row"));
    var field = event.currentTarget.getAttribute("data-field");
    var active = getActiveSource();
    var originalRows = active && Array.isArray(active.value) ? active.value : [];
    var original = originalRows[rowIndex] ? originalRows[rowIndex][field] : "";
    if (!updateDataState.draftValue[rowIndex]) {
      updateDataState.draftValue[rowIndex] = {};
    }
    updateDataState.draftValue[rowIndex][field] = coerceCellValue(event.currentTarget.value, original);
  }

  function setEditorMode(mode) {
    if (mode === updateDataState.mode) {
      return;
    }
    if (mode === "table") {
      try {
        updateDataState.draftValue = JSON.parse(updateDataState.jsonText || "null");
      } catch (error) {
        setAdminMessage("JSON inválido. Corrija antes de voltar para tabela.", "error");
        renderUpdateDataAdmin();
        return;
      }
      if (!canUseTableEditor(updateDataState.draftValue)) {
        setAdminMessage("Esta base não pode ser exibida como tabela.", "error");
        renderUpdateDataAdmin();
        return;
      }
    } else {
      updateDataState.jsonText = JSON.stringify(updateDataState.draftValue, null, 2);
    }
    updateDataState.mode = mode;
    setAdminMessage("", "info");
    renderUpdateDataAdmin();
  }

  function addTableRow() {
    if (!Array.isArray(updateDataState.draftValue)) {
      return;
    }
    var columns = collectTableColumns(updateDataState.draftValue);
    var row = {};
    columns.forEach(function (column) {
      row[column] = "";
    });
    updateDataState.draftValue.push(row);
    renderUpdateDataAdmin();
  }

  function duplicateTableRow(rowIndex) {
    if (!Array.isArray(updateDataState.draftValue) || !updateDataState.draftValue[rowIndex]) {
      return;
    }
    updateDataState.draftValue.splice(rowIndex + 1, 0, clone(updateDataState.draftValue[rowIndex]));
    renderUpdateDataAdmin();
  }

  function removeTableRow(rowIndex) {
    if (!Array.isArray(updateDataState.draftValue)) {
      return;
    }
    updateDataState.draftValue.splice(rowIndex, 1);
    renderUpdateDataAdmin();
  }

  async function saveActiveDataSource() {
    var active = getActiveSource();
    if (!active) {
      return;
    }

    var payload;
    try {
      payload = getPayloadForSave();
    } catch (error) {
      setAdminMessage(error.message || "JSON inválido.", "error");
      renderUpdateDataAdmin();
      return;
    }

    updateDataState.saving = true;
    setAdminMessage("Salvando alterações...", "info");
    var navigatedAway = false;
    renderUpdateDataAdmin();

    try {
      var response = await fetch("/api/data/" + encodeURIComponent(active.name), {
        method: "PUT",
        headers: {
          "Authorization": "Bearer " + getAdminToken(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ value: payload })
      });
      var result = await response.json().catch(function () { return {}; });
      if (response.status === 401) {
        clearAdminToken();
        resetUpdateDataState();
        navigatedAway = true;
        navigateTo(ROUTES.home);
        return;
      }
      if (!response.ok) {
        throw new Error(result.message || "Falha ao salvar alterações.");
      }

      replaceSource(result);
      prepareDraftFromActive();
      await reloadApplicationData();
      setAdminMessage("Dados salvos com sucesso.", "success");
    } catch (error) {
      setAdminMessage(error.message || "Falha ao salvar alterações.", "error");
    } finally {
      updateDataState.saving = false;
      if (!navigatedAway) {
        renderUpdateDataAdmin();
      }
    }
  }

  function getPayloadForSave() {
    if (updateDataState.mode === "json") {
      try {
        return JSON.parse(updateDataState.jsonText || "null");
      } catch (error) {
        throw new Error("JSON inválido. Corrija o conteúdo antes de salvar.");
      }
    }
    return clone(updateDataState.draftValue);
  }

  async function reloadAdminData() {
    updateDataState.loaded = false;
    updateDataState.loadAttempted = false;
    updateDataState.message = "";
    await loadAdminData();
  }

  function discardActiveChanges() {
    prepareDraftFromActive();
    setAdminMessage("Alterações descartadas.", "info");
    renderUpdateDataAdmin();
  }

  function replaceSource(source) {
    for (var i = 0; i < updateDataState.sources.length; i += 1) {
      if (updateDataState.sources[i].name === source.name) {
        updateDataState.sources[i] = source;
        return;
      }
    }
    updateDataState.sources.push(source);
  }

  async function reloadApplicationData() {
    var apiSources = await loadEditableSources();
    appState.configs = await loadConfigs(apiSources);
    appState.data = await loadData(apiSources);
  }

  function setAdminMessage(message, type) {
    updateDataState.message = message || "";
    updateDataState.messageType = type || "info";
  }

  function renderAdminMessage() {
    if (!updateDataState.message) {
      return "";
    }
    return '<p class="admin-message admin-message-' + escAttr(updateDataState.messageType) + '">' + esc(updateDataState.message) + '</p>';
  }

  function getLastDataUpdate(sources) {
    var dates = (sources || []).map(function (source) {
      return source.updatedAt;
    }).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
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
    var project = (configs.dashboardConfig && configs.dashboardConfig.project) || {};
    document.title = project.screenTitle || "Dashboard Executivo CTC • O2C Royalties";

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
          '<img class="brand-logo" src="assets/logos/ctc.svg?v=20260705-6" alt="CTC">' +
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
      navigateTo(ROUTES.dashboard, true);
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
      window.history.pushState({}, "", ROUTES.dashboard);
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

  function formatDateTimeBr(value) {
    if (!value) {
      return "Sem registro";
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return String(date.getDate()).padStart(2, "0") + "/" +
      String(date.getMonth() + 1).padStart(2, "0") + "/" +
      date.getFullYear() + " " +
      String(date.getHours()).padStart(2, "0") + ":" +
      String(date.getMinutes()).padStart(2, "0");
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
      "arrow-left": '<svg viewBox="0 0 24 24"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
      "arrow-right": '<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
      "home": '<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
      "database": '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
      "plus": '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
      "save": '<svg viewBox="0 0 24 24"><path d="M5 3h13l1 1v17H5V3Z"/><path d="M8 3v6h8V3"/><path d="M8 21v-7h8v7"/></svg>',
      "copy": '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>',
      "trash": '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/></svg>',
      "log-out": '<svg viewBox="0 0 24 24"><path d="M10 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2"/><path d="M15 17l5-5-5-5"/><path d="M20 12H9"/></svg>',
      "x": '<svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
    };
    return icons[name] || icons.flag;
  }
}());
