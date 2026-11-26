"use strict";
// Dependency-free health checks. Invoked by start.sh; also exportable for tests.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const { execFile } = require("node:child_process");

const CONFIG_PATH = process.env.CONFIG_PATH || "/site/config.json";
const STATUS_PATH = process.env.STATUS_PATH || "/site/status.json";
const HISTORY_PATH = process.env.HISTORY_PATH || "/data/status-history.json";
const TIMEOUT_MS = Math.max(1000, Math.min(30000, Number(process.env.STATUS_TIMEOUT || 5) * 1000));
const INSECURE_TLS = process.env.STATUS_INSECURE_TLS === "true";
const KEEP_HOURS = 24 * 31;

function atomicJson(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
    try {
        fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
        fs.renameSync(tmp, file);
    } finally { try { fs.unlinkSync(tmp); } catch (_) { /* already renamed */ } }
}
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { return fallback; } }
function checkerType(item) {
    const chosen = item.checkType || "auto";
    if (["http", "tcp", "icmp"].includes(chosen)) return chosen;
    return /^https?:\/\//i.test(item.url || "") ? "http" : "icmp";
}
function targetHost(target) {
    if (/^https?:\/\//i.test(target)) return new URL(target).hostname;
    if (!/^[a-zA-Z0-9_.:-]+$/.test(target) || target.startsWith("-")) throw new Error("Invalid check host");
    return target;
}
function httpCheck(item, timeoutMs = TIMEOUT_MS) {
    return new Promise(resolve => {
        const started = Date.now();
        let url;
        try {
            url = new URL(item.url);
            if (!["http:", "https:"].includes(url.protocol)) throw new Error("HTTP check needs an http(s) URL");
            if (item.checkPath) url.pathname = item.checkPath;
        } catch (err) { resolve({ state: "unknown", message: err.message }); return; }
        const transport = url.protocol === "https:" ? https : http;
        const req = transport.get(url, { timeout: timeoutMs, rejectUnauthorized: !INSECURE_TLS, headers: { "User-Agent": "DSdashboard/4.0", "Accept": "*/*" } }, response => {
            const duration = Date.now() - started;
            const code = response.statusCode || 0;
            const wanted = Number(item.expectedStatus || 0);
            const ok = wanted ? code === wanted : code >= 200 && code <= 399;
            let state = ok ? "online" : "offline";
            const warnResponseMs = Number(item.warnResponseMs || 0);
            if (ok && warnResponseMs > 0 && duration > warnResponseMs) state = "warning";
            const result = { state, responseMs: duration, statusCode: code, message: `HTTP ${code}` };
            if (url.protocol === "https:" && response.socket && typeof response.socket.getPeerCertificate === "function") {
                const cert = response.socket.getPeerCertificate();
                if (cert && cert.valid_to) {
                    const expiry = Date.parse(cert.valid_to);
                    if (Number.isFinite(expiry)) {
                        result.tlsExpiresAt = new Date(expiry).toISOString();
                        result.tlsDaysRemaining = Math.ceil((expiry - Date.now()) / 86400000);
                        if (expiry <= Date.now()) result.state = "offline";
                        else if (ok && result.tlsDaysRemaining <= Number(item.tlsWarnDays ?? 30)) result.state = "warning";
                    }
                }
            }
            response.resume();
            resolve(result);
        });
        req.on("timeout", () => req.destroy(new Error("HTTP timeout")));
        req.on("error", err => resolve({ state: "offline", responseMs: Date.now() - started, message: `HTTP: ${err.message}`.slice(0, 160) }));
    });
}
function tcpCheck(item, timeoutMs = TIMEOUT_MS) {
    return new Promise(resolve => {
        const started = Date.now();
        let host, port;
        try {
            host = targetHost(item.url);
            const fromUrl = /^https?:\/\//i.test(item.url) ? new URL(item.url) : null;
            port = Number(item.checkPort || fromUrl?.port || (fromUrl?.protocol === "https:" ? 443 : 80));
            if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid TCP port");
        } catch (error) { resolve({ state: "unknown", message: error.message }); return; }
        const socket = net.createConnection({ host, port });
        let finished = false;
        function finish(state, message) {
            if (finished) return;
            finished = true;
            socket.destroy();
            const responseMs = Date.now() - started;
            resolve({ state: state === "online" && item.warnResponseMs > 0 && responseMs > item.warnResponseMs ? "warning" : state, responseMs, message });
        }
        socket.setTimeout(timeoutMs);
        socket.once("connect", () => finish("online", `TCP ${port} open`));
        socket.once("timeout", () => finish("offline", "TCP timeout"));
        socket.once("error", e => finish("offline", `TCP: ${e.message}`.slice(0, 160)));
    });
}
function icmpCheck(item, timeoutMs = TIMEOUT_MS) {
    return new Promise(resolve => {
        const started = Date.now();
        let host;
        try { host = targetHost(item.url); } catch (e) { resolve({ state: "unknown", message: e.message }); return; }
        // execFile avoids shell expansion. '--' prevents option injection via hostnames.
        execFile("ping", ["-n", "-c", "1", "-W", String(Math.ceil(timeoutMs / 1000)), "--", host], { timeout: timeoutMs + 1000 }, (error, stdout, stderr) => {
            const responseMs = Date.now() - started;
            if (error && error.code === "ENOENT") { resolve({ state: "unknown", message: "Ping binary unavailable" }); return; }
            const state = error ? "offline" : (item.warnResponseMs > 0 && responseMs > item.warnResponseMs ? "warning" : "online");
            resolve({ state, responseMs, message: error ? (stderr.trim() || "ICMP unavailable").slice(0, 160) : "ICMP reachable" });
        });
    });
}
async function checkItem(item) {
    const checkedAt = new Date().toISOString();
    const checkType = checkerType(item);
    if (item.maintenance) return { state: "maintenance", checkedAt, checkType, message: "Maintenance mode" };
    try {
        const check = checkType === "http" ? httpCheck : checkType === "tcp" ? tcpCheck : icmpCheck;
        const result = await check(item);
        // Inversion swaps only clear reachable/unreachable results (not warnings/unknown).
        if (item.invertStatus) {
            if (result.state === "online") result.state = "offline";
            else if (result.state === "offline") result.state = "online";
        }
        return { ...result, checkedAt, checkType };
    } catch (error) { return { state: "unknown", checkedAt, checkType, message: String(error.message || error).slice(0, 160) }; }
}
function updateHistory(old, details, now = new Date()) {
    const history = old && typeof old === "object" && old.services && typeof old.services === "object" ? old : { version: 1, services: {} };
    const hour = now.toISOString().slice(0, 13) + ":00:00.000Z";
    const cutoff = new Date(now.getTime() - KEEP_HOURS * 3600000).toISOString();
    for (const [id, value] of Object.entries(details)) {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) continue;
        const list = Array.isArray(history.services[id]) ? history.services[id] : [];
        const row = list.at(-1)?.hour === hour ? list.at(-1) : { hour, total: 0, up: 0, warn: 0, down: 0, responseTotal: 0, responseSamples: 0 };
        if (row !== list.at(-1)) list.push(row);
        if (["online", "warning", "offline"].includes(value.state)) {
            row.total++;
            if (value.state === "online") row.up++;
            if (value.state === "warning") row.warn++;
            if (value.state === "offline") row.down++;
        }
        if (Number.isFinite(value.responseMs)) { row.responseTotal += value.responseMs; row.responseSamples++; }
        history.services[id] = list.filter(item => item.hour >= cutoff).slice(-KEEP_HOURS);
    }
    // Keep bounded history and drop unconfigured IDs (after rename/deletion).
    for (const id of Object.keys(history.services)) if (!Object.hasOwn(details, id)) delete history.services[id];
    return history;
}
function historySummary(history) {
    const periods = { "24h": 24, "7d": 168, "30d": 720 };
    const result = {};
    const now = Date.now();
    for (const [id, rows] of Object.entries(history.services || {})) {
        const summary = {};
        for (const [label, hours] of Object.entries(periods)) {
            const relevant = (Array.isArray(rows) ? rows : []).filter(row => Date.parse(row.hour) >= now - hours * 3600000);
            const total = relevant.reduce((s, r) => s + r.total, 0);
            const up = relevant.reduce((s, r) => s + r.up, 0);
            const responseSamples = relevant.reduce((s, r) => s + (r.responseSamples || 0), 0);
            const responseTotal = relevant.reduce((s, r) => s + (r.responseTotal || 0), 0);
            summary[label] = { samples: total, uptime: total ? Math.round(up / total * 10000) / 100 : null, avgResponseMs: responseSamples ? Math.round(responseTotal / responseSamples) : null };
        }
        // Fixed-width 24 hourly bars; absent hours are explicitly Unknown.
        const recent = Object.fromEntries((Array.isArray(rows) ? rows : []).map(r => [r.hour, r]));
        summary.hourly = Array.from({ length: 24 }, (_, index) => {
            const hour = new Date(Math.floor(now / 3600000) * 3600000 - (23 - index) * 3600000).toISOString();
            const row = recent[hour];
            const uptime = row?.total ? Math.round(row.up / row.total * 10000) / 100 : null;
            const state = !row?.total ? "unknown" : row.down ? "offline" : row.warn ? "warning" : "online";
            return { hour, uptime, state };
        });
        result[id] = summary;
    }
    return result;
}
async function run() {
    const config = readJson(CONFIG_PATH, { sections: [] });
    const items = Array.isArray(config.sections) ? config.sections.flatMap(s => Array.isArray(s.items) ? s.items : []) : [];
    const details = {};
    // Small worker pool limits simultaneous I/O and avoids overloading network equipment.
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(items.length, 12) }, async () => {
        while (index < items.length) {
            const item = items[index++];
            if (!item || !/^[A-Za-z0-9_-]{1,64}$/.test(item.id) || !item.url) continue;
            details[item.id] = await checkItem(item);
        }
    }));
    const checkedAt = new Date().toISOString();
    const status = { _meta: { checkedAt, version: 2 }, _details: details };
    for (const [id, detail] of Object.entries(details)) status[id] = detail.state === "online" || detail.state === "warning";
    atomicJson(STATUS_PATH, status);
    const history = updateHistory(readJson(HISTORY_PATH, { version: 1, services: {} }), details);
    atomicJson(HISTORY_PATH, history);
    return { checkedAt, checked: Object.keys(details).length };
}
if (require.main === module) run().then(value => console.log(`Status checked ${value.checked} services at ${value.checkedAt}`)).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { httpCheck, tcpCheck, icmpCheck, checkItem, updateHistory, historySummary, run };
