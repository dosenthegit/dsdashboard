"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const net = require("node:net");
const { checkItem, updateHistory, historySummary } = require("../status-checker");

function listen(server) { return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server.address().port))); }
function close(server) { return new Promise(resolve => server.close(resolve)); }

test("HTTP health check distinguishes success, 503 outage and explicit expected code", async () => {
    const server = http.createServer((req, res) => { res.writeHead(req.url === "/healthy" ? 200 : 503); res.end("done"); });
    const port = await listen(server);
    try {
        const base = { id: "test", url: `http://127.0.0.1:${port}/fail`, checkType: "http" };
        assert.equal((await checkItem({ ...base, checkPath: "/healthy" })).state, "online");
        const failed = await checkItem(base);
        assert.equal(failed.state, "offline");
        assert.equal(failed.statusCode, 503);
        const expected = await checkItem({ ...base, expectedStatus: 503 });
        assert.equal(expected.state, "online");
        assert.equal(expected.statusCode, 503);
        assert.equal((await checkItem({ ...base, maintenance: true })).state, "maintenance");
        assert.equal((await checkItem({ ...base, invertStatus: true })).state, "online");
    } finally { await close(server); }
});

test("TCP health check on open and closed local port", async () => {
    const server = net.createServer(socket => socket.end());
    const port = await listen(server);
    try {
        const result = await checkItem({ id: "tcp", url: "127.0.0.1", checkType: "tcp", checkPort: port });
        assert.equal(result.state, "online");
        assert.ok(Number.isFinite(result.responseMs));
    } finally { await close(server); }
    const unavailable = await checkItem({ id: "tcp", url: "127.0.0.1", checkType: "tcp", checkPort: port });
    assert.equal(unavailable.state, "offline");
});

test("History excludes maintenance, retains only active IDs, tracks 24h/7d/30d", () => {
    const t = new Date();
    let history = updateHistory({}, { a: { state: "online", responseMs: 45 }, b: { state: "maintenance" } }, t);
    history = updateHistory(history, { a: { state: "offline", responseMs: 110 }, b: { state: "maintenance" } }, t);
    const summary = historySummary(history);
    assert.equal(summary.a["24h"].samples, 2);
    assert.equal(summary.a["24h"].uptime, 50);
    assert.equal(summary.a["24h"].avgResponseMs, 78);
    assert.equal(summary.b["24h"].samples, 0);
    assert.equal(summary.a.hourly.length, 24);
    assert.equal(summary.a.hourly.at(-1).state, "offline");
    const truncated = updateHistory(history, { a: { state: "online" } }, t);
    assert.equal(truncated.services.b, undefined);
});

test("Worker writes detailed status and history without changing a user's config", async () => {
    const fs = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");
    const { spawn } = require("node:child_process");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsdashboard-worker-"));
    const server = http.createServer((req, res) => { res.writeHead(req.url === "/up" ? 200 : 503); res.end(); });
    const port = await listen(server);
    const configFile = path.join(tmp, "config.json");
    const statusFile = path.join(tmp, "status.json");
    const historyFile = path.join(tmp, "history.json");
    const config = { sections: [{ items: [
        { id: "one", url: `http://127.0.0.1:${port}/up` },
        { id: "two", url: `http://127.0.0.1:${port}/down` },
        { id: "three", url: "192.0.2.10", maintenance: true }
    ] }] };
    fs.writeFileSync(configFile, JSON.stringify(config));
    try {
        const child = spawn(process.execPath, [path.join(__dirname, "..", "status-checker.js")], {
            env: { ...process.env, CONFIG_PATH: configFile, STATUS_PATH: statusFile, HISTORY_PATH: historyFile }, stdio: "pipe"
        });
        let stderr = "";
        child.stderr.on("data", data => stderr += data);
        const code = await new Promise(resolve => child.on("exit", resolve));
        assert.equal(code, 0, stderr);
        const result = JSON.parse(fs.readFileSync(statusFile));
        assert.equal(result.one, true);
        assert.equal(result.two, false);
        assert.equal(result._details.two.statusCode, 503);
        assert.equal(result._details.three.state, "maintenance");
        assert.ok(fs.existsSync(historyFile));
        assert.equal(historySummary(JSON.parse(fs.readFileSync(historyFile))).one["24h"].uptime, 100);
        assert.equal(fs.readFileSync(configFile, "utf8"), JSON.stringify(config));
    } finally {
        await close(server);
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});
