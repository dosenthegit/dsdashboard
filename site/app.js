(() => {
    "use strict";

    const REFRESH_INTERVAL_MS = 30000;

    const ICONS = [
  "🖥️", "💻", "🖨️", "🖱️", "⌨️", "💾", "💿", "📀", "🧮", "🔌",
  "🔋", "🪫", "⚡", "🧰", "🔧", "🪛", "⚙️", "🛠️", "🧲", "🌡️",
  "🌀", "📟", "🧱", "📦", "🗃️", "🏗️", "🧩", "🔄", "🔀", "☁️",
  "🏢", "🚀", "🐳", "🐙", "☸️", "⚓", "🚢", "🧊", "🗂️", "🔁",
  "🐧", "🌐", "🛜", "📡", "📶", "🔗", "🛰️", "🗼", "🌍", "🌎",
  "🌏", "🕸️", "↔️", "↕️", "📲", "🛡️", "💽", "🗄️", "📁", "📂",
  "🪣", "🏦", "🗜️", "⏪", "⏮️", "🛟", "🔐", "🕒", "📅", "✅",
  "📤", "📥", "📊", "📈", "📉", "📋", "📑", "📜", "🔍", "🔎",
  "👁️", "🩺", "❤️", "💚", "💛", "🚨", "🔔", "🔕", "⚠️", "🚦",
  "⏱️", "🔒", "🔓", "🔑", "🗝️", "🚫", "⛔", "🕵️", "👮", "🪪",
  "❌", "🔏", "🪟", "🍎", "🤖", "🐚", "🌤️", "⛅", "🌩️", "⏰",
  "🧪", "🧬", "🐍", "📚", "📖", "📹", "🎥", "📷", "📸", "📺",
  "🎞️", "🎬", "🔴", "💡", "🎵", "🎶", "🎧", "🔊", "🔉", "🔇",
  "▶️", "⏯️", "⏸️", "⏹️", "🍿", "🟢", "🟡", "🟠", "🔵", "🟣",
  "⚪", "⚫", "🟤", "☑️", "✔️", "❎", "❗", "❓", "ℹ️", "🆗",
  "🆘"
];

    const SECTION_ICONS = ["▦", "⭐", ...ICONS];
    // Curated Dashboard Icons. Other icons can be used by entering their slug.
    // https://github.com/homarr-labs/dashboard-icons
    const DASHBOARD_ICON_NAMES = [
        "proxmox", "proxmox-light", "proxmox-backup-server", "docker", "portainer", "kubernetes", "helm", "podman",
        "synology", "truenas", "truenas-scale", "unraid", "openmediavault", "minio", "nextcloud", "filebrowser",
        "vmware", "esxi", "nutanix", "hyper-v", "virtualbox", "ubuntu", "debian", "alpine-linux", "linux", "windows", "linux-mint",
        "cisco", "unifi", "ubiquiti", "pfsense", "opnsense", "mikrotik", "openwrt", "tailscale", "wireguard", "nginx-proxy-manager",
        "traefik", "caddy", "nginx", "cloudflare", "adguard-home", "pihole", "technitium", "speedtest-tracker", "uptime-kuma",
        "checkmk", "zabbix", "grafana", "prometheus", "graylog", "loki", "influxdb", "netdata", "glances",
        "veeam", "duplicati", "restic", "borgbackup", "urbackup", "duplicacy",
        "jellyfin", "plex", "emby", "sonarr", "radarr", "prowlarr", "bazarr", "jellyseerr", "overseerr", "navidrome", "immich", "photoprism",
        "home-assistant", "homebridge", "node-red", "mosquitto", "zigbee2mqtt", "frigate", "scrypted",
        "vaultwarden", "bitwarden", "authentik", "authelia", "keycloak", "crowdsec", "wazuh",
        "github", "gitlab", "gitea", "forgejo", "jenkins", "ansible", "terraform", "n8n", "code-server", "vscode",
        "postgresql", "mysql", "mariadb", "mongodb", "redis", "elasticsearch", "opensearch", "adminer", "phpmyadmin",
        "homepage", "homarr", "dashy", "heimdall", "dockge", "dozzle", "watchtower", "portainer", "bookstack", "wikijs"
    ];
    // The built-in list is a fallback until the full upstream catalog loads.
    const DASHBOARD_ICONS = [...new Set(DASHBOARD_ICON_NAMES)].map(name => `di:${name}`);
    const DASHBOARD_ICON_INDEX_URL = "/api/icon-catalog";
    let dashboardIconCatalog = DASHBOARD_ICONS;
    let dashboardIconFormats = new Map();
    let dashboardIconCatalogPromise = null;

    function loadDashboardIconCatalog() {
        if (dashboardIconCatalogPromise) return dashboardIconCatalogPromise;
        dashboardIconCatalogPromise = fetch(DASHBOARD_ICON_INDEX_URL, { cache: "default" })
            .then(response => {
                if (!response.ok) throw new Error(`Icon catalog HTTP ${response.status}`);
                return response.json();
            })
            .then(catalog => {
                if (!catalog || !Array.isArray(catalog.icons) || catalog.icons.length < 100) {
                    throw new Error("Full icon index is not yet available");
                }
                dashboardIconFormats = new Map(Object.entries(catalog.formats || {}));
                dashboardIconCatalog = catalog.icons.map(slug => `di:${slug}`);
                return dashboardIconCatalog;
            })
            .catch(error => {
                console.warn("Unable to load full Dashboard Icons catalog; using built-in icons:", error);
                dashboardIconCatalog = DASHBOARD_ICONS;
                return dashboardIconCatalog;
            });
        return dashboardIconCatalogPromise;
    }
    const ALL_ICONS = [...new Set([...ICONS, ...DASHBOARD_ICONS])];
    const ALL_SECTION_ICONS = [...new Set([...SECTION_ICONS, ...DASHBOARD_ICONS])];
    const DASHBOARD_ICON_CDN = "/icons/";
    const DASHBOARD_ICON_PATTERN = /^di:([a-z0-9]+(?:-[a-z0-9]+)*)$/;

    function iconIsDashboard(value) {
        return DASHBOARD_ICON_PATTERN.test(String(value || ""));
    }

    function iconLabel(value) {
        return iconIsDashboard(value) ? `Dashboard Icons: ${value.slice(3)}` : value;
    }

    function iconUrl(value) {
        const match = String(value || "").match(DASHBOARD_ICON_PATTERN);
        return match ? `${DASHBOARD_ICON_CDN}${match[1]}.${dashboardIconFormats.get(match[1]) || "svg"}` : null;
    }

    function createIconNode(value, fallback = "🌐") {
        const url = iconUrl(value);
        if (!url) {
            const span = document.createElement("span");
            span.textContent = value || fallback;
            return span;
        }
        const img = document.createElement("img");
        img.className = "dashboard-icon-img";
        img.src = url;
        img.alt = value.slice(3).replace(/-/g, " ");
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.onerror = () => {
            // Some upstream icons have only a PNG or WebP version.
            const current = img.getAttribute("src") || "";
            const slug = value.slice(3);
            if (current.endsWith(".svg")) {
                img.src = `${DASHBOARD_ICON_CDN}${slug}.png`;
                return;
            }
            if (current.endsWith(".png")) {
                img.src = `${DASHBOARD_ICON_CDN}${slug}.webp`;
                return;
            }
            const replacement = document.createElement("span");
            replacement.textContent = fallback;
            replacement.title = `Icon unavailable: ${value}`;
            img.replaceWith(replacement);
        };
        return img;
    }

    function setIcon(element, value, fallback = "🌐") {
        element.replaceChildren(createIconNode(value, fallback));
    }

    function iconOptions(values, selected) {
        return [...new Set([...values, ...(selected && !values.includes(selected) ? [selected] : [])])]
            .map(value => ({ value, label: iconLabel(value) }));
    }

    function iconSelectOptions(values, selected) {
        return iconOptions(values, selected)
            .map(option => `<option value="${escapeAttr(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
            .join("");
    }

    function mountIconPicker(select, onSelect, options = {}) {
        const container = document.createElement("div");
        container.className = "icon-browser";
        const tabs = document.createElement("div");
        tabs.className = "icon-browser-tabs";
        const emojis = createButton("Emojis", "button button-secondary", () => changeTab("emoji"));
        const dashboard = createButton("Dashboard Icons", "button button-secondary", () => changeTab("dashboard"));
        tabs.append(emojis, dashboard);
        const search = document.createElement("input");
        search.type = "search";
        search.className = "form-control icon-browser-search";
        search.placeholder = "Search icons (e.g. proxmox, docker)...";
        search.setAttribute("aria-label", "Search icons");
        const grid = document.createElement("div");
        grid.className = "icon-picker-grid icon-browser-grid";
        const customRow = document.createElement("div");
        customRow.className = "icon-custom-row";
        const custom = document.createElement("input");
        custom.className = "form-control";
        custom.placeholder = "Other Dashboard Icons slug, e.g. proxmox";
        custom.setAttribute("aria-label", "Dashboard Icons slug");
        const customButton = createButton("Use icon", "button button-secondary", () => {
            const slug = custom.value.toLowerCase().trim().replace(/^di:/, "");
            const value = `di:${slug}`;
            if (!iconIsDashboard(value)) {
                custom.setCustomValidity("Only lowercase letters, digits and hyphens are allowed.");
                custom.reportValidity();
                return;
            }
            custom.setCustomValidity("");
            choose(value);
        });
        customRow.append(custom, customButton);
        container.append(tabs, search, grid, customRow);
        let tab = iconIsDashboard(select.value) ? "dashboard" : "emoji";
        let catalogLoading = false;
        if (tab === "dashboard") refreshCatalog();
        function refreshCatalog() {
            catalogLoading = true;
            updateGrid();
            loadDashboardIconCatalog().then(() => {
                if (!container.isConnected) return;
                catalogLoading = false;
                updateGrid();
            });
        }
        function choose(value) {
            if (![...select.options].some(option => option.value === value)) {
                select.add(new Option(iconLabel(value), value));
            }
            select.value = value;
            onSelect();
            updateGrid();
        }
        function changeTab(next) {
            tab = next;
            search.value = "";
            updateGrid();
            if (tab === "dashboard" && !dashboardIconCatalogPromise) refreshCatalog();
        }
        function updateGrid() {
            emojis.classList.toggle("button-primary", tab === "emoji");
            dashboard.classList.toggle("button-primary", tab === "dashboard");
            customRow.classList.toggle("hidden", tab !== "dashboard");
            search.placeholder = tab === "dashboard" ? "Search products (e.g. jellyfin)..." : "Search emojis";
            const query = search.value.toLowerCase().trim();
            const source = tab === "dashboard" ? dashboardIconCatalog : ICONS;
            const choices = source.filter(icon => iconLabel(icon).toLowerCase().includes(query)).slice(0, 120);
            grid.replaceChildren();
            if (tab === "dashboard" && catalogLoading) {
                const info = document.createElement("p");
                info.textContent = "Loading the full Dashboard Icons catalog...";
                grid.appendChild(info);
            }
            choices.forEach(value => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = `icon-choice ${select.value === value ? "active" : ""}`;
                button.title = iconLabel(value);
                button.setAttribute("aria-label", `Select ${iconLabel(value)}`);
                button.appendChild(createIconNode(value, "❔"));
                button.addEventListener("click", () => choose(value));
                grid.appendChild(button);
            });
            if (!choices.length) {
                const empty = document.createElement("p");
                empty.textContent = tab === "dashboard" ? "No matches in the available catalog. You can enter a slug below." : "No matching emojis.";
                grid.appendChild(empty);
            }
        }
        search.addEventListener("input", updateGrid);
        select.addEventListener("change", () => {
            tab = iconIsDashboard(select.value) ? "dashboard" : "emoji";
            updateGrid();
        });
        updateGrid();
        return container;
    }

    const SECTION_COLORS = ["blue", "green", "purple", "pink", "orange", "red", "slate", "cyan"];
    const COLOR_VALUES = {
        blue: "#3b82f6",
        green: "#22c55e",
        purple: "#8b5cf6",
        pink: "#ec4899",
        orange: "#f97316",
        red: "#ef4444",
        slate: "#94a3b8",
        cyan: "#06b6d4"
    };

    const state = {
        config: { sections: [] },
        status: {},
        history: {},
        privateView: false,
        locked: false,
        search: "",
        filter: "all",
        layout: localStorage.getItem("dashboard-layout") || "normal",
        hideStatus: localStorage.getItem("dashboard-hide-status") === "true",
        favorites: new Set(readStoredArray("dashboard-favorites")),
        editMode: false,
        authenticated: false,
        csrfToken: null,
        security: null,
        backups: [],
        notifications: [],
        drag: null,
        selectedSectionIndex: 0,
        theme: localStorage.getItem("dashboard-theme") || "dark",
        collapsedSections: new Set(readStoredArray("dashboard-collapsed-sections"))
    };

    const elements = {};

    function readStoredArray(key) {
        try { const v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; }
        catch (_) { return []; }
    }

    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        bindElements();
        bindGlobalEvents();
        applyTheme();
        applyViewPreferences();
        try {
            await refreshSession();
            if (state.privateView && !state.authenticated) {
                state.locked = true;
                render();
            } else {
                await Promise.all([loadConfig(), loadStatus(), loadHistory()]);
                if (state.authenticated) await Promise.all([loadSecurity(), loadBackups()]);
                render();
            }
        } catch (error) {
            if (error.status === 401) {
                state.locked = true;
                state.config = { sections: [] };
                state.status = {};
                state.history = {};
                render();
            } else showFatalError(error);
        }
        window.setInterval(async () => {
            if (state.locked) return;
            try {
                await Promise.all([loadStatus(), loadHistory()]);
                renderDashboardOnly();
            } catch (error) {
                if (error.status === 401) {
                    state.authenticated = false;
                    state.locked = true;
                    state.editMode = false;
                    state.config = { sections: [] };
                    state.status = {};
                    state.history = {};
                    render();
                } else notify("warning", "Status update failed", error.message);
            }
        }, REFRESH_INTERVAL_MS);
    }

    function applyViewPreferences() {
        if (!["normal", "compact", "large"].includes(state.layout)) state.layout = "normal";
        document.body.classList.toggle("layout-compact", state.layout === "compact");
        document.body.classList.toggle("layout-large", state.layout === "large");
        document.body.classList.toggle("hide-service-status", state.hideStatus);
        elements.layoutMode.value = state.layout;
        elements.hideStatus.checked = state.hideStatus;
    }

    function bindElements() {
        elements.body = document.body;
        elements.dashboard = document.getElementById("dashboard");
        elements.appLayout = document.getElementById("appLayout");
        elements.editSidebar = document.getElementById("editSidebar");
        elements.editPanels = document.getElementById("editPanels");
        elements.editorToolbar = document.getElementById("editorToolbar");
        elements.editModeNotice = document.getElementById("editModeNotice");
        elements.editModeButton = document.getElementById("editModeButton");
        elements.toolbarExitButton = document.getElementById("toolbarExitButton");
        elements.servicesCount = document.getElementById("servicesCount");
        elements.onlineCount = document.getElementById("onlineCount");
        elements.offlineCount = document.getElementById("offlineCount");
        elements.uptimePercent = document.getElementById("uptimePercent");
        elements.updatedAt = document.getElementById("updatedAt");
        elements.modalOverlay = document.getElementById("modalOverlay");
        elements.modal = document.getElementById("modal");
        elements.toastContainer = document.getElementById("toastContainer");
        elements.importFileInput = document.getElementById("importFileInput");
        elements.restoreFileInput = document.getElementById("restoreFileInput");
        elements.search = document.getElementById("serviceSearch");
        elements.statusFilter = document.getElementById("statusFilter");
        elements.favoritesFilter = document.getElementById("favoritesFilter");
        elements.layoutMode = document.getElementById("layoutMode");
        elements.hideStatus = document.getElementById("hideServiceStatus");
        elements.summaryNote = document.getElementById("summaryNote");
        elements.statsGrid = document.getElementById("statsGrid");
        elements.controls = document.getElementById("dashboardControls");
    }

    function bindGlobalEvents() {
        elements.editModeButton.addEventListener("click", handleEditModeButton);
        elements.toolbarExitButton.addEventListener("click", exitEditMode);
        elements.search.addEventListener("input", () => { state.search = elements.search.value.trim().toLowerCase(); renderDashboard(); });
        elements.statusFilter.addEventListener("change", () => { state.filter = elements.statusFilter.value; renderDashboard(); });
        elements.favoritesFilter.addEventListener("click", () => {
            state.filter = state.filter === "favorites" ? "all" : "favorites";
            elements.statusFilter.value = state.filter;
            renderDashboard();
        });
        elements.layoutMode.addEventListener("change", () => {
            state.layout = elements.layoutMode.value;
            localStorage.setItem("dashboard-layout", state.layout);
            applyViewPreferences();
        });
        elements.hideStatus.addEventListener("change", () => {
            state.hideStatus = elements.hideStatus.checked;
            localStorage.setItem("dashboard-hide-status", String(state.hideStatus));
            applyViewPreferences();
        });

        elements.modalOverlay.addEventListener("click", (event) => {
            if (event.target === elements.modalOverlay) {
                closeModal();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !elements.modalOverlay.classList.contains("hidden")) { closeModal(); return; }
            const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable;
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault(); elements.search.focus(); elements.search.select();
            } else if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey) {
                event.preventDefault(); elements.search.focus();
            } else if (event.key === "Escape" && document.activeElement === elements.search) {
                elements.search.value = ""; state.search = ""; renderDashboard(); elements.search.blur();
            }
        });

        elements.importFileInput.addEventListener("change", async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
                await importConfigFile(file, "Configuration imported");
            }
        });

        // Clear internal drag state even if a dragged host/section is released outside a drop target.
        document.addEventListener("dragend", () => {
            state.drag = null;
            clearDropHighlights();
        });

        elements.restoreFileInput.addEventListener("change", async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
                openConfirmModal({
                    title: "Restore Configuration",
                    message: "This will replace the current configuration. A backup will be created first.",
                    confirmText: "Restore",
                    danger: true,
                    onConfirm: async () => importConfigFile(file, "Configuration restored from file")
                });
            }
        });
    }

    async function apiFetch(path, options = {}) {
        const method = (options.method || "GET").toUpperCase();
        const headers = new Headers(options.headers || {});
        headers.set("Accept", "application/json");
        headers.set("X-Requested-With", "dashboard-admin");

        const fetchOptions = {
            method,
            headers,
            credentials: "same-origin"
        };

        if (options.body !== undefined) {
            headers.set("Content-Type", "application/json");
            fetchOptions.body = JSON.stringify(options.body);
        }

        if (!["GET", "HEAD", "OPTIONS"].includes(method) && state.csrfToken) {
            headers.set("X-CSRF-Token", state.csrfToken);
        }

        const response = await fetch(path, fetchOptions);
        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await response.json() : await response.text();

        if (!response.ok) {
            const message = typeof payload === "object" && payload && payload.error ? payload.error : `Request failed: ${response.status}`;
            const error = new Error(message);
            error.status = response.status;
            throw error;
        }

        return payload;
    }

    async function refreshSession() {
        const session = await apiFetch("/api/session");
        state.authenticated = Boolean(session.authenticated);
        state.csrfToken = session.csrfToken || null;
        state.privateView = Boolean(session.privateView);
        return session;
    }

    async function loadConfig() {
        const result = await apiFetch("/api/config");
        state.config = normalizeConfig(result.config || result);
    }

    async function loadStatus() {
        const result = await apiFetch("/api/status");
        state.status = result.status || result || {};
    }

    async function loadHistory() {
        const result = await apiFetch("/api/history");
        state.history = result.history || {};
    }

    async function loadSecurity() {
        if (!state.authenticated) return;
        state.security = await apiFetch("/api/security");
    }

    async function loadBackups() {
        if (!state.authenticated) return;
        const result = await apiFetch("/api/backups");
        state.backups = result.backups || [];
        state.backupRetention = result.retentionLimit || 100;
    }

    function normalizeConfig(config) {
        const safe = config && typeof config === "object" ? config : { sections: [] };
        safe.sections = Array.isArray(safe.sections) ? safe.sections : [];
        safe.sections.forEach((section, sectionIndex) => {
            section.id = section.id || generateUniqueSectionId(section.title || `section-${sectionIndex + 1}`);
            section.title = section.title || "Untitled Section";
            section.icon = section.icon || "▦";
            section.color = SECTION_COLORS.includes(section.color) ? section.color : "blue";
            section.items = Array.isArray(section.items) ? section.items : [];
            section.items.forEach((item) => {
                item.id = item.id || generateUniqueHostId(item.name || "host");
                item.name = item.name || "Unnamed Host";
                item.description = item.description || "";
                item.url = item.url || "";
                item.icon = item.icon || "🌍";
                item.invertStatus = Boolean(item.invertStatus);
                item.maintenance = Boolean(item.maintenance);
                item.checkType = ["auto", "http", "tcp", "icmp"].includes(item.checkType) ? item.checkType : "auto";
                item.checkPort = Number(item.checkPort || 0);
                item.checkPath = item.checkPath || "";
                item.expectedStatus = Number(item.expectedStatus || 0);
                item.warnResponseMs = Number(item.warnResponseMs || 0);
                item.tlsWarnDays = Number(item.tlsWarnDays ?? 30);
            });
        });
        return safe;
    }

    function render() {
        elements.body.classList.toggle("edit-mode", state.editMode);
        elements.statsGrid.classList.toggle("hidden", state.locked);
        elements.controls.classList.toggle("hidden", state.locked);
        elements.summaryNote.classList.toggle("hidden", state.locked);
        if (state.locked) {
            elements.modalOverlay.classList.add("hidden");
            elements.modal.replaceChildren();
            elements.editorToolbar.classList.add("hidden");
            elements.editModeNotice.classList.add("hidden");
            elements.editSidebar.classList.add("hidden");
            elements.editPanels.classList.add("hidden");
            elements.editModeButton.textContent = "🔒 Sign in";
            elements.dashboard.replaceChildren();
            const box = document.createElement("div");
            box.className = "empty-state private-view-locked";
            box.textContent = "This dashboard is private. Sign in to view services and status.";
            box.appendChild(document.createElement("br"));
            box.appendChild(createButton("🔓 Sign in", "button button-primary", () => openLoginModal(false)));
            elements.dashboard.append(box);
            elements.updatedAt.textContent = "Private dashboard";
            return;
        }
        elements.editorToolbar.classList.toggle("hidden", !state.editMode);
        elements.editModeNotice.classList.toggle("hidden", !state.editMode);
        elements.editSidebar.classList.toggle("hidden", !state.editMode);
        elements.editPanels.classList.toggle("hidden", !state.editMode);

        elements.editModeButton.innerHTML = state.editMode
            ? "<span aria-hidden=\"true\">🔓</span><span>Edit Mode Active</span>"
            : "<span aria-hidden=\"true\">🔒</span><span>Edit Mode</span>";
        elements.editModeButton.classList.toggle("button-primary", state.editMode);
        elements.editModeButton.classList.toggle("button-secondary", !state.editMode);

        renderStats();
        renderDashboard();
        renderFooter();

        if (state.editMode) {
            renderSidebar();
            renderEditPanels();
        } else {
            elements.editSidebar.innerHTML = "";
            elements.editPanels.innerHTML = "";
        }
    }

    function renderDashboardOnly() {
        renderStats();
        renderDashboard();
        renderFooter();
        // Do not rebuild edit panels every 30 seconds: this would discard unsaved form input.
    }

    function getItemDetail(item) {
        const detail = state.status._details?.[item.id];
        if (detail) {
            const latest = Date.parse(state.status._meta?.checkedAt || detail.checkedAt || "");
            if (Number.isFinite(latest) && Date.now() - latest > 5 * 60 * 1000) {
                return { ...detail, state: "unknown", message: "Status data is stale; check the monitoring worker" };
            }
            return detail;
        }
        const raw = state.status[item.id];
        if (typeof raw !== "boolean") return { state: "unknown", message: "Not checked yet" };
        const online = item.invertStatus ? !raw : raw;
        return { state: online ? "online" : "offline", message: "Legacy status check" };
    }

    function getItemState(item) { return getItemDetail(item).state || "unknown"; }
    function getItemStatus(item) { return getItemState(item) === "online"; }

    function calculateStats() {
        const totals = { total: 0, online: 0, offline: 0, warning: 0, unknown: 0, maintenance: 0 };
        let samples = 0, up = 0;
        state.config.sections.forEach(section => section.items.forEach(item => {
            totals.total++;
            const status = getItemState(item);
            totals[status in totals ? status : "unknown"]++;
            const history = state.history[item.id]?.["24h"];
            if (history?.samples) { samples += history.samples; up += history.samples * history.uptime / 100; }
        }));
        totals.uptime = samples ? `${(up / samples * 100).toFixed(1)}%` : "—";
        return totals;
    }

    function renderStats() {
        const stats = calculateStats();
        elements.servicesCount.textContent = stats.total;
        elements.onlineCount.textContent = stats.online;
        elements.offlineCount.textContent = stats.offline;
        elements.uptimePercent.textContent = stats.uptime;
        elements.summaryNote.textContent = `Warning: ${stats.warning} · Unknown: ${stats.unknown} · Maintenance: ${stats.maintenance} · Uptime: last 24h of recorded checks`;
    }

    function renderFooter() {
        const checkedAt = state.status._meta?.checkedAt;
        elements.updatedAt.textContent = checkedAt && !isNaN(Date.parse(checkedAt))
            ? `Last check: ${new Date(checkedAt).toLocaleString()}` : "Waiting for first status check";
    }

    function favoriteButton(item) {
        const selected = state.favorites.has(item.id);
        const button = createIconButton(selected ? "★" : "☆", selected ? "Remove favorite" : "Add favorite", () => {
            if (state.favorites.has(item.id)) state.favorites.delete(item.id);
            else state.favorites.add(item.id);
            localStorage.setItem("dashboard-favorites", JSON.stringify([...state.favorites]));
            renderDashboard();
        });
        button.classList.add("favorite-button");
        button.setAttribute("aria-pressed", String(selected));
        return button;
    }

    function serviceMatches(item) {
        if (state.search && ![item.name, item.description, item.url, item.id].some(text => String(text || "").toLowerCase().includes(state.search))) return false;
        const status = getItemState(item);
        if (state.filter === "favorites" && !state.favorites.has(item.id)) return false;
        if (!["all", "favorites"].includes(state.filter) && status !== state.filter) return false;
        return true;
    }

    function openHistoryModal(item) {
        const info = state.history[item.id] || {};
        const detail = getItemDetail(item);
        const content = document.createElement("div");
        content.className = "history-modal";
        const heading = document.createElement("h2"); heading.textContent = `${item.name} · Health history`;
        const subtitle = document.createElement("p"); subtitle.className = "muted";
        subtitle.textContent = `Current: ${detail.state || "unknown"} · ${detail.message || "No details"}`;
        content.append(heading, subtitle);
        const table = document.createElement("div"); table.className = "history-periods";
        for (const period of ["24h", "7d", "30d"]) {
            const bucket = info[period];
            const cell = document.createElement("div"); cell.className = "history-period";
            cell.textContent = `${period}: ${bucket?.uptime == null ? "No data" : bucket.uptime.toFixed(2) + "%"} · ${bucket?.samples ?? 0} checks · ${bucket?.avgResponseMs == null ? "—" : bucket.avgResponseMs + "ms"}`;
            table.append(cell);
        }
        content.append(table);
        const bars = document.createElement("div"); bars.className = "uptime-bars"; bars.title = "Hourly availability (last 24 hours)";
        const hourly = Array.isArray(info.hourly) ? info.hourly : [];
        for (const hour of hourly) {
            const segment = document.createElement("div");
            segment.className = `uptime-bar uptime-bar-${hour.state || "unknown"}`;
            segment.title = `${hour.hour}: ${hour.state || "unknown"} (${hour.uptime == null ? "—" : hour.uptime + "%"})`;
            bars.append(segment);
        }
        if (hourly.length) content.append(bars);
        const close = createButton("Close", "button button-secondary", closeModal);
        content.append(close);
        openModal(content);
    }

    function renderDashboard() {
        elements.dashboard.innerHTML = "";

        if (!state.config.sections.length) {
            const empty = document.createElement("div");
            empty.className = "empty-state";
            empty.textContent = state.editMode ? "No sections yet. Add a new section to begin." : "No sections configured.";
            elements.dashboard.appendChild(empty);
            if (state.editMode) elements.dashboard.appendChild(createAddSectionButton());
            return;
        }

        state.config.sections.forEach((section, sectionIndex) => {
            const visibleItems = section.items.map((item, itemIndex) => ({ item, itemIndex })).filter(({ item }) => serviceMatches(item));
            if (!visibleItems.length && (state.search || state.filter !== "all") && !state.editMode) return;
            const sectionElement = document.createElement("section");
            sectionElement.className = "dashboard-section";
            sectionElement.dataset.sectionIndex = String(sectionIndex);
            sectionElement.style.borderColor = withAlpha(COLOR_VALUES[section.color] || COLOR_VALUES.blue, 0.22);

            if (state.editMode) {
                sectionElement.addEventListener("dragover", handleSectionDragOver);
                sectionElement.addEventListener("dragleave", handleDragLeave);
                sectionElement.addEventListener("drop", (event) => handleSectionDrop(event, sectionIndex));
            }

            sectionElement.appendChild(createSectionHeader(section, sectionIndex));

            const grid = document.createElement("div");
            grid.className = "services-grid";
            grid.dataset.sectionIndex = String(sectionIndex);

            if (state.editMode) {
                grid.addEventListener("dragover", handleHostGridDragOver);
                grid.addEventListener("dragleave", handleDragLeave);
                grid.addEventListener("drop", (event) => handleHostGridDrop(event, sectionIndex));
            }

            const sectionKey = section.id || section.title || String(sectionIndex);
            if (!state.collapsedSections.has(sectionKey)) {
                visibleItems.forEach(({ item, itemIndex }) => {
                    grid.appendChild(createServiceCard(item, sectionIndex, itemIndex));
                });
            } else {
                grid.classList.add("hidden");
            }

            sectionElement.appendChild(grid);
            if (state.editMode) {
                const dropZone = document.createElement("div");
                dropZone.className = "bookmark-drop-zone";
                dropZone.setAttribute("aria-hidden", "true");
                dropZone.textContent = "↘ Drop a browser bookmark or web link here";
                sectionElement.appendChild(dropZone);
            }
            elements.dashboard.appendChild(sectionElement);
        });

        if ((state.search || state.filter !== "all") && !elements.dashboard.querySelector(".dashboard-section")) {
            const empty = document.createElement("div");
            empty.className = "empty-state";
            empty.textContent = "No services match these filters.";
            elements.dashboard.append(empty);
        }
        if (state.editMode) {
            elements.dashboard.appendChild(createAddSectionButton());
        }
    }

    function createSectionHeader(section, sectionIndex) {
        const header = document.createElement("div");
        header.className = "section-header";

        const heading = document.createElement("div");
        heading.className = "section-heading";

        if (state.editMode) {
            const handle = document.createElement("span");
            handle.className = "drag-handle";
            handle.textContent = "⋮⋮";
            handle.title = "Drag to reorder section";
            handle.draggable = true;
            handle.addEventListener("dragstart", (event) => {
                state.drag = { type: "section", fromSectionIndex: sectionIndex };
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", JSON.stringify(state.drag));
            });
            heading.appendChild(handle);
        }

        const icon = document.createElement("div");
        icon.className = "section-icon";
        setIcon(icon, section.icon, "▦");
        icon.style.color = COLOR_VALUES[section.color] || COLOR_VALUES.blue;
        heading.appendChild(icon);

        const title = document.createElement("h2");
        title.className = "section-title";
        title.textContent = section.title;
        heading.appendChild(title);

        header.appendChild(heading);

        const actions = document.createElement("div");
        actions.className = "section-actions";

        if (state.editMode) {
            const editButton = createButton("✏ Edit Section", "button button-secondary", () => openSectionModal(sectionIndex));
            const addButton = createButton("+ Add Host", "button button-secondary", () => focusAddHost(sectionIndex));
            const deleteButton = createButton("🗑", "button button-danger", () => confirmDeleteSection(sectionIndex));
            const collapseButton = createButton(isSectionCollapsed(section) ? "⌄" : "⌃", "button button-secondary", () => toggleSectionCollapse(sectionIndex));

            actions.append(editButton, addButton, deleteButton, collapseButton);
        }

        header.appendChild(actions);
        return header;
    }

    function createServiceCard(item, sectionIndex, itemIndex) {
        const detail = getItemDetail(item);
        const statusName = detail.state || "unknown";
        const href = safeHref(item.url);
        const card = state.editMode ? document.createElement("article") : document.createElement("a");
        card.className = `service-card status-card-${statusName} ${statusName === "offline" ? "offline-card" : ""}`;
        card.dataset.sectionIndex = String(sectionIndex);
        card.dataset.itemIndex = String(itemIndex);
        if (!state.editMode) {
            card.href = href;
            card.target = "_blank";
            card.rel = "noopener noreferrer";
        } else {
            card.addEventListener("dragover", handleHostCardDragOver);
            card.addEventListener("dragleave", handleDragLeave);
            card.addEventListener("drop", event => handleHostCardDrop(event, sectionIndex, itemIndex));
            const tools = document.createElement("div");
            tools.className = "card-top-tools";
            tools.append(createIconButton("✏", "Edit host", () => openHostModal(sectionIndex, itemIndex)));
            tools.append(createIconButton("🗑", "Delete host", () => confirmDeleteHost(sectionIndex, itemIndex), "button-danger"));
            tools.append(favoriteButton(item));
            tools.append(createIconButton("📈", "Health history", () => openHistoryModal(item)));
            card.append(tools);
            const drag = document.createElement("span");
            drag.className = "drag-handle card-drag-handle";
            drag.textContent = "⋮⋮";
            drag.title = "Drag to reorder host";
            drag.draggable = true;
            drag.addEventListener("dragstart", event => {
                state.drag = { type: "host", fromSectionIndex: sectionIndex, fromItemIndex: itemIndex };
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", JSON.stringify(state.drag));
            });
            card.append(drag);
        }
        const content = document.createElement("div");
        const icon = document.createElement("div"); icon.className = "card-icon";
        setIcon(icon, item.icon, "🌍"); content.append(icon);
        const title = document.createElement("h3"); title.className = "card-title"; title.textContent = item.name;
        content.append(title);
        const description = document.createElement("div"); description.className = "card-description";
        description.textContent = item.description || ""; content.append(description);
        const metrics = document.createElement("div"); metrics.className = "service-metrics";
        const pieces = [];
        if (Number.isFinite(detail.responseMs)) pieces.push(`${detail.responseMs}ms`);
        if (detail.tlsDaysRemaining !== undefined) pieces.push(`TLS ${detail.tlsDaysRemaining}d`);
        const uptime = state.history[item.id]?.["24h"]?.uptime;
        if (uptime != null) pieces.push(`${uptime.toFixed(1)}% /24h`);
        metrics.textContent = pieces.join(" · ");
        if (pieces.length) content.append(metrics);
        card.append(content);
        const footer = document.createElement("div"); footer.className = "card-footer";
        const status = document.createElement("div"); status.className = `status status-${statusName}`;
        status.title = `${detail.message || statusName}${detail.checkedAt ? " · " + new Date(detail.checkedAt).toLocaleString() : ""}`;
        const dot = document.createElement("span"); dot.className = "status-dot";
        const text = document.createElement("span"); text.textContent = statusName.charAt(0).toUpperCase() + statusName.slice(1);
        status.append(dot, text); footer.append(status);
        const arrow = document.createElement("div"); arrow.className = "card-arrow"; arrow.textContent = "→";
        footer.append(arrow); card.append(footer);
        if (state.editMode) return card;
        const wrapper = document.createElement("div"); wrapper.className = "service-card-shell";
        wrapper.append(card);
        const actions = document.createElement("div"); actions.className = "service-card-actions";
        actions.append(favoriteButton(item), createIconButton("📈", "Health history", () => openHistoryModal(item)));
        wrapper.append(actions);
        return wrapper;
    }

    function createAddSectionButton() {
        return createButton("+ Add New Section (Block)", "button add-section-button", () => openSectionModal(null));
    }

    function renderSidebar() {
        elements.editSidebar.innerHTML = "";
        elements.editSidebar.appendChild(createAddHostPanel());
        elements.editSidebar.appendChild(createQuickSectionPanel());
        elements.editSidebar.appendChild(createNewSectionPanel());
    }

    function createAddHostPanel() {
        const panel = createPanel("Add New Host");
        const form = document.createElement("form");
        form.id = "addHostForm";
        form.noValidate = true;

        form.appendChild(createSelectField("Section", "newHostSection", state.config.sections.map((section, index) => ({ value: String(index), label: section.title })), String(state.selectedSectionIndex || 0)));
        form.appendChild(createInputField("ID (unique)", "newHostId", "e.g. my-new-host"));
        form.appendChild(createInputField("Name", "newHostName", "e.g. My Service"));
        form.appendChild(createTextAreaField("Description", "newHostDescription", "e.g. Service description"));
        form.appendChild(createInputField("URL / IP", "newHostUrl", "e.g. https://example.local"));
        form.appendChild(createSelectField("Icon", "newHostIcon", iconOptions(ALL_ICONS, "🌍"), "🌍"));
        form.appendChild(mountIconPicker(form.querySelector("#newHostIcon"), () => updateHostPreview(form, preview)));
        appendCheckFields(form, "newHost");
        form.appendChild(createCheckboxField("Invert status", "newHostInvert", false));

        const preview = document.createElement("div");
        preview.className = "preview-card";
        preview.id = "newHostPreview";
        form.appendChild(preview);

        const submit = createButton("+ Add Host", "button button-primary full-width", null, "submit");
        form.appendChild(submit);

        form.addEventListener("input", () => updateHostPreview(form, preview));
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            await addHostFromForm(form);
        });

        const nameInput = form.querySelector("#newHostName");
        const idInput = form.querySelector("#newHostId");
        nameInput.addEventListener("input", () => {
            if (!idInput.dataset.touched) {
                idInput.value = uniqueHostId(slugify(nameInput.value || "new-host"));
                updateHostPreview(form, preview);
            }
        });
        idInput.addEventListener("input", () => {
            idInput.dataset.touched = "true";
        });

        panel.appendChild(form);
        updateHostPreview(form, preview);
        return panel;
    }

    function appendCheckFields(form, prefix, item = {}) {
        const heading = document.createElement("h4"); heading.textContent = "Health check options";
        form.append(heading);
        const types = [
            { value: "auto", label: "Auto (HTTP or ICMP)" },
            { value: "http", label: "HTTP / HTTPS" },
            { value: "tcp", label: "TCP port" },
            { value: "icmp", label: "ICMP ping" }
        ];
        form.append(createSelectField("Check type", `${prefix}CheckType`, types, item.checkType || "auto"));
        form.append(createInputField("TCP port (0 = automatic)", `${prefix}CheckPort`, "443", String(item.checkPort || 0), "number"));
        form.append(createInputField("HTTP path (optional)", `${prefix}CheckPath`, "/health", item.checkPath || ""));
        form.append(createInputField("Expected HTTP code (0 = 200–399)", `${prefix}ExpectedStatus`, "200", String(item.expectedStatus || 0), "number"));
        form.append(createInputField("Slow response warning (ms; 0 = off)", `${prefix}WarnResponseMs`, "1500", String(item.warnResponseMs || 0), "number"));
        form.append(createInputField("TLS expiry warning (days)", `${prefix}TlsWarnDays`, "30", String(item.tlsWarnDays ?? 30), "number"));
        form.append(createCheckboxField("Maintenance mode (pause checks)", `${prefix}Maintenance`, Boolean(item.maintenance)));
    }

    function checkFieldData(form, prefix) {
        const get = name => form.querySelector(`#${prefix}${name}`);
        return {
            checkType: get("CheckType")?.value || "auto",
            checkPort: Number(get("CheckPort")?.value || 0),
            checkPath: get("CheckPath")?.value.trim() || "",
            expectedStatus: Number(get("ExpectedStatus")?.value || 0),
            warnResponseMs: Number(get("WarnResponseMs")?.value || 0),
            tlsWarnDays: Number(get("TlsWarnDays")?.value || 0),
            maintenance: Boolean(get("Maintenance")?.checked)
        };
    }

    function createQuickSectionPanel() {
        const panel = createPanel("Edit Section (Block)");
        if (!state.config.sections.length) {
            const empty = document.createElement("div");
            empty.className = "empty-state";
            empty.textContent = "No section selected.";
            panel.appendChild(empty);
            return panel;
        }

        const index = Math.min(state.selectedSectionIndex || 0, state.config.sections.length - 1);
        const section = state.config.sections[index];
        const form = document.createElement("form");
        form.noValidate = true;

        form.appendChild(createSelectField("Section", "quickSectionIndex", state.config.sections.map((entry, entryIndex) => ({ value: String(entryIndex), label: entry.title })), String(index)));
        form.appendChild(createInputField("Title", "quickSectionTitle", "Section title", section.title));
        form.appendChild(createSelectField("Icon", "quickSectionIcon", iconOptions(ALL_SECTION_ICONS, section.icon || "▦"), section.icon || "▦"));
        form.appendChild(mountIconPicker(form.querySelector("#quickSectionIcon"), () => {}));
        form.appendChild(createColorPicker("quickSectionColor", section.color || "blue"));

        const actions = document.createElement("div");
        actions.className = "form-actions";
        actions.appendChild(createButton("Open Advanced", "button button-secondary", () => openSectionModal(index), "button"));
        actions.appendChild(createButton("Save Changes", "button button-success", null, "submit"));
        form.appendChild(actions);

        form.querySelector("#quickSectionIndex").addEventListener("change", (event) => {
            state.selectedSectionIndex = Number(event.target.value);
            renderSidebar();
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            await mutateAndSave(() => {
                const target = state.config.sections[index];
                target.title = form.querySelector("#quickSectionTitle").value.trim();
                target.icon = form.querySelector("#quickSectionIcon").value;
                target.color = form.querySelector("input[name='quickSectionColor']:checked")?.value || "blue";
            }, "Section saved");
        });

        panel.appendChild(form);
        return panel;
    }

    function createNewSectionPanel() {
        const panel = createPanel("Add New Section (Block)");
        const form = document.createElement("form");
        form.noValidate = true;
        form.appendChild(createInputField("Title", "sideNewSectionTitle", "e.g. Kubernetes"));
        form.appendChild(createSelectField("Icon", "sideNewSectionIcon", iconOptions(ALL_SECTION_ICONS, "▦"), "▦"));
        form.appendChild(mountIconPicker(form.querySelector("#sideNewSectionIcon"), () => {}));
        form.appendChild(createColorPicker("sideNewSectionColor", "purple"));
        form.appendChild(createButton("+ Add Section", "button button-primary full-width", null, "submit"));
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const title = form.querySelector("#sideNewSectionTitle").value.trim();
            if (!title) return notify("warning", "Missing title", "Section title is required.");
            await createSection({
                title,
                icon: form.querySelector("#sideNewSectionIcon").value,
                color: form.querySelector("input[name='sideNewSectionColor']:checked")?.value || "purple"
            });
            form.reset();
        });
        panel.appendChild(form);
        return panel;
    }

    function renderEditPanels() {
        elements.editPanels.innerHTML = "";
        elements.editPanels.appendChild(createImportPanel());
        elements.editPanels.appendChild(createExportPanel());
        elements.editPanels.appendChild(createBackupPanel());
        elements.editPanels.appendChild(createRestorePanel());
        elements.editPanels.appendChild(createFunctionsPanel());
        elements.editPanels.appendChild(createNotificationsPanel());
        elements.editPanels.appendChild(createMobilePreviewPanel());
        elements.editPanels.appendChild(createSecurityPanel());
    }

    function createImportPanel() {
        const panel = createPanel("Import Configuration", "panel-medium");
        const text = document.createElement("p");
        text.textContent = "Upload a config.json file to import.";
        panel.appendChild(text);
        const zone = createUploadZone("Drag & drop or click to select file", async (file) => importConfigFile(file, "Configuration imported"));
        panel.appendChild(zone);
        panel.appendChild(createButton("Import", "button button-primary full-width", () => elements.importFileInput.click()));
        return panel;
    }

    function createExportPanel() {
        const panel = createPanel("Export Configuration", "panel-medium");
        const text = document.createElement("p");
        text.textContent = "Download your current configuration or create a manual backup.";
        panel.appendChild(text);
        panel.appendChild(createButton("↧ Download config.json", "button button-secondary full-width", exportConfig));
        panel.appendChild(spacer(10));
        panel.appendChild(createButton("▣ Create Backup", "button button-secondary full-width", createBackup));
        return panel;
    }

    function createBackupPanel() {
        const panel = createPanel("Backup (Auto)", "panel-medium");
        const info = document.createElement("p");
        info.textContent = `Backups are automatic before saves and restores. Up to ${state.backupRetention || 100} most recent backups are retained.`;
        panel.appendChild(info);
        const last = document.createElement("p");
        last.className = "green";
        last.textContent = state.backups.length ? `Last backup: ${formatBackupTime(state.backups[0].createdAt)}` : "No backups yet.";
        panel.appendChild(last);
        panel.appendChild(createButton("View Backups", "button button-secondary full-width", openBackupsModal));
        return panel;
    }

    function createRestorePanel() {
        const panel = createPanel("Restore Configuration", "panel-medium");
        const info = document.createElement("p");
        info.textContent = "Restore from a backup or from a local config file.";
        panel.appendChild(info);
        panel.appendChild(createButton("↧ Select Backup", "button button-secondary full-width", openBackupsModal));
        panel.appendChild(spacer(10));
        panel.appendChild(createButton("Restore From File", "button button-danger full-width", () => elements.restoreFileInput.click()));
        return panel;
    }

    function createFunctionsPanel() {
        const panel = createPanel("Functions", "panel-wide");
        const grid = document.createElement("div");
        grid.className = "functions-grid";
        const functions = [
            ["🔐", "Password Protection", "Edit mode is protected by server-side login."],
            ["☁️", "Auto Backup", "A backup is created before every save."],
            ["↔️", "Drag & Drop", "Reorder sections and hosts directly."],
            ["↕️", "Import / Export", "Move your configuration safely."],
            ["😀", "Icon Picker", "Choose from a built-in icon library."],
            ["👁", "Live Preview", "Preview host changes before saving."],
            ["📱", "Mobile Preview", "See how the dashboard looks on mobile."],
            [state.theme === "dark" ? "☀️" : "🌙", "Dark / Light", "Switch dashboard theme."]
        ];

        functions.forEach(([icon, title, text], index) => {
            const item = document.createElement("div");
            item.className = "function-item";
            const button = document.createElement(index === 7 ? "button" : "div");
            button.className = "function-icon";
            button.textContent = icon;
            if (index === 7) {
                button.type = "button";
                button.addEventListener("click", toggleTheme);
                button.title = "Toggle theme";
            }
            const titleElement = document.createElement("div");
            titleElement.className = "function-title";
            titleElement.textContent = title;
            const textElement = document.createElement("div");
            textElement.className = "function-text";
            textElement.textContent = text;
            item.append(button, titleElement, textElement);
            grid.appendChild(item);
        });

        panel.appendChild(grid);
        return panel;
    }

    function createNotificationsPanel() {
        const panel = createPanel("Notifications (Toasts)", "panel-medium");
        const list = document.createElement("div");
        list.className = "inline-list";
        const notifications = state.notifications.slice(0, 4);
        if (!notifications.length) {
            const examples = [
                { type: "success", title: "Success", message: "Configuration saved successfully." },
                { type: "info", title: "Backup Created", message: "Backup saved automatically." },
                { type: "warning", title: "Changes Unsaved", message: "You have unsaved changes." },
                { type: "error", title: "Error", message: "Failed to save configuration." }
            ];
            examples.forEach((entry) => list.appendChild(createToastPreview(entry)));
        } else {
            notifications.forEach((entry) => list.appendChild(createToastPreview(entry)));
        }
        panel.appendChild(list);
        return panel;
    }

    function createMobilePreviewPanel() {
        const panel = createPanel("Mobile Preview", "panel-medium");
        const wrap = document.createElement("div");
        wrap.className = "mobile-preview-wrap";
        const frame = document.createElement("div");
        frame.className = "phone-frame";
        const screen = document.createElement("div");
        screen.className = "phone-screen";
        const stats = calculateStats();
        const firstSection = state.config.sections[0];
        const services = firstSection ? firstSection.items.slice(0, 3) : [];

        const top = document.createElement("div");
        top.className = "phone-top";
        top.innerHTML = "<span>9:41</span><span>●●●</span>";
        screen.appendChild(top);

        const title = document.createElement("div");
        title.className = "phone-title";
        title.textContent = "Dashboard";
        screen.appendChild(title);

        const statGrid = document.createElement("div");
        statGrid.className = "phone-stats";
        [[stats.total, "Services"], [stats.online, "Online"], [stats.offline, "Offline"]].forEach(([value, label]) => {
            const stat = document.createElement("div");
            stat.className = "phone-stat";
            stat.innerHTML = `<strong>${escapeHtml(String(value))}</strong><br><small>${escapeHtml(label)}</small>`;
            statGrid.appendChild(stat);
        });
        screen.appendChild(statGrid);

        const sectionTitle = document.createElement("div");
        sectionTitle.className = "function-title";
        sectionTitle.textContent = firstSection ? firstSection.title : "No section";
        screen.appendChild(sectionTitle);

        services.forEach((item) => {
            const row = document.createElement("div");
            row.className = "phone-service";
            const isOnline = getItemStatus(item);
            const serviceTitle = document.createElement("div");
            serviceTitle.className = "phone-service-title";
            serviceTitle.append(createIconNode(item.icon || "🌍"), document.createTextNode(` ${item.name}`));
            const serviceStatus = document.createElement("small");
            serviceStatus.className = isOnline ? "green" : "red";
            serviceStatus.textContent = `● ${isOnline ? "Online" : "Offline"}`;
            row.append(serviceTitle, serviceStatus);
            screen.appendChild(row);
        });

        frame.appendChild(screen);
        wrap.appendChild(frame);
        panel.appendChild(wrap);
        return panel;
    }

    function createSecurityPanel() {
        const panel = createPanel("Security (Edit Mode)", "panel-medium");
        const lock = document.createElement("div");
        lock.className = "security-lock";
        lock.textContent = "🔒";
        panel.appendChild(lock);

        const info = document.createElement("p");
        info.textContent = "Edit mode is password protected. Change password and session timeout here.";
        panel.appendChild(info);

        const form = document.createElement("form");
        form.noValidate = true;
        form.appendChild(createInputField("Current Password", "currentPassword", "Current password", "", "password"));
        form.appendChild(createInputField("New Password", "newPassword", "Leave blank to keep current password", "", "password"));
        form.appendChild(createInputField("Confirm New Password", "confirmPassword", "Confirm new password", "", "password"));
        form.appendChild(createCheckboxField("Private dashboard (require login to view services)", "privateView", Boolean(state.security?.privateView)));
        form.appendChild(createSelectField("Session timeout", "sessionTimeout", [
            { value: "10", label: "10 minutes" },
            { value: "30", label: "30 minutes" },
            { value: "60", label: "60 minutes" },
            { value: "120", label: "120 minutes" },
            { value: "480", label: "8 hours" }
        ], String(state.security?.sessionTimeoutMinutes || 30)));
        const actions = document.createElement("div");
        actions.className = "form-actions";
        actions.appendChild(createButton("Lock Now", "button button-secondary", logout, "button"));
        actions.appendChild(createButton("Save", "button button-success", null, "submit"));
        form.appendChild(actions);

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            await saveSecuritySettings(form);
        });

        panel.appendChild(form);
        return panel;
    }

    function createToastPreview(entry) {
        const element = document.createElement("div");
        element.className = `toast ${entry.type || "info"}`;
        element.innerHTML = `<div><strong>${escapeHtml(entry.title)}</strong><p>${escapeHtml(entry.message)}</p></div>`;
        return element;
    }

    function createUploadZone(label, onFile) {
        const zone = document.createElement("button");
        zone.type = "button";
        zone.className = "upload-zone";
        zone.textContent = label;
        zone.addEventListener("click", () => elements.importFileInput.click());
        zone.addEventListener("dragover", (event) => {
            event.preventDefault();
            zone.classList.add("drag-active");
        });
        zone.addEventListener("dragleave", () => zone.classList.remove("drag-active"));
        zone.addEventListener("drop", async (event) => {
            event.preventDefault();
            zone.classList.remove("drag-active");
            const file = event.dataTransfer.files?.[0];
            if (file) await onFile(file);
        });
        return zone;
    }

    function createPanel(title, extraClass = "") {
        const panel = document.createElement("section");
        panel.className = `panel ${extraClass}`.trim();
        const header = document.createElement("div");
        header.className = "panel-header";
        const heading = document.createElement("h3");
        heading.textContent = title;
        header.appendChild(heading);
        panel.appendChild(header);
        return panel;
    }

    function createButton(label, className, handler, type = "button") {
        const button = document.createElement("button");
        button.type = type;
        button.className = className;
        button.textContent = label;
        if (handler) button.addEventListener("click", handler);
        return button;
    }

    function createIconButton(label, title, handler, extra = "") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `icon-button ${extra}`.trim();
        button.textContent = label;
        button.title = title;
        button.setAttribute("aria-label", title);
        button.addEventListener("click", handler);
        return button;
    }

    function createInputField(label, id, placeholder, value = "", type = "text") {
        const wrapper = document.createElement("div");
        wrapper.className = "form-field";
        const labelElement = document.createElement("label");
        labelElement.htmlFor = id;
        labelElement.textContent = label;
        const input = document.createElement("input");
        input.className = "form-control";
        input.id = id;
        input.type = type;
        input.placeholder = placeholder || "";
        input.value = value || "";
        wrapper.append(labelElement, input);
        return wrapper;
    }

    function createTextAreaField(label, id, placeholder, value = "") {
        const wrapper = document.createElement("div");
        wrapper.className = "form-field";
        const labelElement = document.createElement("label");
        labelElement.htmlFor = id;
        labelElement.textContent = label;
        const input = document.createElement("textarea");
        input.className = "form-control";
        input.id = id;
        input.placeholder = placeholder || "";
        input.value = value || "";
        wrapper.append(labelElement, input);
        return wrapper;
    }

    function createSelectField(label, id, options, value = "") {
        const wrapper = document.createElement("div");
        wrapper.className = "form-field";
        const labelElement = document.createElement("label");
        labelElement.htmlFor = id;
        labelElement.textContent = label;
        const select = document.createElement("select");
        select.className = "form-select";
        select.id = id;
        options.forEach((option) => {
            const optionElement = document.createElement("option");
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            if (String(option.value) === String(value)) optionElement.selected = true;
            select.appendChild(optionElement);
        });
        wrapper.append(labelElement, select);
        return wrapper;
    }

    function createCheckboxField(label, id, checked = false) {
        const wrapper = document.createElement("label");
        wrapper.className = "checkbox-row";
        const input = document.createElement("input");
        input.id = id;
        input.type = "checkbox";
        input.checked = Boolean(checked);
        const span = document.createElement("span");
        span.textContent = label;
        wrapper.append(input, span);
        return wrapper;
    }

    function createColorPicker(name, selected) {
        const wrapper = document.createElement("div");
        wrapper.className = "form-field";
        const label = document.createElement("label");
        label.textContent = "Color";
        const row = document.createElement("div");
        row.className = "color-picker";
        SECTION_COLORS.forEach((color) => {
            const id = `${name}-${color}`;
            const input = document.createElement("input");
            input.type = "radio";
            input.name = name;
            input.value = color;
            input.id = id;
            input.className = "hidden";
            input.checked = color === selected;
            const swatch = document.createElement("label");
            swatch.className = `color-swatch ${color === selected ? "active" : ""}`;
            swatch.htmlFor = id;
            swatch.style.background = COLOR_VALUES[color];
            swatch.title = color;
            input.addEventListener("change", () => {
                row.querySelectorAll(".color-swatch").forEach((entry) => entry.classList.remove("active"));
                swatch.classList.add("active");
            });
            row.append(input, swatch);
        });
        wrapper.append(label, row);
        return wrapper;
    }

    function spacer(height) {
        const div = document.createElement("div");
        div.style.height = `${height}px`;
        return div;
    }

    async function handleEditModeButton() {
        if (state.editMode) {
            exitEditMode();
            return;
        }

        await refreshSession();
        if (!state.authenticated) {
            openLoginModal(true);
            return;
        }

        await enterEditMode();
    }

    async function enterEditMode() {
        state.editMode = true;
        await Promise.all([loadSecurity(), loadBackups()]);
        notify("info", "Edit Mode Active", "Admin tools are now visible.");
        render();
    }

    function exitEditMode() {
        state.editMode = false;
        closeModal();
        render();
    }

    async function logout() {
        try {
            await apiFetch("/api/logout", { method: "POST" });
        } catch (_) {
            // ignore logout errors
        }
        state.authenticated = false;
        state.csrfToken = null;
        state.editMode = false;
        if (state.privateView) {
            state.locked = true;
            state.config = { sections: [] };
            state.status = {};
            state.history = {};
        }
        notify("info", "Edit Mode Locked", "You have been logged out.");
        render();
    }

    function openLoginModal(editAfter = true) {
        const content = document.createElement("div");
        content.innerHTML = `
            <div class="modal-header">
                <div>
                    <h2 class="modal-title">${editAfter ? "Unlock Edit Mode" : "Sign in"}</h2>
                    <p class="modal-subtitle">Enter your admin password to access the dashboard.</p>
                </div>
                <button class="modal-close" type="button" aria-label="Close">×</button>
            </div>
            <form id="loginForm">
                <div class="security-lock">🔒</div>
                <div class="form-field">
                    <label for="adminPassword">Password</label>
                    <input class="form-control" id="adminPassword" type="password" autocomplete="current-password" required>
                </div>
                <label class="checkbox-row">
                    <input id="rememberSession" type="checkbox" checked>
                    <span>Remember me for this session</span>
                </label>
                <div class="form-actions">
                    <button class="button button-secondary" type="button" data-close>Cancel</button>
                    <button class="button button-success" type="submit">Unlock</button>
                </div>
            </form>
        `;
        openModal(content);
        content.querySelector(".modal-close").addEventListener("click", closeModal);
        content.querySelector("[data-close]").addEventListener("click", closeModal);
        content.querySelector("#loginForm").addEventListener("submit", async (event) => {
            event.preventDefault();
            const password = content.querySelector("#adminPassword").value;
            try {
                const result = await apiFetch("/api/login", { method: "POST", body: { password } });
                state.authenticated = true;
                state.csrfToken = result.csrfToken;
                closeModal();
                if (state.locked) {
                    state.locked = false;
                    await Promise.all([loadConfig(), loadStatus(), loadHistory()]);
                }
                if (editAfter) await enterEditMode();
                else render();
            } catch (error) {
                notify("error", "Login failed", error.message);
            }
        });
        window.setTimeout(() => content.querySelector("#adminPassword")?.focus(), 50);
    }

    function openHostModal(sectionIndex, itemIndex) {
        const item = deepClone(state.config.sections[sectionIndex].items[itemIndex]);
        const content = document.createElement("div");
        content.innerHTML = `
            <div class="modal-header">
                <div>
                    <h2 class="modal-title">Edit Host</h2>
                    <p class="modal-subtitle">Update all fields required for the status check and dashboard card.</p>
                </div>
                <button class="modal-close" type="button" aria-label="Close">×</button>
            </div>
            <div class="modal-grid">
                <form id="editHostForm" novalidate>
                    <div class="form-field">
                        <label for="hostId">ID (unique)</label>
                        <input class="form-control" id="hostId" value="${escapeAttr(item.id)}" required>
                    </div>
                    <div class="form-field">
                        <label for="hostName">Name</label>
                        <input class="form-control" id="hostName" value="${escapeAttr(item.name)}" required>
                    </div>
                    <div class="form-field">
                        <label for="hostDescription">Description</label>
                        <textarea class="form-control" id="hostDescription">${escapeHtml(item.description || "")}</textarea>
                    </div>
                    <div class="form-field">
                        <label for="hostUrl">URL / IP</label>
                        <input class="form-control" id="hostUrl" value="${escapeAttr(item.url)}" required>
                    </div>
                    <div class="form-field">
                        <label for="hostIcon">Icon</label>
                        <select class="form-select" id="hostIcon">
                            ${iconSelectOptions(ALL_ICONS, item.icon)}
                        </select>
                    </div>
                    <div id="hostCheckFields"></div>
                    <label class="checkbox-row">
                        <input id="hostInvert" type="checkbox" ${item.invertStatus ? "checked" : ""}>
                        <span>Invert status (for checks that should be offline when reachable)</span>
                    </label>
                    <div class="form-actions">
                        <button class="button button-secondary" type="button" data-close>Cancel</button>
                        <button class="button button-success" type="submit">Save Changes</button>
                    </div>
                </form>
                <aside>
                    <h3>Live Preview</h3>
                    <div id="hostLivePreview" class="preview-card"></div>
                    <h3>Icon Picker</h3>
                    <div id="hostIconGrid"></div>
                </aside>
            </div>
        `;
        openModal(content);
        const form = content.querySelector("#editHostForm");
        appendCheckFields(content.querySelector("#hostCheckFields"), "host", item);
        const preview = content.querySelector("#hostLivePreview");
        const iconSelect = content.querySelector("#hostIcon");
        content.querySelector("#hostIconGrid").appendChild(mountIconPicker(iconSelect, () => updateHostPreview(form, preview)));
        form.addEventListener("input", () => updateHostPreview(form, preview));
        iconSelect.addEventListener("change", () => updateHostPreview(form, preview));
        updateHostPreview(form, preview);

        content.querySelector(".modal-close").addEventListener("click", closeModal);
        content.querySelector("[data-close]").addEventListener("click", closeModal);
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const data = readHostForm(form);
            const error = validateHost(data, item.id);
            if (error) return notify("warning", "Validation failed", error);
            await mutateAndSave(() => {
                state.config.sections[sectionIndex].items[itemIndex] = data;
            }, "Host saved");
            closeModal();
        });
    }

    function openSectionModal(sectionIndex) {
        const isNew = sectionIndex === null || sectionIndex === undefined;
        const section = isNew ? { title: "", icon: "▦", color: "purple" } : state.config.sections[sectionIndex];
        const content = document.createElement("div");
        content.innerHTML = `
            <div class="modal-header">
                <div>
                    <h2 class="modal-title">${isNew ? "Add New Section (Block)" : "Edit Section (Block)"}</h2>
                    <p class="modal-subtitle">Sections group related hosts and services.</p>
                </div>
                <button class="modal-close" type="button" aria-label="Close">×</button>
            </div>
            <form id="sectionForm" novalidate>
                <div class="form-field">
                    <label for="sectionTitle">Title</label>
                    <input class="form-control" id="sectionTitle" value="${escapeAttr(section.title)}" placeholder="e.g. Kubernetes" required>
                </div>
                <div class="form-field">
                    <label for="sectionIcon">Icon</label>
                    <select class="form-select" id="sectionIcon">
                        ${iconSelectOptions(ALL_SECTION_ICONS, section.icon)}
                    </select>
                </div>
                <div id="sectionIconPickerMount"></div>
                <div id="sectionColorMount"></div>
                <div class="form-actions">
                    <button class="button button-secondary" type="button" data-close>Cancel</button>
                    <button class="button ${isNew ? "button-primary" : "button-success"}" type="submit">${isNew ? "Create Section" : "Save Changes"}</button>
                </div>
            </form>
        `;
        openModal(content);
        content.querySelector("#sectionIconPickerMount").appendChild(mountIconPicker(content.querySelector("#sectionIcon"), () => {}));
        content.querySelector("#sectionColorMount").appendChild(createColorPicker("modalSectionColor", section.color || "blue"));
        content.querySelector(".modal-close").addEventListener("click", closeModal);
        content.querySelector("[data-close]").addEventListener("click", closeModal);
        content.querySelector("#sectionForm").addEventListener("submit", async (event) => {
            event.preventDefault();
            const title = content.querySelector("#sectionTitle").value.trim();
            if (!title) return notify("warning", "Missing title", "Section title is required.");
            const payload = {
                title,
                icon: content.querySelector("#sectionIcon").value,
                color: content.querySelector("input[name='modalSectionColor']:checked")?.value || "blue"
            };
            if (isNew) {
                await createSection(payload);
            } else {
                await mutateAndSave(() => {
                    Object.assign(state.config.sections[sectionIndex], payload);
                }, "Section saved");
            }
            closeModal();
        });
    }

    function openConfirmModal({ title, message, confirmText = "Confirm", danger = false, onConfirm }) {
        const content = document.createElement("div");
        content.innerHTML = `
            <div class="modal-header">
                <div>
                    <h2 class="modal-title">${escapeHtml(title)}</h2>
                    <p class="modal-subtitle">${escapeHtml(message)}</p>
                </div>
                <button class="modal-close" type="button" aria-label="Close">×</button>
            </div>
            <div class="form-actions">
                <button class="button button-secondary" type="button" data-close>Cancel</button>
                <button class="button ${danger ? "button-danger" : "button-success"}" type="button" data-confirm>${escapeHtml(confirmText)}</button>
            </div>
        `;
        openModal(content);
        content.querySelector(".modal-close").addEventListener("click", closeModal);
        content.querySelector("[data-close]").addEventListener("click", closeModal);
        content.querySelector("[data-confirm]").addEventListener("click", async () => {
            closeModal();
            await onConfirm();
        });
    }

    async function openBackupsModal() {
        try {
            await loadBackups();
        } catch (error) {
            notify("error", "Could not load backups", error.message);
            return;
        }

        const content = document.createElement("div");
        content.innerHTML = `
            <div class="modal-header">
                <div>
                    <h2 class="modal-title">Backups</h2>
                    <p class="modal-subtitle">Restore, download or delete saved config backups.</p>
                </div>
                <button class="modal-close" type="button" aria-label="Close">×</button>
            </div>
            <div id="backupList" class="inline-list"></div>
            <div class="form-actions">
                <button class="button button-secondary" type="button" data-close>Close</button>
                <button class="button button-primary" type="button" data-create>Create Backup</button>
            </div>
        `;
        openModal(content);
        content.querySelector(".modal-close").addEventListener("click", closeModal);
        content.querySelector("[data-close]").addEventListener("click", closeModal);
        content.querySelector("[data-create]").addEventListener("click", createBackup);

        const list = content.querySelector("#backupList");
        if (!state.backups.length) {
            const empty = document.createElement("div");
            empty.className = "empty-state";
            empty.textContent = "No backups available yet.";
            list.appendChild(empty);
            return;
        }

        state.backups.forEach((backup) => {
            const row = document.createElement("div");
            row.className = "backup-row";
            const meta = document.createElement("div");
            meta.innerHTML = `<strong>${escapeHtml(backup.name)}</strong><div class="backup-meta">${escapeHtml(formatBytes(backup.size))} · ${escapeHtml(formatBackupTime(backup.createdAt))}</div>`;
            row.appendChild(meta);
            row.appendChild(createButton("Preview", "button button-secondary", () => previewBackup(backup.name)));
            row.appendChild(createButton("Download", "button button-secondary", () => downloadBackup(backup.name)));
            row.appendChild(createButton("Restore", "button button-success", () => confirmRestoreBackup(backup.name)));
            row.appendChild(createButton("Delete", "button button-danger", () => confirmDeleteBackup(backup.name)));
            list.appendChild(row);
        });
    }

    async function previewBackup(name) {
        try {
            const info = await apiFetch(`/api/backup/${encodeURIComponent(name)}/preview`);
            openConfirmModal({
                title: "Backup preview",
                message: `Backup: ${info.backup.sections} sections / ${info.backup.services} services. Current: ${info.current.sections} sections / ${info.current.services} services. Restore this backup?`,
                confirmText: "Restore backup",
                danger: true,
                onConfirm: () => restoreBackup(name)
            });
        } catch (error) { notify("error", "Backup preview failed", error.message); }
    }

    async function restoreBackup(name) {
        try {
            const result = await apiFetch("/api/restore", { method: "POST", body: { name } });
            state.config = normalizeConfig(result.config);
            await Promise.all([loadBackups(), loadStatus(), loadHistory()]);
            notify("success", "Configuration restored", name);
            render();
        } catch (error) { notify("error", "Restore failed", error.message); }
    }

    function openModal(contentNode) {
        elements.modal.innerHTML = "";
        elements.modal.appendChild(contentNode);
        elements.modalOverlay.classList.remove("hidden");
    }

    function closeModal() {
        elements.modalOverlay.classList.add("hidden");
        elements.modal.innerHTML = "";
    }

    function readHostForm(form) {
        return {
            id: form.querySelector("#hostId, #newHostId, #bookmarkHostId")?.value.trim(),
            name: form.querySelector("#hostName, #newHostName, #bookmarkHostName")?.value.trim(),
            description: form.querySelector("#hostDescription, #newHostDescription, #bookmarkHostDescription")?.value.trim() || "",
            url: form.querySelector("#hostUrl, #newHostUrl, #bookmarkHostUrl")?.value.trim(),
            icon: form.querySelector("#hostIcon, #newHostIcon, #bookmarkHostIcon")?.value || "🌍",
            invertStatus: Boolean(form.querySelector("#hostInvert, #newHostInvert, #bookmarkHostInvert")?.checked),
            ...checkFieldData(form, form.id === "editHostForm" ? "host" : form.id === "bookmarkHostForm" ? "bookmarkHost" : "newHost")
        };
    }

    function updateHostPreview(form, preview) {
        const data = readHostForm(form);
        preview.innerHTML = `
            <div class="card-icon"></div>
            <h3 class="card-title">${escapeHtml(data.name || "New Host")}</h3>
            <div class="card-description">${escapeHtml(data.description || "Description")}</div>
            <div class="status status-online"><span class="status-dot"></span><span>Live preview</span></div>
        `;
        setIcon(preview.querySelector(".card-icon"), data.icon || "🌍", "🌍");
    }

    async function addHostFromForm(form) {
        const sectionIndex = Number(form.querySelector("#newHostSection").value);
        const data = readHostForm(form);
        const error = validateHost(data);
        if (error) return notify("warning", "Validation failed", error);
        await mutateAndSave(() => {
            state.config.sections[sectionIndex].items.push(data);
            state.selectedSectionIndex = sectionIndex;
        }, "Host added");
        form.reset();
        notify("success", "Host added", `${data.name} has been added.`);
    }

    async function createSection(payload) {
        await mutateAndSave(() => {
            state.config.sections.push({
                id: uniqueSectionId(slugify(payload.title)),
                title: payload.title,
                icon: payload.icon || "▦",
                color: payload.color || "blue",
                items: []
            });
            state.selectedSectionIndex = state.config.sections.length - 1;
        }, "Section added");
    }

    function validateHost(host, originalId = null) {
        if (!host.id) return "ID is required.";
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(host.id)) return "ID may only contain letters, numbers, underscore and dash.";
        if (!host.name) return "Name is required.";
        if (!host.url) return "URL / IP is required.";
        const existing = getAllHostIds().filter((id) => id !== originalId);
        if (existing.includes(host.id)) return "ID must be unique.";
        if (!isValidTarget(host.url)) return "URL / IP must be http(s), a hostname or an IP address.";
        if (host.checkType === "http" && !/^https?:\/\//i.test(host.url)) return "HTTP checks require an http(s) URL.";
        if (host.checkType === "tcp" && !host.checkPort && !/^https?:\/\//i.test(host.url)) return "Enter a TCP port for this host.";
        for (const [key, max] of [["checkPort", 65535], ["expectedStatus", 599], ["warnResponseMs", 60000], ["tlsWarnDays", 365]]) {
            if (!Number.isInteger(host[key]) || host[key] < 0 || host[key] > max) return `Invalid ${key}.`;
        }
        if (host.checkPath && (!host.checkPath.startsWith("/") || host.checkPath.length > 200)) return "HTTP path must start with /.";
        return null;
    }

    async function mutateAndSave(mutator, successMessage) {
        const previous = deepClone(state.config);
        try {
            mutator();
            state.config = normalizeConfig(state.config);
            render();
            const saved = await apiFetch("/api/save-config", { method: "POST", body: state.config });
            state.config = normalizeConfig(saved.config || state.config);
            await loadBackups();
            notify("success", "Success", successMessage || "Configuration saved successfully.");
            render();
            return true;
        } catch (error) {
            state.config = previous;
            render();
            notify("error", "Failed to save", error.message);
            return false;
        }
    }

    function confirmDeleteHost(sectionIndex, itemIndex) {
        const item = state.config.sections[sectionIndex].items[itemIndex];
        openConfirmModal({
            title: "Delete Host",
            message: `Delete ${item.name}? This cannot be undone without restoring a backup.`,
            confirmText: "Delete Host",
            danger: true,
            onConfirm: async () => mutateAndSave(() => {
                state.config.sections[sectionIndex].items.splice(itemIndex, 1);
            }, "Host deleted")
        });
    }

    function confirmDeleteSection(sectionIndex) {
        const section = state.config.sections[sectionIndex];
        openConfirmModal({
            title: "Delete Section",
            message: `Delete ${section.title} and all hosts inside it?`,
            confirmText: "Delete Section",
            danger: true,
            onConfirm: async () => mutateAndSave(() => {
                state.config.sections.splice(sectionIndex, 1);
                state.selectedSectionIndex = 0;
            }, "Section deleted")
        });
    }

    function toggleSectionCollapse(sectionIndex) {
        const section = state.config.sections[sectionIndex];
        const key = section.id || section.title || String(sectionIndex);
        if (state.collapsedSections.has(key)) state.collapsedSections.delete(key);
        else state.collapsedSections.add(key);
        localStorage.setItem("dashboard-collapsed-sections", JSON.stringify([...state.collapsedSections]));
        renderDashboard();
    }

    function isSectionCollapsed(section) {
        const key = section.id || section.title;
        return state.collapsedSections.has(key);
    }

    function focusAddHost(sectionIndex) {
        state.selectedSectionIndex = sectionIndex;
        renderSidebar();
        const select = document.getElementById("newHostSection");
        if (select) select.value = String(sectionIndex);
        document.getElementById("newHostName")?.focus();
    }

    // Bookmarks from Chrome/Edge typically provide text/uri-list and text/html;
    // Firefox can also provide text/x-moz-url (URL followed by the title).
    // Only inspect the payload in a drop handler: browsers block getData during dragover.
    function isExternalBookmarkDrag(event) {
        if (state.drag || !event.dataTransfer) return false;
        const types = Array.from(event.dataTransfer.types || []);
        if (types.includes("Files")) return false;
        return ["text/uri-list", "text/x-moz-url", "text/plain", "text/html"].some(type => types.includes(type));
    }

    function normalizedBookmarkUrl(raw) {
        if (typeof raw !== "string") return null;
        const value = raw.trim();
        if (!value || value.length > 300 || /[\u0000-\u001f\u007f<>"']/.test(value)) return null;
        try {
            const url = new URL(value);
            if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
            return url.href;
        } catch (_) { return null; }
    }

    function bookmarkFromDrop(dataTransfer) {
        if (!dataTransfer) return null;
        const get = type => {
            try { return String(dataTransfer.getData(type) || "").slice(0, 8192); }
            catch (_) { return ""; }
        };
        let url = "", title = "";
        const moz = get("text/x-moz-url").split(/\r?\n/);
        if (moz.length > 1 && normalizedBookmarkUrl(moz[0])) {
            url = moz[0];
            title = moz.slice(1).join(" ");
        }
        if (!url) {
            url = get("text/uri-list").split(/\r?\n/).map(x => x.trim())
                .find(x => x && !x.startsWith("#") && normalizedBookmarkUrl(x)) || "";
        }
        // HTML provides the human-readable bookmark title in many browsers.
        const html = get("text/html");
        if (html) {
            // Parsing into an inert template prevents bookmark HTML from becoming live DOM.
            const template = document.createElement("template");
            template.innerHTML = html;
            const anchor = template.content.querySelector("a[href]");
            if (anchor) {
                if (!url) url = anchor.getAttribute("href") || "";
                if (!title) title = anchor.textContent || "";
            }
        }
        const plain = get("text/plain");
        if (!url && plain) {
            const lines = plain.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
            url = lines.find(x => normalizedBookmarkUrl(x)) || "";
            if (!title) title = lines.find(x => x !== url) || "";
        }
        const safeUrl = normalizedBookmarkUrl(url);
        if (!safeUrl) return null;
        const hostname = new URL(safeUrl).hostname.replace(/^www\./i, "");
        const fallback = hostname.includes(".") && !/^[\d.]+$/.test(hostname)
            ? hostname.split(".")[0].replace(/[-_]/g, " ") : hostname;
        title = String(title || fallback.replace(/\b[a-z]/g, c => c.toUpperCase())).replace(/\s+/g, " ").trim().slice(0, 100);
        return { url: safeUrl, title: title || hostname };
    }

    function suggestedBookmarkIcon(bookmark) {
        const text = `${new URL(bookmark.url).hostname} ${bookmark.title}`.toLowerCase();
        const names = [
            ["proxmox-backup-server", /\b(?:pbs|proxmox[ -]?backup)\b/],
            ["proxmox", /\bproxmox\b/], ["jellyfin", /\bjellyfin\b/],
            ["docker", /\bdocker\b/], ["synology", /\bsynology\b/],
            ["checkmk", /\bcheckmk\b/], ["uptime-kuma", /\buptime[ .-]?kuma\b/],
            ["portainer", /\bportainer\b/], ["home-assistant", /\bhome[ .-]?assistant\b/],
            ["grafana", /\bgrafana\b/], ["unifi", /\bunifi\b/],
            ["github", /\bgithub\b/], ["truenas", /\btruenas\b/]
        ];
        const match = names.find(([, pattern]) => pattern.test(text));
        return match ? `di:${match[0]}` : "🌐";
    }

    function findBookmarkDuplicate(url) {
        const normal = normalizedBookmarkUrl(url);
        if (!normal) return null;
        for (const section of state.config.sections) {
            for (const item of section.items) {
                if (normalizedBookmarkUrl(item.url) === normal) return { section: section.title, name: item.name };
            }
        }
        return null;
    }

    function clearDropHighlights() {
        elements.dashboard.querySelectorAll(".bookmark-drop-active, .drag-over")
            .forEach(element => element.classList.remove("bookmark-drop-active", "drag-over"));
    }

    function openBookmarkImportModal(sectionIndex, bookmark) {
        if (!state.editMode || !state.authenticated || !state.config.sections[sectionIndex]) return;
        const content = document.createElement("div");
        content.className = "bookmark-import-modal";
        content.innerHTML = `
            <div class="modal-header">
                <div>
                    <h2 class="modal-title">Add Bookmark</h2>
                    <p class="modal-subtitle">Review the bookmark before adding it to the dashboard.</p>
                </div>
                <button class="modal-close" type="button" aria-label="Close">×</button>
            </div>
            <div class="modal-grid">
                <form id="bookmarkHostForm" novalidate></form>
                <aside class="bookmark-import-aside">
                    <h3>Live Preview</h3><div id="bookmarkHostPreview" class="preview-card"></div>
                    <h3>Icon Picker</h3><div id="bookmarkIconPicker"></div>
                </aside>
            </div>
        `;
        const form = content.querySelector("#bookmarkHostForm");
        form.append(createSelectField("Section", "bookmarkSectionIndex", state.config.sections.map((section, index) =>
            ({ value: String(index), label: section.title })), String(sectionIndex)));
        form.append(createInputField("Name", "bookmarkHostName", "Bookmark name", bookmark.title));
        form.append(createInputField("URL / IP", "bookmarkHostUrl", "https://example.com", bookmark.url));
        form.append(createTextAreaField("Description (optional)", "bookmarkHostDescription", "Short description"));
        const icon = suggestedBookmarkIcon(bookmark);
        form.append(createSelectField("Icon", "bookmarkHostIcon", iconOptions(ALL_ICONS, icon), icon));
        const duplicateWarning = document.createElement("p");
        duplicateWarning.className = "bookmark-duplicate-warning";
        duplicateWarning.setAttribute("role", "status");
        form.append(duplicateWarning);
        const duplicateChoice = createCheckboxField("Add even if this URL already exists", "bookmarkAllowDuplicate", false);
        duplicateChoice.classList.add("bookmark-duplicate-choice");
        form.append(duplicateChoice);
        const advanced = document.createElement("details");
        advanced.className = "bookmark-advanced";
        const summary = document.createElement("summary");
        summary.textContent = "Advanced: ID and health checks";
        advanced.append(summary);
        advanced.append(createInputField("ID (unique)", "bookmarkHostId", "e.g. my-new-host", uniqueHostId(slugify(bookmark.title))));
        appendCheckFields(advanced, "bookmarkHost");
        advanced.append(createCheckboxField("Invert status", "bookmarkHostInvert", false));
        form.append(advanced);
        const actions = document.createElement("div");
        actions.className = "form-actions";
        actions.append(createButton("Cancel", "button button-secondary", closeModal));
        actions.append(createButton("Add Bookmark", "button button-success", null, "submit"));
        form.append(actions);
        const preview = content.querySelector("#bookmarkHostPreview");
        content.querySelector("#bookmarkIconPicker").append(mountIconPicker(form.querySelector("#bookmarkHostIcon"), update));
        function update() {
            updateHostPreview(form, preview);
            const duplicate = findBookmarkDuplicate(form.querySelector("#bookmarkHostUrl").value);
            duplicateWarning.hidden = !duplicate;
            duplicateChoice.hidden = !duplicate;
            duplicateWarning.textContent = duplicate ? `This URL already exists as “${duplicate.name}” in “${duplicate.section}”.` : "";
            if (!duplicate) duplicateChoice.querySelector("input").checked = false;
        }
        form.addEventListener("input", update);
        form.addEventListener("change", update);
        form.querySelector("#bookmarkHostName").addEventListener("input", () => {
            const id = form.querySelector("#bookmarkHostId");
            if (!id.dataset.touched) id.value = uniqueHostId(slugify(form.querySelector("#bookmarkHostName").value));
        });
        form.querySelector("#bookmarkHostId").addEventListener("input", event => { event.target.dataset.touched = "true"; });
        form.addEventListener("submit", async event => {
            event.preventDefault();
            if (!state.editMode || !state.authenticated) return;
            const targetIndex = Number(form.querySelector("#bookmarkSectionIndex").value);
            if (!Number.isInteger(targetIndex) || !state.config.sections[targetIndex]) {
                notify("warning", "Invalid section", "Choose a valid section.");
                return;
            }
            const data = readHostForm(form);
            const safeUrl = normalizedBookmarkUrl(data.url);
            if (!safeUrl) {
                notify("warning", "Invalid bookmark URL", "Only HTTP(S) links without embedded passwords are accepted.");
                return;
            }
            data.url = safeUrl;
            const error = validateHost(data);
            if (error) return notify("warning", "Validation failed", error);
            if (findBookmarkDuplicate(data.url) && !form.querySelector("#bookmarkAllowDuplicate").checked) {
                return notify("warning", "Duplicate bookmark", "This URL is already saved. Confirm the duplicate to add it again.");
            }
            const saved = await mutateAndSave(() => {
                state.config.sections[targetIndex].items.push(data);
                state.selectedSectionIndex = targetIndex;
            }, "Bookmark added");
            if (saved) closeModal();
        });
        openModal(content);
        content.querySelector(".modal-close").addEventListener("click", closeModal);
        update();
        form.querySelector("#bookmarkHostName").focus();
    }

    function handleSectionDragOver(event) {
        if (state.drag?.type === "section") {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            event.currentTarget.classList.add("drag-over");
        } else if (isExternalBookmarkDrag(event)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            event.currentTarget.classList.add("bookmark-drop-active");
        }
    }

    function handleSectionDrop(event, targetSectionIndex) {
        if (state.drag?.type === "section") {
            event.preventDefault();
            event.currentTarget.classList.remove("drag-over");
            const from = state.drag.fromSectionIndex;
            state.drag = null;
            if (from === targetSectionIndex) return;
            mutateAndSave(() => {
                const [section] = state.config.sections.splice(from, 1);
                const to = from < targetSectionIndex ? targetSectionIndex - 1 : targetSectionIndex;
                state.config.sections.splice(to, 0, section);
            }, "Section order saved");
            return;
        }
        if (!state.editMode || !state.authenticated || !isExternalBookmarkDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        clearDropHighlights();
        const bookmark = bookmarkFromDrop(event.dataTransfer);
        if (!bookmark) {
            notify("warning", "Unsupported bookmark", "Drop a valid HTTP or HTTPS link without embedded credentials.");
            return;
        }
        openBookmarkImportModal(targetSectionIndex, bookmark);
    }

    function handleHostGridDragOver(event) {
        if (state.drag?.type !== "host") return;
        event.preventDefault();
        event.currentTarget.classList.add("drag-over");
    }

    function handleHostGridDrop(event, targetSectionIndex) {
        if (state.drag?.type !== "host") return;
        event.preventDefault();
        event.currentTarget.classList.remove("drag-over");
        const targetIndex = state.config.sections[targetSectionIndex].items.length;
        moveHostAndSave(targetSectionIndex, targetIndex);
    }

    function handleHostCardDragOver(event) {
        if (state.drag?.type !== "host") return;
        event.preventDefault();
        event.currentTarget.classList.add("drag-over");
    }

    function handleHostCardDrop(event, targetSectionIndex, targetItemIndex) {
        if (state.drag?.type !== "host") return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove("drag-over");
        moveHostAndSave(targetSectionIndex, targetItemIndex);
    }

    function handleDragLeave(event) {
        if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
        event.currentTarget.classList.remove("drag-over", "bookmark-drop-active");
    }

    function moveHostAndSave(targetSectionIndex, targetItemIndex) {
        const drag = state.drag;
        state.drag = null;
        if (!drag || drag.type !== "host") return;
        if (drag.fromSectionIndex === targetSectionIndex && drag.fromItemIndex === targetItemIndex) return;
        mutateAndSave(() => {
            const [host] = state.config.sections[drag.fromSectionIndex].items.splice(drag.fromItemIndex, 1);
            let insertIndex = targetItemIndex;
            if (drag.fromSectionIndex === targetSectionIndex && drag.fromItemIndex < targetItemIndex) {
                insertIndex -= 1;
            }
            state.config.sections[targetSectionIndex].items.splice(insertIndex, 0, host);
            state.selectedSectionIndex = targetSectionIndex;
        }, "Host order saved");
    }

    async function createBackup() {
        try {
            const result = await apiFetch("/api/backup", { method: "POST" });
            await loadBackups();
            notify("info", "Backup Created", result.name || "Backup saved.");
            render();
        } catch (error) {
            notify("error", "Backup failed", error.message);
        }
    }

    function exportConfig() {
        const blob = new Blob([JSON.stringify(state.config, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "config.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        notify("info", "Export Complete", "config.json has been downloaded.");
    }

    async function importConfigFile(file, message) {
        try {
            const text = await file.text();
            const imported = JSON.parse(text);
            await mutateAndSave(() => {
                state.config = normalizeConfig(imported);
            }, message || "Configuration imported");
        } catch (error) {
            notify("error", "Import failed", error.message);
        }
    }

    function downloadBackup(name) {
        window.open(`/api/backup/${encodeURIComponent(name)}`, "_blank", "noopener");
    }

    function confirmRestoreBackup(name) {
        // Preview validates the backup before allowing the restore.
        previewBackup(name);
    }

    function confirmDeleteBackup(name) {
        openConfirmModal({
            title: "Delete Backup",
            message: `Delete backup ${name}?`,
            confirmText: "Delete",
            danger: true,
            onConfirm: async () => {
                try {
                    await apiFetch(`/api/backup/${encodeURIComponent(name)}`, { method: "DELETE" });
                    await loadBackups();
                    notify("success", "Backup deleted", name);
                    openBackupsModal();
                } catch (error) {
                    notify("error", "Delete failed", error.message);
                }
            }
        });
    }

    async function saveSecuritySettings(form) {
        const currentPassword = form.querySelector("#currentPassword").value;
        const newPassword = form.querySelector("#newPassword").value;
        const confirmPassword = form.querySelector("#confirmPassword").value;
        const sessionTimeoutMinutes = Number(form.querySelector("#sessionTimeout").value);
        const privateView = form.querySelector("#privateView").checked;

        if (newPassword && newPassword !== confirmPassword) {
            return notify("warning", "Password mismatch", "New password and confirmation do not match.");
        }
        if (newPassword && newPassword.length < 10) {
            return notify("warning", "Weak password", "Use at least 10 characters.");
        }

        try {
            state.security = await apiFetch("/api/security", {
                method: "POST",
                body: { currentPassword, newPassword, sessionTimeoutMinutes, privateView }
            });
            form.reset();
            form.querySelector("#sessionTimeout").value = String(state.security.sessionTimeoutMinutes || 30);
            form.querySelector("#privateView").checked = Boolean(state.security.privateView);
            state.privateView = Boolean(state.security.privateView);
            notify("success", "Security saved", "Edit mode security settings were updated.");
        } catch (error) {
            notify("error", "Security update failed", error.message);
        }
    }

    function notify(type, title, message) {
        const entry = { type, title, message, timestamp: Date.now() };
        state.notifications.unshift(entry);
        state.notifications = state.notifications.slice(0, 8);

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        const content = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = title;
        const paragraph = document.createElement("p");
        paragraph.textContent = message || "";
        content.append(strong, paragraph);
        const close = document.createElement("button");
        close.className = "toast-close";
        close.type = "button";
        close.textContent = "×";
        close.addEventListener("click", () => toast.remove());
        toast.append(content, close);
        elements.toastContainer.appendChild(toast);
        window.setTimeout(() => toast.remove(), 5200);

        if (state.editMode) renderEditPanels();
    }

    function showFatalError(error) {
        elements.dashboard.innerHTML = "";
        const box = document.createElement("div");
        box.className = "empty-state";
        box.textContent = `Could not load dashboard: ${error.message}`;
        elements.dashboard.appendChild(box);
    }

    function toggleTheme() {
        state.theme = state.theme === "dark" ? "light" : "dark";
        localStorage.setItem("dashboard-theme", state.theme);
        applyTheme();
        render();
    }

    function applyTheme() {
        document.body.classList.toggle("light-theme", state.theme === "light");
    }

    function safeHref(target) {
        const value = String(target || "").trim();
        if (/^https?:\/\//i.test(value)) return value;
        if (!value || /[\s<>"']/g.test(value)) return "#";
        return `http://${value}`;
    }

    function isValidTarget(target) {
        const value = String(target || "").trim();
        if (value.length < 1 || value.length > 300 || /[\u0000-\u001f<>"']/g.test(value)) return false;
        if (/^https?:\/\//i.test(value)) {
            try {
                const parsed = new URL(value);
                return ["http:", "https:"].includes(parsed.protocol);
            } catch (_) {
                return false;
            }
        }
        return /^[a-zA-Z0-9_.-]+$/.test(value);
    }

    function getAllHostIds() {
        return state.config.sections.flatMap((section) => section.items.map((item) => item.id));
    }

    function uniqueHostId(base) {
        const existing = new Set(getAllHostIds());
        let candidate = base || "host";
        let index = 2;
        while (existing.has(candidate)) {
            candidate = `${base}-${index}`;
            index += 1;
        }
        return candidate;
    }

    function uniqueSectionId(base) {
        const existing = new Set(state.config.sections.map((section) => section.id));
        let candidate = base || "section";
        let index = 2;
        while (existing.has(candidate)) {
            candidate = `${base}-${index}`;
            index += 1;
        }
        return candidate;
    }

    function generateUniqueHostId(name) {
        return uniqueHostId(slugify(name));
    }

    function generateUniqueSectionId(name) {
        return uniqueSectionId(slugify(name));
    }

    function slugify(value) {
        return String(value || "item")
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48) || "item";
    }

    function deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, "&#096;");
    }

    function withAlpha(hex, alpha) {
        const value = hex.replace("#", "");
        const r = parseInt(value.substring(0, 2), 16);
        const g = parseInt(value.substring(2, 4), 16);
        const b = parseInt(value.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) return "0 B";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    function formatBackupTime(value) {
        if (!value) return "unknown";
        return new Date(value).toLocaleString("en-GB");
    }
})();
