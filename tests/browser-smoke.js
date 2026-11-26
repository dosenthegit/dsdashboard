"use strict";
// Zero-dependency end-to-end Chromium test through DevTools Protocol.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function freePort() {
    const socket = net.createServer();
    await new Promise(r => socket.listen(0, "127.0.0.1", r));
    const port = socket.address().port;
    await new Promise(r => socket.close(r));
    return port;
}
async function waitUntil(fn, msg, ms = 18000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (_) { /* not ready */ } await sleep(90); }
    throw new Error(`Timed out: ${msg}`);
}
function chromeBinary() {
    const choices = [process.env.CHROME_PATH, "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/opt/google/chrome/chrome"].filter(Boolean);
    const found = choices.find(p => fs.existsSync(p));
    if (!found) throw new Error("Chromium missing; set CHROME_PATH to Chrome/Chromium binary");
    return found;
}
class Cdp {
    constructor(ws) { this.ws = ws; this.id = 0; this.inflight = new Map(); this.exceptions = []; this.networkErrors = []; }
    async connect() {
        await new Promise((resolve, reject) => {
            this.ws.addEventListener("open", resolve, { once: true });
            this.ws.addEventListener("error", reject, { once: true });
        });
        this.ws.addEventListener("message", event => {
            const message = JSON.parse(event.data);
            if (message.method === "Network.loadingFailed") this.networkErrors.push(message.params);
            if (message.method === "Runtime.exceptionThrown") this.exceptions.push(message.params.exceptionDetails.text + ": " + (message.params.exceptionDetails.exception?.description || ""));
            if (!message.id) return;
            const done = this.inflight.get(message.id);
            if (!done) return;
            this.inflight.delete(message.id);
            if (message.error) done.reject(new Error(JSON.stringify(message.error)));
            else done.resolve(message.result);
        });
    }
    call(method, params = {}) {
        const id = ++this.id;
        return new Promise((resolve, reject) => {
            this.inflight.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }
    async eval(js) {
        const result = await this.call("Runtime.evaluate", { expression: js, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(`Browser expression failed: ${result.exceptionDetails.text}\n${result.exceptionDetails.exception?.description || ""}\nCode: ${js}`);
        return result.result.value;
    }
    close() { this.ws.close(); }
}
async function main() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsdashboard-browser-"));
    const site = path.join(tmp, "site"), data = path.join(tmp, "data"), profile = path.join(tmp, "profile"), publicDir = path.join(tmp, "public");
    fs.mkdirSync(site, { recursive: true });
    fs.mkdirSync(publicDir, { recursive: true });
    for (const file of ["index.html", "app.js", "style.css"]) fs.copyFileSync(path.join(__dirname, "..", "site", file), path.join(publicDir, file));
    const items = [
        { id: "proxmox", name: "Proxmox VE", icon: "🖥️", url: "https://example.com", checkType: "http" },
        { id: "docker", name: "Docker", icon: "🐳", url: "https://example.org" },
        { id: "nas", name: "Synology NAS", icon: "🗄️", url: "192.0.2.10" }
    ];
    fs.writeFileSync(path.join(site, "config.json"), JSON.stringify({ sections: [{ id: "infra", title: "Infrastructure", icon: "🖥️", color: "blue", items }] }));
    fs.writeFileSync(path.join(site, "status.json"), JSON.stringify({ _meta: { checkedAt: new Date().toISOString() }, _details: Object.fromEntries(items.map(item => [item.id, { state: item.id === "docker" ? "offline" : "online", message: "Test status", responseMs: 75 }] )) }));
    const appPort = await freePort(), chromePort = await freePort();
    const app = spawn(process.execPath, ["server.js"], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, PORT: String(appPort), DATA_DIR: data, SITE_DIR: site, PUBLIC_DIR: publicDir, DASHBOARD_ADMIN_PASSWORD: "integration-test-password-12345" }, stdio: "pipe" });
    const chrome = spawn(chromeBinary(), ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, `--remote-debugging-port=${chromePort}`, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
    let cdp;
    try {
        const url = `http://127.0.0.1:${appPort}`;
        await waitUntil(async () => (await fetch(url + "/api/health")).ok, "server readiness");
        const page = await waitUntil(async () => {
            const pages = await (await fetch(`http://127.0.0.1:${chromePort}/json/list`)).json();
            return pages.find(p => p.type === "page" && p.webSocketDebuggerUrl);
        }, "Chromium DevTools readiness");
        cdp = new Cdp(new WebSocket(page.webSocketDebuggerUrl));
        await cdp.connect();
        await cdp.call("Runtime.enable");
        await cdp.call("Page.enable");
        await cdp.call("Network.enable");
        await cdp.call("Page.navigate", { url });
        try { await waitUntil(async () => await cdp.eval(`document.querySelector('#servicesCount')?.textContent === '3' && !!document.querySelector('.service-card')`), "initial dashboard render", 7000); }
        catch (e) {
            if (cdp.networkErrors.some(entry => entry.errorText === "net::ERR_BLOCKED_BY_ADMINISTRATOR")) {
                console.error("Chromium is blocked from localhost by an administrator policy in this environment.");
            }
            console.error("Browser did not load dashboard:", await cdp.eval(`({url:location.href,title:document.title,stat:document.querySelector('#servicesCount')?.textContent,dashboard:document.querySelector('#dashboard')?.textContent,ready:document.readyState,script:document.querySelector('script')?.src})`));
            console.error("Browser page text:", await cdp.eval(`document.body?.innerText.slice(0,350)`));
            console.error("Browser loading failures:", cdp.networkErrors);
            console.error("Browser exceptions:", cdp.exceptions);
            throw e;
        }
        console.log("✓ Initial dashboard renders 3 services");
        await cdp.eval(`(() => { const el = document.querySelector('#serviceSearch'); el.value = 'Proxmox'; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        assert.equal(await cdp.eval(`document.querySelectorAll('.service-card').length`), 1);
        await cdp.eval(`(() => { const el = document.querySelector('#serviceSearch'); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await cdp.eval(`document.querySelector('.service-card-actions .favorite-button').click()`);
        await cdp.eval(`document.querySelector('#favoritesFilter').click()`);
        assert.equal(await cdp.eval(`document.querySelectorAll('.service-card').length`), 1);
        await cdp.eval(`document.querySelector('#favoritesFilter').click()`);
        await cdp.eval(`document.querySelector('#layoutMode').value='compact'; document.querySelector('#layoutMode').dispatchEvent(new Event('change', { bubbles: true }))`);
        assert.equal(await cdp.eval(`document.body.classList.contains('layout-compact')`), true);
        await cdp.eval(`document.querySelector('.service-card-actions button[title="Health history"]').click()`);
        assert.equal(await cdp.eval(`document.querySelector('.history-modal')?.textContent.includes('24h:')`), true);
        await cdp.eval(`document.querySelector('.history-modal button').click()`);
        console.log("✓ Filtering, favorites, layout and history modal");
        await cdp.eval(`document.querySelector('#editModeButton').click()`);
        await waitUntil(async () => cdp.eval(`!!document.querySelector('#loginForm')`), "login form");
        await cdp.eval(`document.querySelector('#adminPassword').value='integration-test-password-12345'; document.querySelector('#loginForm').requestSubmit()`);
        await waitUntil(async () => cdp.eval(`document.body.classList.contains('edit-mode') && !!document.querySelector('#newHostCheckType')`), "edit mode");
        assert.equal(await cdp.eval(`!!document.querySelector('#newHostTlsWarnDays') && !!document.querySelector('#newHostMaintenance')`), true);
        await cdp.eval(`document.querySelector('.card-top-tools button[title="Edit host"]').click()`);
        await waitUntil(async () => cdp.eval(`!!document.querySelector('#editHostForm') && !!document.querySelector('.icon-browser-tabs')`), "edit host modal");
        await cdp.eval(`document.querySelector('#hostCheckType').value = 'tcp'; document.querySelector('#hostCheckPort').value = '443'; document.querySelector('#editHostForm').requestSubmit()`);
        await waitUntil(async () => cdp.eval(`document.querySelector('#modalOverlay').classList.contains('hidden')`), "save host");
        const session = await cdp.eval(`fetch('/api/config').then(r=>r.json()).then(v=>v.config.sections[0].items[0].checkType)`);
        assert.equal(session, "tcp");
        await cdp.call("Page.reload", { ignoreCache: true });
        await waitUntil(async () => cdp.eval(`document.querySelector('#servicesCount')?.textContent === '3' && document.querySelectorAll('.service-card').length === 3`), "reload after saved edit");
        console.log("✓ Login, edit form, icons, save and reload");
        const response = await cdp.eval(`(async () => {
            const sess = await fetch('/api/session').then(r => r.json());
            const res = await fetch('/api/security', {method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':sess.csrfToken},body: JSON.stringify({privateView:true})});
            return res.status;
        })()`);
        assert.equal(response, 200);
        await cdp.eval(`fetch('/api/logout', { method: 'POST' })`);
        await cdp.call("Page.reload", { ignoreCache: true });
        await waitUntil(async () => cdp.eval(`!!document.querySelector('.private-view-locked')`), "private view locked after logout");
        assert.equal(await cdp.eval(`document.body.textContent.includes('Synology NAS')`), false);
        assert.equal(await cdp.eval(`fetch('/api/config').then(r=>r.status)`), 401);
        await cdp.eval(`document.querySelector('.private-view-locked button').click()`);
        await waitUntil(async () => cdp.eval(`!!document.querySelector('#loginForm')`), "private view login form");
        await cdp.eval(`document.querySelector('#adminPassword').value='integration-test-password-12345'; document.querySelector('#loginForm').requestSubmit()`);
        await waitUntil(async () => cdp.eval(`document.querySelectorAll('.service-card').length === 3 && !document.body.classList.contains('edit-mode')`), "private view unlock");
        console.log("✓ Private view, logout, reload, unlock to view-only");
        assert.deepEqual(cdp.exceptions, [], "Browser JavaScript exceptions detected: " + cdp.exceptions.join("\n"));
        console.log("✓ No uncaught browser exceptions");
    } finally {
        if (cdp) cdp.close();
        chrome.kill("SIGTERM");
        app.kill("SIGTERM");
        await sleep(350);
        if (chrome.exitCode === null) chrome.kill("SIGKILL");
        if (app.exitCode === null) app.kill("SIGKILL");
        fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 });
    }
}
if (require.main === module) main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
module.exports = { Cdp, chromeBinary, freePort, waitUntil, sleep };
