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
        // Bookmark drag/drop must be unavailable in view mode and only active after login.
        await cdp.eval(`document.querySelector('#toolbarExitButton').click()`);
        assert.equal(await cdp.eval(`document.querySelector('.bookmark-drop-zone') === null`), true);
        await cdp.eval(`document.querySelector('#editModeButton').click()`);
        await waitUntil(async () => cdp.eval(`document.body.classList.contains('edit-mode')`), "return to edit mode");
        assert.equal(await cdp.eval(`document.querySelectorAll('.bookmark-drop-zone').length`), 1);

        // Chrome/Edge: URI list + HTML link title, dropped on a card (bubbles to section).
        await cdp.eval(String.raw`(() => {
            const transfer = new DataTransfer();
            transfer.setData('text/uri-list', 'https://admin.example.net/ui');
            transfer.setData('text/html', '<a href="https://admin.example.net/ui">My Router</a>');
            const card = document.querySelector('.service-card');
            card.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
            card.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        })()`);
        assert.equal(await cdp.eval(`document.querySelector('#bookmarkHostForm #bookmarkHostName')?.value`), 'My Router');
        assert.equal(await cdp.eval(`document.querySelector('#bookmarkHostForm #bookmarkHostUrl')?.value`), 'https://admin.example.net/ui');
        assert.equal(await cdp.eval(`document.querySelector('#bookmarkSectionIndex')?.value`), '0');
        assert.equal(await cdp.eval(`document.querySelector('#bookmarkDuplicateWarning') === null`), true);
        await cdp.eval(`document.querySelector('#bookmarkHostForm').requestSubmit()`);
        await waitUntil(async () => cdp.eval(`window.__mockApi.config.sections[0].items.length === 3 && document.querySelector('#modalOverlay').classList.contains('hidden')`), "bookmark saved");
        assert.equal(await cdp.eval(`window.__mockApi.config.sections[0].items[2].url`), 'https://admin.example.net/ui');

        // Firefox: text/x-moz-url, including its bookmark title. Duplicates require opt-in.
        await cdp.eval(String.raw`(() => {
            const transfer = new DataTransfer();
            transfer.setData('text/x-moz-url', 'https://admin.example.net/ui\nSecond Router');
            document.querySelector('.dashboard-section').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        })()`);
        assert.equal(await cdp.eval(`document.querySelector('#bookmarkHostForm #bookmarkHostName')?.value`), 'Second Router');
        assert.equal(await cdp.eval(`document.querySelector('.bookmark-duplicate-warning')?.hidden`), false);
        await cdp.eval(`document.querySelector('#bookmarkHostForm').requestSubmit()`);
        assert.equal(await cdp.eval(`window.__mockApi.config.sections[0].items.length`), 3);
        await cdp.eval(`document.querySelector('#bookmarkAllowDuplicate').checked=true; document.querySelector('#bookmarkHostForm').requestSubmit()`);
        await waitUntil(async () => cdp.eval(`window.__mockApi.config.sections[0].items.length === 4 && document.querySelector('#modalOverlay').classList.contains('hidden')`), "confirmed duplicate saved");

        // Bad schemes and embedded credentials are rejected without opening an import modal.
        for (const href of ['javascript:alert(1)', 'https://user:secret@example.net/']) {
            await cdp.eval(`(() => {
                const transfer = new DataTransfer();
                transfer.setData('text/uri-list', ${JSON.stringify(href)});
                document.querySelector('.dashboard-section').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
            })()`);
            assert.equal(await cdp.eval(`document.querySelector('#bookmarkHostForm') === null`), true);
            assert.equal(await cdp.eval(`window.__mockApi.config.sections[0].items.length`), 4);
        }

        // Internal host move must continue to work and must not open bookmark import.
        await cdp.eval(String.raw`(() => {
            const transfer = new DataTransfer();
            const handle = document.querySelector('.service-card[data-item-index="0"] .card-drag-handle');
            handle.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
            document.querySelector('.services-grid').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
            handle.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        })()`);
        await waitUntil(async () => cdp.eval(`window.__mockApi.config.sections[0].items[3].id === 'proxmox'`), "internal host reorder");
        assert.equal(await cdp.eval(`document.querySelector('#bookmarkHostForm') === null`), true);

        // Explicit section targeting and plain-text links without supplied titles.
        await cdp.eval(`(() => {
            const field = document.querySelector('#sideNewSectionTitle');
            field.value = 'Network';
            field.closest('form').requestSubmit();
        })()`);
        await waitUntil(async () => cdp.eval(`window.__mockApi.config.sections.length === 2 && document.querySelectorAll('.bookmark-drop-zone').length === 2`), "second section created");
        await cdp.eval(String.raw`(() => {
            const transfer = new DataTransfer();
            transfer.setData('text/plain', 'https://network.example.net/console');
            const second = document.querySelectorAll('.dashboard-section')[1];
            second.dispatchEvent(new DragEvent('dragover', {bubbles:true,cancelable:true,dataTransfer:transfer}));
            second.dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true,dataTransfer:transfer}));
        })()`);
        assert.equal(await cdp.eval(`document.querySelector('#bookmarkSectionIndex')?.value`), '1');
        assert.equal(await cdp.eval(`document.querySelector('#bookmarkHostName')?.value`), 'Network');
        await cdp.eval(`document.querySelector('#bookmarkHostForm').requestSubmit()`);
        await waitUntil(async () => cdp.eval(`window.__mockApi.config.sections[1].items.length === 1 && document.querySelector('#modalOverlay').classList.contains('hidden')`), "bookmark saved to targeted section");
        assert.equal(await cdp.eval(`window.__mockApi.config.sections[1].items[0].url`), 'https://network.example.net/console');

        // Existing section reordering must still use the internal drag type.
        await cdp.eval(String.raw`(() => {
            const transfer = new DataTransfer();
            const sections = document.querySelectorAll('.dashboard-section');
            const handle = sections[1].querySelector('.section-heading .drag-handle');
            handle.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
            sections[0].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
            handle.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        })()`);
        await waitUntil(async () => cdp.eval(`window.__mockApi.config.sections[0].title === 'Network'`), "internal section reorder");
        assert.equal(await cdp.eval(`document.querySelector('#bookmarkHostForm') === null`), true);

        assert.deepEqual(cdp.exceptions, []);
        console.log("Offline Chromium UI test passed: initial UI, edit mode, bookmark imports, duplicates, unsafe URL rejection and existing host/section drag/drop.");
    } finally {
        if (cdp) cdp.close();
        browser.kill('SIGTERM');
        await sleep(200);
        if (browser.exitCode === null) browser.kill('SIGKILL');
        fs.rmSync(profile, {recursive:true,force:true,maxRetries:3});
    }
}
main().catch(error => { console.error(error.stack || error); process.exitCode=1; });
