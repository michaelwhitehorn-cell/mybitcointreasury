#!/usr/bin/env node
// Builds or refreshes data/btc-daily.json: BTC/USD daily closes (UTC), oldest first.
//
// Usage (from the repository root, Node 18 or later):
//   node scripts/update-btc-data.mjs               fetch from the Coin Metrics Community API
//   node scripts/update-btc-data.mjs --csv FILE    read a local CSV instead (header: date,close)
//
// CSV format: one row per UTC day, date as YYYY-MM-DD, close as a plain number in USD,
// e.g. "2026-11-15,64900.12". Rows may be in any order; rows already in the file are ignored.
//
// The script is idempotent: it only appends days after the last date already in the file,
// never rewrites existing rows, and leaves the file untouched when there is nothing new.
// It refuses to write if the merged series has a gap, a duplicate or a non-numeric close.
// Today's (unfinished) UTC day is never written.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/btc-daily.json');
const START = '2010-07-18';
const API = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';
const API_SOURCE = 'Coin Metrics Community API (BTC PriceUSD, daily)';
const DAY = 86400000;

const fail = msg => { console.error('update-btc-data: ' + msg); process.exit(1); };
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
const dayMs = d => Date.parse(d + 'T00:00:00Z');

async function loadExisting() {
  try {
    const json = JSON.parse(await readFile(OUT, 'utf8'));
    if (!Array.isArray(json.data)) fail(OUT + ' has no "data" array');
    return json;
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    fail('could not read ' + OUT + ': ' + e.message);
  }
}

async function fromApi(startDay) {
  const rows = [];
  let url = API + '?assets=btc&metrics=PriceUSD&frequency=1d&page_size=10000&start_time=' + startDay;
  while (url) {
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      fail('could not reach Coin Metrics (' + (e.cause && e.cause.code || e.message) + '). Use --csv FILE instead.');
    }
    if (!res.ok) fail('Coin Metrics request failed: HTTP ' + res.status + ' for ' + url);
    const body = await res.json();
    for (const r of body.data || []) rows.push({ date: String(r.time).slice(0, 10), close: Number(r.PriceUSD) });
    url = body.next_page_url || null;
  }
  return rows;
}

async function fromCsv(path) {
  const text = await readFile(resolve(process.cwd(), path), 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  const header = lines.shift().split(',').map(h => h.trim().toLowerCase());
  const di = header.indexOf('date'), ci = header.indexOf('close');
  if (di < 0 || ci < 0) fail('CSV header must contain "date" and "close" columns');
  return lines.map(l => {
    const cells = l.split(',');
    return { date: cells[di].trim(), close: Number(cells[ci].trim()) };
  });
}

function validate(data) {
  for (let i = 0; i < data.length; i++) {
    const { date, close } = data[i];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isoDay(dayMs(date)) !== date) fail('bad date "' + date + '" at row ' + i);
    if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0) fail('non-numeric or non-positive close on ' + date);
    if (i > 0 && dayMs(date) - dayMs(data[i - 1].date) !== DAY) {
      fail('gap or duplicate between ' + data[i - 1].date + ' and ' + date);
    }
  }
}

const args = process.argv.slice(2);
const csvIdx = args.indexOf('--csv');
const csvPath = csvIdx >= 0 ? args[csvIdx + 1] : null;
if (csvIdx >= 0 && !csvPath) fail('--csv needs a file path');

const existing = await loadExisting();
const have = existing ? existing.data : [];
if (have.length) validate(have);
const lastDay = have.length ? have[have.length - 1].date : null;
const startDay = lastDay ? isoDay(dayMs(lastDay) + DAY) : START;
const today = isoDay(Date.now());

const incoming = csvPath ? await fromCsv(csvPath) : await fromApi(startDay);
const fresh = incoming
  .filter(r => r.date >= startDay && r.date < today)
  .sort((a, b) => (a.date < b.date ? -1 : 1));

if (!fresh.length) {
  console.log('update-btc-data: no new days after ' + (lastDay || START) + '; file unchanged.');
  process.exit(0);
}

const data = have.concat(fresh.map(r => ({ date: r.date, close: Math.round(r.close * 100) / 100 })));
if (!lastDay && data[0].date !== START && !csvPath) fail('API series starts on ' + data[0].date + ', expected ' + START);
validate(data);

const out = {
  updated: new Date().toISOString(),
  source: csvPath ? (existing && existing.source) || 'Local CSV import' : API_SOURCE,
  data,
};
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{') + '\n');
console.log('update-btc-data: appended ' + fresh.length + ' day(s), ' + fresh[0].date + ' to ' + data[data.length - 1].date + '; ' + data.length + ' days in file.');
