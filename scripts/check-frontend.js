// Catch DOM-to-JavaScript mismatches and missing feature wiring before publishing.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const js = fs.readFileSync(path.join(root, "site/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "site/index.html"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "status-checker.js"), "utf8");
const found = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x => x[1]));
const binder = js.match(/function bindElements\(\)\s*\{([\s\S]*?)\n    \}/)?.[1] || "";
const missing = [...new Set([...binder.matchAll(/document\.getElementById\(["']([^"']+)["']\)/g)].map(x => x[1]))].filter(id => !found.has(id));
if (missing.length) throw Error(`Missing HTML elements referenced by bindElements(): ${missing.join(", ")}`);
for (const token of ["mountIconPicker(", "iconSelectOptions(", "setIcon(icon, section.icon", "setIcon(icon, item.icon", "createIconNode(item.icon", "loadDashboardIconCatalog()", "DASHBOARD_ICON_INDEX_URL = \"/api/icon-catalog\"", "getItemDetail(", "loadHistory(", "openHistoryModal(", "appendCheckFields(", "favoriteButton("]) {
    if (!js.includes(token)) throw Error(`Missing frontend integration: ${token}`);
}
for (const token of ["serveDashboardIcon(", "/api/history", "/api/icon-catalog", "/api/health", "privateView", "BACKUP_MAX_FILES"]) {
    if (!server.includes(token)) throw Error(`Missing server integration: ${token}`);
}
if (!worker.includes("updateHistory(")) throw Error("Status history worker is missing");
console.log("Frontend DOM bindings, icons, status, history and privacy integration passed.");
