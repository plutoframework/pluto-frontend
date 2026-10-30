import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = mkdtempSync(join(tmpdir(), "pluto-actions-example-"));

try {
  execFileSync(
    join(root, "node_modules/.bin/tsc"),
    [
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--strict",
      "--skipLibCheck",
      "--rootDir",
      root,
      "--outDir",
      output,
      "examples/actions/main.ts",
    ],
    { cwd: root, stdio: "inherit" },
  );
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  execFileSync(process.execPath, [join(output, "examples/actions/main.js")], {
    stdio: "inherit",
  });
} finally {
  rmSync(output, { recursive: true, force: true });
}
