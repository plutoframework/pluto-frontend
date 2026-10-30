import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Inputs are passed as environment values and argument arrays, never shell code.
const tag = process.env.RELEASE_TAG;
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  throw new Error("Release requires a stable vMAJOR.MINOR.PATCH tag");
}
if (manifest.name !== "@plutoframework/frontend") {
  throw new Error("Unexpected package name");
}
if (tag !== `v${manifest.version}`) {
  throw new Error("Release tag and package.json version must match");
}
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
if (git("rev-parse", "HEAD") !== git("rev-parse", `${tag}^{commit}`)) {
  throw new Error("Checkout does not match release tag");
}
git("merge-base", "--is-ancestor", "HEAD", "origin/main");
console.log(`Validated ${manifest.name}@${manifest.version} from ${tag}`);
