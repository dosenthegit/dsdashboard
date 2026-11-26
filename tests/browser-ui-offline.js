"use strict";
// Browser UI test that runs entirely inside a blank Chrome document; useful when
// corporate Chrome policies forbid navigating to 127.0.0.1/localhost.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const { Cdp, chromeBinary, freePort, waitUntil, sleep } = require("./browser-smoke");

async function main() {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dsdashboard-ui-offline-"));
    const port = await freePort();
    const browser = spawn(chromeBinary(), ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
    let cdp;
    try {
        const page = await waitUntil(async () => {
            const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            return pages.find(p => p.type === "page" && p.webSocketDebuggerUrl);
        }, "offline browser start");
        cdp = new Cdp(new WebSocket(page.webSocketDebuggerUrl));
        await cdp.connect();
        await cdp.call("Runtime.enable");
        await cdp.call("Page.enable");
        const frame = (await cdp.call("Page.getFrameTree")).frameTree.frame.id;
        const root = path.resolve(__dirname, "..");
        let html = fs.readFileSync(path.join(root, "site/index.html"), "utf8");
        html = html.replace('<link rel="stylesheet" href="style.css">', "").replace('<script src="app.js"></script>', "");
        await cdp.call("Page.setDocumentContent", { frameId: frame, html });
        const mock = String.raw`(() => {
            const data = new Map();
            Object.defineProperty(window, 'localStorage', { configurable: true, value: {
                getItem: k => data.get(k) ?? null,
                setItem: (k,v) => { data.set(k,String(v)); },
                removeItem: k => data.delete(k)
            }});
            window.__mockApi = {
                authenticated: false, privateView: false, csrfToken: 'example-csrf',
                config: { sections: [{ id: 'servers', title: 'Servers', icon: '🖥️', color: 'blue', items: [
                    { id:'proxmox', name:'Proxmox VE', url:'https://example.com', icon:'di:proxmox', checkType:'http', tlsWarnDays: 30 },
                    { id:'docker', name:'Docker', url:'https://example.org', icon:'🐳', checkType:'http', tlsWarnDays: 30 }
                ] }] },
                status: { _meta: {checkedAt:new Date().toISOString()}, _details: {
                    proxmox: {state:'online',responseMs:52,message:'HTTP 200'},
                    docker: {state:'offline',responseMs:81,message:'HTTP 503'}
                } },
                history: {proxmox: {'24h':{samples:4,uptime:100,avgResponseMs:52},'7d':{samples:4,uptime:100,avgResponseMs:52},'30d':{samples:4,uptime:100,avgResponseMs:52},hourly:[]}}
            };
            window.fetch = async (url, opts = {}) => {
                const m = window.__mockApi;
                const pathname = String(url).split('?')[0];
                let body = {}; let status = 200;
                if (pathname === '/api/session') body = {authenticated:m.authenticated,privateView:m.privateView,csrfToken:m.authenticated?m.csrfToken:null};
                else if (pathname === '/api/config') body = {config:m.config};
                else if (pathname === '/api/status') body = {status:m.status};
                else if (pathname === '/api/history') body = {history:m.history};
                else if (pathname === '/api/security' && opts.method === 'POST') {
                    m.privateView=JSON.parse(opts.body).privateView; body={privateView:m.privateView,sessionTimeoutMinutes:30};
                } else if (pathname === '/api/security') body={privateView:m.privateView,sessionTimeoutMinutes:30};
                else if (pathname === '/api/backups') body={backups:[],retentionLimit:100};
                else if (pathname === '/api/login') {m.authenticated=true;body={csrfToken:m.csrfToken,authenticated:true};}
                else if (pathname === '/api/logout') {m.authenticated=false;body={success:true};}
                else if (pathname === '/api/save-config') {m.config=JSON.parse(opts.body);body={config:m.config,success:true};}
                else if (pathname === '/api/icon-catalog') body={icons:Array.from({length:130},(_,i)=>'icon-'+i),formats:{}};
                else {body={error:'Unknown mock route '+pathname};status=404;}
                return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
            };
        })();`;
        await cdp.eval(mock);
        const appScript = fs.readFileSync(path.join(root, "site/app.js"), "utf8");
        await cdp.call("Runtime.evaluate", { expression: appScript, awaitPromise: false });
        await cdp.eval(`document.dispatchEvent(new Event('DOMContentLoaded'))`);
        await waitUntil(async () => cdp.eval(`document.querySelector('#servicesCount')?.textContent === '2' && document.querySelectorAll('.service-card').length === 2`), "offline initial rendering");
        await cdp.eval(`document.querySelector('#serviceSearch').value='docker';document.querySelector('#serviceSearch').dispatchEvent(new Event('input'))`);
        assert.equal(await cdp.eval(`document.querySelectorAll('.service-card').length`),1);
        await cdp.eval(`document.querySelector('#serviceSearch').value='';document.querySelector('#serviceSearch').dispatchEvent(new Event('input'))`);
        await cdp.eval(`document.querySelector('.service-card-actions button[title="Health history"]').click()`);
        assert.equal(await cdp.eval(`document.querySelector('.history-modal')?.textContent.includes('24h:')`),true);
        await cdp.eval(`document.querySelector('.history-modal button').click()`);
        await cdp.eval(`document.querySelector('#editModeButton').click()`);
        await waitUntil(async () => cdp.eval(`!!document.querySelector('#loginForm')`), "offline login form");
        await cdp.eval(`document.querySelector('#adminPassword').value='dummy';document.querySelector('#loginForm').requestSubmit()`);
        await waitUntil(async () => cdp.eval(`document.body.classList.contains('edit-mode') && !!document.querySelector('#newHostCheckPort')`), "offline edit mode");
        await cdp.eval(`document.querySelector('.card-top-tools button[title="Edit host"]').click()`);
        await waitUntil(async () => cdp.eval(`!!document.querySelector('#editHostForm') && !!document.querySelector('.icon-browser-grid')`), "offline edit modal");
        await cdp.eval(`document.querySelector('#hostCheckType').value='tcp';document.querySelector('#hostCheckPort').value='8443';document.querySelector('#editHostForm').requestSubmit()`);
        await waitUntil(async () => cdp.eval(`document.querySelector('#modalOverlay').classList.contains('hidden')`), "offline save form");
        assert.equal(await cdp.eval(`window.__mockApi.config.sections[0].items[0].checkPort`),8443);
        assert.deepEqual(cdp.exceptions, []);
        console.log("Offline Chromium UI test passed: initial page, search, history, login, icon picker and saved checks.");
    } finally {
        if (cdp) cdp.close();
        browser.kill('SIGTERM');
        await sleep(200);
        if (browser.exitCode === null) browser.kill('SIGKILL');
        fs.rmSync(profile, {recursive:true,force:true,maxRetries:3});
    }
}
main().catch(error => { console.error(error.stack || error); process.exitCode=1; });
