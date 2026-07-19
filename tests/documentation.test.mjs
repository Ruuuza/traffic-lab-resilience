import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredFiles = [
  "../README.md",
  "../docs/architecture/overview.md",
  "../docs/diagrams/system.md",
  "../docs/decisions/0001-client-side-simulation.md",
  "../docs/grooming/technical-grooming-report.md",
  "../docs/runbooks/validation.md",
  "../docs/troubleshooting/common-issues.md",
];

test("ships the required technical documentation", async () => {
  const documents = await Promise.all(requiredFiles.map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const document of documents) assert.ok(document.trim().length > 100);
  assert.match(documents[0], /docs\/screenshots\/traffic-lab-desktop\.jpg/);
  assert.match(documents[2], /```mermaid/);
});

test("ships real JPEG screenshot evidence", async () => {
  for (const name of ["traffic-lab-desktop.jpg", "steady-state-simulator.jpg", "traffic-lab-mobile.jpg"]) {
    const image = await readFile(new URL(`../docs/screenshots/${name}`, import.meta.url));
    assert.deepEqual([...image.subarray(0, 3)], [255, 216, 255]);
    assert.ok(image.length > 20_000);
  }
});
