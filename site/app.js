(() => {
    "use strict";

    const REFRESH_INTERVAL_MS = 30000;

    const ICONS = [
        "🖥️", "💾", "📈", "🐳", "📶", "🔐", "🔀", "🧠", "🚨", "📦", "🖨️", "🎬", "🌍", "☁️", "🛡️", "🔑",
        "🏠", "⭐", "📁", "🧰", "🧪", "⚙️", "📡", "🗄️", "🧱", "📊", "🔔", "🔌", "📱", "💡", "🟣", "🟢"
    ];

    const SECTION_ICONS = ["▦", "🖥️", "🌐", "🛡️", "📦", "🎬", "⭐", "☁️", "⚙️", "📁", "📡", "🔐"];
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
        editMode: false,
        authenticated: false,
        csrfToken: null,
        security: null,
        backups: [],
        notifications: [],
        drag: null,
        selectedSectionIndex: 0,
        theme: localStorage.getItem("dashboard-theme") || "dark",
        collapsedSections: new Set(JSON.parse(localStorage.getItem("dashboard-collapsed-sections") || "[]"))
    };

    const elements = {};

    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        bindElements();
        bindGlobalEvents();
        applyTheme();

        try {
            await Promise.all([refreshSession(), loadConfig(), loadStatus()]);
            if (state.authenticated) {
                await loadSecurity();
                await loadBackups();
            }
            render();
        } catch (error) {
            showFatalError(error);
        }

        window.setInterval(async () => {
            try {
                await loadStatus();
                renderDashboardOnly();
            } catch (error) {
                notify("warning", "Status update failed", error.message);
            }
        }, REFRESH_INTERVAL_MS);
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
        elements.toolbarImportButton = document.getElementById("toolbarImportButton");
        elements.toolbarExportButton = document.getElementById("toolbarExportButton");
        elements.toolbarViewSiteButton = document.getElementById("toolbarViewSiteButton");
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
    }

    function bindGlobalEvents() {
        elements.editModeButton.addEventListener("click", handleEditModeButton);
        elements.toolbarExitButton.addEventListener("click", exitEditMode);
        elements.toolbarViewSiteButton.addEventListener("click", exitEditMode);
        elements.toolbarImportButton.addEventListener("click", () => elements.importFileInput.click());
        elements.toolbarExportButton.addEventListener("click", exportConfig);

        elements.modalOverlay.addEventListener("click", (event) => {
            if (event.target === elements.modalOverlay) {
                closeModal();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !elements.modalOverlay.classList.contains("hidden")) {
                closeModal();
            }
        });

        elements.importFileInput.addEventListener("change", async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
                await importConfigFile(file, "Configuration imported");
            }
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
            throw new Error(message);
        }

        return payload;
    }

    async function refreshSession() {
        const session = await apiFetch("/api/session");
        state.authenticated = Boolean(session.authenticated);
        state.csrfToken = session.csrfToken || null;
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

    async function loadSecurity() {
        if (!state.authenticated) return;
        state.security = await apiFetch("/api/security");
    }

    async function loadBackups() {
        if (!state.authenticated) return;
        const result = await apiFetch("/api/backups");
        state.backups = result.backups || [];
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
            });
        });
        return safe;
    }

    function render() {
        elements.body.classList.toggle("edit-mode", state.editMode);
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
        if (state.editMode) {
            renderEditPanels();
        }
    }

    function calculateStats() {
        let total = 0;
        let online = 0;
        let offline = 0;

        state.config.sections.forEach((section) => {
            section.items.forEach((item) => {
                total += 1;
                if (getItemStatus(item)) online += 1;
                else offline += 1;
            });
        });

        const uptime = total > 0 ? Math.round((online / total) * 100) : 0;
        return { total, online, offline, uptime };
    }

    function getItemStatus(item) {
        let isOnline = state.status[item.id] === true;
        if (item.invertStatus === true) {
            isOnline = !isOnline;
        }
        return isOnline;
    }

    function renderStats() {
        const stats = calculateStats();
        elements.servicesCount.textContent = stats.total;
        elements.onlineCount.textContent = stats.online;
        elements.offlineCount.textContent = stats.offline;
        elements.uptimePercent.textContent = `${stats.uptime}%`;
    }

    function renderFooter() {
        elements.updatedAt.textContent = `Last updated: ${new Date().toLocaleString("en-GB")}`;
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
                section.items.forEach((item, itemIndex) => {
                    grid.appendChild(createServiceCard(item, sectionIndex, itemIndex));
                });
            } else {
                grid.classList.add("hidden");
            }

            sectionElement.appendChild(grid);
            elements.dashboard.appendChild(sectionElement);
        });

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
        icon.textContent = section.icon || "▦";
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
        const isOnline = getItemStatus(item);
        const href = safeHref(item.url);
        const card = state.editMode ? document.createElement("article") : document.createElement("a");

        card.className = `service-card ${isOnline ? "" : "offline-card"}`;
        card.dataset.sectionIndex = String(sectionIndex);
        card.dataset.itemIndex = String(itemIndex);

        if (!state.editMode) {
            card.href = href;
            card.target = "_blank";
            card.rel = "noopener noreferrer";
        } else {
            card.addEventListener("dragover", handleHostCardDragOver);
            card.addEventListener("dragleave", handleDragLeave);
            card.addEventListener("drop", (event) => handleHostCardDrop(event, sectionIndex, itemIndex));

            const tools = document.createElement("div");
            tools.className = "card-top-tools";
            tools.appendChild(createIconButton("✏", "Edit host", () => openHostModal(sectionIndex, itemIndex)));
            tools.appendChild(createIconButton("🗑", "Delete host", () => confirmDeleteHost(sectionIndex, itemIndex), "button-danger"));
            card.appendChild(tools);

            const drag = document.createElement("span");
            drag.className = "drag-handle card-drag-handle";
            drag.textContent = "⋮⋮";
            drag.title = "Drag to reorder host";
            drag.draggable = true;
            drag.addEventListener("dragstart", (event) => {
                state.drag = { type: "host", fromSectionIndex: sectionIndex, fromItemIndex: itemIndex };
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", JSON.stringify(state.drag));
            });
            card.appendChild(drag);
        }

        const content = document.createElement("div");
        const icon = document.createElement("div");
        icon.className = "card-icon";
        icon.textContent = item.icon || "🌍";
        content.appendChild(icon);

        const title = document.createElement("h3");
        title.className = "card-title";
        title.textContent = item.name;
        content.appendChild(title);

        const description = document.createElement("div");
        description.className = "card-description";
        description.textContent = item.description || "";
        content.appendChild(description);
        card.appendChild(content);

        const footer = document.createElement("div");
        footer.className = "card-footer";

        const status = document.createElement("div");
        status.className = `status ${isOnline ? "status-online" : "status-offline"}`;
        const dot = document.createElement("span");
        dot.className = "status-dot";
        const text = document.createElement("span");
        text.textContent = isOnline ? "Online" : "Offline";
        status.append(dot, text);
        footer.appendChild(status);

        const arrow = document.createElement("div");
        arrow.className = "card-arrow";
        arrow.textContent = "→";
        footer.appendChild(arrow);

        card.appendChild(footer);
        return card;
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
        form.appendChild(createSelectField("Icon", "newHostIcon", ICONS.map((icon) => ({ value: icon, label: icon })), "🌍"));
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
        form.appendChild(createSelectField("Icon", "quickSectionIcon", SECTION_ICONS.map((icon) => ({ value: icon, label: icon })), section.icon || "▦"));
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
        form.appendChild(createSelectField("Icon", "sideNewSectionIcon", SECTION_ICONS.map((icon) => ({ value: icon, label: icon })), "▦"));
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
        info.textContent = "Automatic backup is enabled. Every server-side save creates a backup first.";
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
            row.innerHTML = `
                <div class="phone-service-title">${escapeHtml(item.icon || "🌍")} ${escapeHtml(item.name)}</div>
                <small class="${isOnline ? "green" : "red"}">● ${isOnline ? "Online" : "Offline"}</small>
            `;
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
            openLoginModal();
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
        notify("info", "Edit Mode Locked", "You have been logged out.");
        render();
    }

    function openLoginModal() {
        const content = document.createElement("div");
        content.innerHTML = `
            <div class="modal-header">
                <div>
                    <h2 class="modal-title">Unlock Edit Mode</h2>
                    <p class="modal-subtitle">Enter the admin password to manage the dashboard.</p>
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
                await enterEditMode();
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
                            ${ICONS.map((icon) => `<option value="${escapeAttr(icon)}" ${icon === item.icon ? "selected" : ""}>${escapeHtml(icon)}</option>`).join("")}
                        </select>
                    </div>
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
                    <div class="icon-picker-grid" id="hostIconGrid"></div>
                </aside>
            </div>
        `;
        openModal(content);
        const form = content.querySelector("#editHostForm");
        const preview = content.querySelector("#hostLivePreview");
        const iconSelect = content.querySelector("#hostIcon");
        renderIconGrid(content.querySelector("#hostIconGrid"), iconSelect, () => updateHostPreview(form, preview));
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
                        ${SECTION_ICONS.map((icon) => `<option value="${escapeAttr(icon)}" ${icon === section.icon ? "selected" : ""}>${escapeHtml(icon)}</option>`).join("")}
                    </select>
                </div>
                <div id="sectionColorMount"></div>
                <div class="form-actions">
                    <button class="button button-secondary" type="button" data-close>Cancel</button>
                    <button class="button ${isNew ? "button-primary" : "button-success"}" type="submit">${isNew ? "Create Section" : "Save Changes"}</button>
                </div>
            </form>
        `;
        openModal(content);
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
            row.appendChild(createButton("Download", "button button-secondary", () => downloadBackup(backup.name)));
            row.appendChild(createButton("Restore", "button button-success", () => confirmRestoreBackup(backup.name)));
            row.appendChild(createButton("Delete", "button button-danger", () => confirmDeleteBackup(backup.name)));
            list.appendChild(row);
        });
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

    function renderIconGrid(container, select, onSelect) {
        container.innerHTML = "";
        ICONS.forEach((icon) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `icon-choice ${select.value === icon ? "active" : ""}`;
            button.textContent = icon;
            button.addEventListener("click", () => {
                select.value = icon;
                container.querySelectorAll(".icon-choice").forEach((entry) => entry.classList.remove("active"));
                button.classList.add("active");
                onSelect();
            });
            container.appendChild(button);
        });
    }

    function readHostForm(form) {
        return {
            id: form.querySelector("#hostId, #newHostId")?.value.trim(),
            name: form.querySelector("#hostName, #newHostName")?.value.trim(),
            description: form.querySelector("#hostDescription, #newHostDescription")?.value.trim() || "",
            url: form.querySelector("#hostUrl, #newHostUrl")?.value.trim(),
            icon: form.querySelector("#hostIcon, #newHostIcon")?.value || "🌍",
            invertStatus: Boolean(form.querySelector("#hostInvert, #newHostInvert")?.checked)
        };
    }

    function updateHostPreview(form, preview) {
        const data = readHostForm(form);
        preview.innerHTML = `
            <div class="card-icon">${escapeHtml(data.icon || "🌍")}</div>
            <h3 class="card-title">${escapeHtml(data.name || "New Host")}</h3>
            <div class="card-description">${escapeHtml(data.description || "Description")}</div>
            <div class="status status-online"><span class="status-dot"></span><span>Live preview</span></div>
        `;
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
        } catch (error) {
            state.config = previous;
            render();
            notify("error", "Failed to save", error.message);
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

    function handleSectionDragOver(event) {
        if (state.drag?.type !== "section") return;
        event.preventDefault();
        event.currentTarget.classList.add("drag-over");
    }

    function handleSectionDrop(event, targetSectionIndex) {
        if (state.drag?.type !== "section") return;
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
        event.currentTarget.classList.remove("drag-over");
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
        openConfirmModal({
            title: "Restore Backup",
            message: `Restore ${name}? A backup of the current config will be created first.`,
            confirmText: "Restore",
            danger: true,
            onConfirm: async () => {
                try {
                    const result = await apiFetch("/api/restore", { method: "POST", body: { name } });
                    state.config = normalizeConfig(result.config);
                    await loadBackups();
                    notify("success", "Configuration restored", name);
                    render();
                } catch (error) {
                    notify("error", "Restore failed", error.message);
                }
            }
        });
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

        if (newPassword && newPassword !== confirmPassword) {
            return notify("warning", "Password mismatch", "New password and confirmation do not match.");
        }
        if (newPassword && newPassword.length < 10) {
            return notify("warning", "Weak password", "Use at least 10 characters.");
        }

        try {
            state.security = await apiFetch("/api/security", {
                method: "POST",
                body: { currentPassword, newPassword, sessionTimeoutMinutes }
            });
            form.reset();
            form.querySelector("#sessionTimeout").value = String(state.security.sessionTimeoutMinutes || 30);
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
