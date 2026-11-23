/*
 * Builds one CSS file per page: src/<page>.css -> css/<page>.css
 * (files in src/partials/ are shared pieces and are not built on their own).
 *
 *   node scripts/build-css.js            build + format with Prettier
 *   node scripts/build-css.js --watch    rebuild while you edit
 */
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");

const watch = process.argv.includes("--watch");

// A page entry must start Tailwind with: @import "tailwindcss" ...
// Other .css files left in src/ (old or partial files) are skipped instead of
// breaking the whole build.
const pages = [];
for (const file of fs.readdirSync("src").filter((f) => f.endsWith(".css"))) {
  const source = fs.readFileSync(`src/${file}`, "utf8");
  if (/@import\s+["']tailwindcss["']/.test(source)) {
    pages.push(file.replace(/\.css$/, ""));
  } else {
    console.warn(
      `Skipping src/${file}: no @import "tailwindcss" (not a page entry). ` +
        "Shared pieces belong in src/partials/ - delete this file if it is an old copy.",
    );
  }
}

function tailwindArgs(page) {
  const args = [
    "tailwindcss",
    "-i",
    `./src/${page}.css`,
    "-o",
    `./css/${page}.css`,
  ];
  if (watch) args.push("--watch");
  return args;
}

if (watch) {
  pages.forEach((page) => {
    spawn("npx", tailwindArgs(page), { stdio: "inherit", shell: true });
  });
} else {
  for (const page of pages) {
    const result = spawnSync("npx", tailwindArgs(page), {
      stdio: "inherit",
      shell: true,
    });
    if (result.status !== 0) {
      console.error(`Failed to build src/${page}.css`);
      process.exit(result.status || 1);
    }
  }
  // Tailwind output is formatted with Prettier so it stays readable
  spawnSync("npx", ["prettier", "--write", "css"], {
    stdio: "inherit",
    shell: true,
  });
}
