import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", String(Date.now()));
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Traffic Lab product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Traffic Lab/);
  assert.match(html, /Projete para o pico/);
  assert.match(html, /TRAFFIC/);
  assert.match(html, /Rate limiting/);
  assert.match(html, /Backpressure/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("keeps simulation controls and metadata in source", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /token.*sliding.*fixed.*leaky/s);
  assert.match(page, /least.*round.*weighted.*hash/s);
  assert.match(page, /circuitBreaker/);
  assert.match(page, /adaptiveLimit/);
  assert.match(layout, /\/og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
