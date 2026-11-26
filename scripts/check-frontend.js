// Validate DOM IDs referenced by frontend event bindings to prevent blank dashboards.
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const js = fs.readFileSync(path.join(root, "site/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "site/index.html"), "utf8");
const found = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
const bindElements = js.match(/function bindElements\(\)\s*\{([\s\S]*?)\n    \}/)?.[1] || "";
const missing = [...new Set([...bindElements.matchAll(/document\.getElementById\(["']([^"']+)["']\)/g)].map(match => match[1]))].filter(id => !found.has(id));
if (missing.length) {
    console.error("Missing DOM element IDs in index.html:", missing.join(", "));
    process.exit(1);
}
console.log("Frontend DOM ID check passed.");

// Dashboard Icons regression checks: picker references and CDN CSP.
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
for (const token of ["mountIconPicker(", "iconSelectOptions(", "setIcon(icon, section.icon", "setIcon(icon, item.icon", "setIcon(preview.querySelector", "createIconNode(item.icon"]) {
    if (!js.includes(token)) {
        console.error("Dashboard Icons integration missing:", token);
        process.exit(1);
    }
}
if (!server.includes("img-src 'self' data: https://cdn.jsdelivr.net")) {
    console.error("Dashboard Icons CDN is blocked by CSP");
    process.exit(1);
}
console.log("Dashboard Icons integration checks passed.");
