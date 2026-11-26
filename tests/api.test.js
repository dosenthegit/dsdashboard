"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { spawn } = require("node:child_process");

async function freePort() {
    const server = net.createServer();
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    const port = server.address().port;
    await new Promise(r => server.close(r));
    return port;
}
async function wait(url) {
    for (let i = 0; i < 80; i++) {
        try { const response = await fetch(url); if (response.ok) return; }
        catch (_) { /* starting */ }
        await new Promise(r => setTimeout(r, 60));
    }
    throw new Error(`Server didn't start: ${url}`);
}
test("HTTP API: read-only public, opt-in private, secure saves, backups and preview", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsdashboard-api-"));
    const site = path.join(dir, "site"); const data = path.join(dir, "data");
    fs.mkdirSync(site, { recursive: true });
    const config = { sections: [{ id: "network", title: "Network", icon: "🌐", color: "blue", items: [{ id: "switch", name: "Local switch", url: "127.0.0.1", icon: "🌐", checkType: "icmp", maintenance: false }] }] };
    fs.writeFileSync(path.join(site, "config.json"), JSON.stringify(config));
    const port = await freePort();
    const child = spawn(process.execPath, ["server.js"], {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, PORT: String(port), SITE_DIR: site, DATA_DIR: data, DASHBOARD_ADMIN_PASSWORD: "test-password-very-strong-123", BACKUP_MAX_FILES: "5" },
        stdio: "pipe"
    });
    const base = `http://127.0.0.1:${port}`;
    let stderr = "";
    child.stderr.on("data", chunk => stderr += chunk);
    try {
        await wait(base + "/api/health");
        const request = async (url, method = "GET", body, headers = {}) => {
            const response = await fetch(base + url, { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
            return { status: response.status, headers: response.headers, body: await response.json() };
        };
        assert.equal((await request("/api/config")).body.config.sections[0].items[0].name, "Local switch");
        assert.equal((await request("/api/history")).status, 200);
        assert.equal((await request("/api/health")).status, 200);
        const login = await request("/api/login", "POST", { password: "test-password-very-strong-123" });
        assert.equal(login.status, 200);
        const cookie = login.headers.get("set-cookie").split(";")[0];
        const csrf = login.body.csrfToken;
        const auth = { Cookie: cookie, "X-CSRF-Token": csrf };
        const saved = JSON.parse(JSON.stringify(config));
        saved.sections[0].items[0] = { ...saved.sections[0].items[0], checkType: "tcp", checkPort: 443, warnResponseMs: 1000, tlsWarnDays: 30, expectedStatus: 0, checkPath: "" };
        saved.sections[0].items[0].icon = "di:proxmox-backup-server";
        const update = await request("/api/save-config", "POST", saved, auth);
        assert.equal(update.status, 200, JSON.stringify(update.body));
        assert.equal(update.body.config.sections[0].items[0].checkPort, 443);
        assert.equal(update.body.config.sections[0].items[0].icon, "di:proxmox-backup-server");
        const invalid = await request("/api/save-config", "POST", { sections: [{ id: "invalid", title: "Bad", items: [{ id: "x", name: "X", url: "http://localhost", checkPort: 65536 }] }] }, auth);
        assert.equal(invalid.status, 400);
        const backup = await request("/api/backup", "POST", {}, auth);
        assert.equal(backup.status, 200);
        const preview = await request(`/api/backup/${backup.body.name}/preview`, "GET", undefined, auth);
        assert.equal(preview.status, 200);
        assert.equal(preview.body.backup.services, 1);
        for (let i = 0; i < 7; i++) assert.equal((await request("/api/backup", "POST", {}, auth)).status, 200);
        const backupsAfter = await request("/api/backups", "GET", undefined, auth);
        assert.equal(backupsAfter.body.backups.length, 5, "retention should cap backup count");
        const cachedIcon = path.join(data, "icon-cache", "proxmox.svg");
        fs.writeFileSync(cachedIcon, '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
        const cachedRes = await fetch(base + "/icons/proxmox.svg");
        assert.equal(cachedRes.status, 200);
        assert.equal(cachedRes.headers.get("content-type"), "image/svg+xml; charset=utf-8");
        assert.match(await cachedRes.text(), /<svg/);
        const security = await request("/api/security", "POST", { privateView: true }, auth);
        assert.equal(security.status, 200);
        assert.equal(security.body.privateView, true);
        assert.equal((await request("/api/config")).status, 401);
        assert.equal((await request("/api/status")).status, 401);
        assert.equal((await request("/api/history")).status, 401);
        assert.equal((await request("/api/config", "GET", undefined, auth)).status, 200);
        assert.equal((await request("/api/health")).status, 200);
        assert.equal((await request("/api/session")).body.privateView, true);
        assert.equal((await request("/api/icon-catalog")).status, 401);
        assert.equal((await request("/api/restore", "POST", { name: "../../evil" }, auth)).status, 404);
        // Persisted security and configured services survive restart.
        assert.ok(fs.existsSync(path.join(data, "security.json")));
        assert.equal(JSON.parse(fs.readFileSync(path.join(site, "config.json"))).sections.length, 1);
    } finally {
        child.kill("SIGTERM");
        await new Promise(r => { if (child.exitCode !== null) r(); else { child.once("exit", r); setTimeout(r, 2500); } });
        fs.rmSync(dir, { recursive: true, force: true });
        assert.equal(stderr, "", stderr);
    }
});
