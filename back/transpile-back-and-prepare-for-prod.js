const fs = require("fs");
const { execSync } = require("child_process");

const replaceInFileSync = (filePath, regex, replacement) => {
  let data = fs.readFileSync(filePath, "utf8");
  const updatedData = data.replace(regex, replacement);
  fs.writeFileSync(filePath, updatedData);
};

const useCompiledJavaScriptInPackageScripts = (packageJsonPath) => {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  packageJson.scripts = Object.fromEntries(
    Object.entries(packageJson.scripts).map(([name, script]) => [
      name,
      script
        .replace(/\btsx watch\b/g, "node")
        .replace(/\btsx\b/g, "node")
        .replace(/(\bsrc\/[^ "'\\]+)\.ts\b/g, "$1.js")
        .replace(/ -j ts/g, ""),
    ]),
  );
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
};

console.log("Remove old build");
if (fs.existsSync("./build")) fs.rmSync("./build", { recursive: true });
if (fs.existsSync("./back-build.tar.gz")) fs.unlinkSync("./back-build.tar.gz");

const version = process.argv[2];
console.log(`Transpile back and setting version ${version}`);
execSync("tsc -b --noCheck tsconfig.prod.json");
const versionJsPath = "build/back/src/scripts/version.js";
replaceInFileSync(versionJsPath, /"__VERSION__"/, `"${version}"`);

console.log("Copying package.json of root, shared and libs for prod");
fs.copyFileSync("../package.json", "build/package.json");
fs.copyFileSync("../pnpm-lock.yaml", "build/pnpm-lock.yaml");
fs.copyFileSync("../pnpm-workspace.yaml", "build/pnpm-workspace.yaml");

console.log("Copying package.json of back for prod");
fs.copyFileSync("./package.json", "build/back/package.json");

execSync("cp -v -R ./src/config/pg/static-data build/back/src/config/pg");

// Copy dependencies package.json files to build directory
fs.copyFileSync("../shared/package.json", "build/shared/package.json");
fs.copyFileSync(
  "../libs/html-templates/package.json",
  "build/libs/html-templates/package.json",
);

const removeFromFileLinesThatInclude = (filePath, regex) => {
  let data = fs.readFileSync(filePath, "utf8");
  const updatedData = data
    .split("\n")
    .filter((line) => !regex.test(line))
    .join("\n");
  fs.writeFileSync(filePath, updatedData);
};

const rootPackageJson = "build/package.json";
const htmlPackageJson = "build/libs/html-templates/package.json";
const sharedPackageJson = "build/shared/package.json";
const backPackageJson = "build/back/package.json";

// remove prepare from root package.json
removeFromFileLinesThatInclude(rootPackageJson, /"prepare":.*/);

// change dependencies to use js instead of ts
removeFromFileLinesThatInclude(htmlPackageJson, /"types": "src\/index.ts",?/);
replaceInFileSync(
  htmlPackageJson,
  /"main": "src\/index.ts"/,
  '"main": "src/index.js"',
);
removeFromFileLinesThatInclude(sharedPackageJson, /"types": "src\/index.ts",?/);
replaceInFileSync(
  sharedPackageJson,
  /"main": "src\/index.ts"/,
  '"main": "src/index.js"',
);

// change tsx scripts to compiled JavaScript scripts
useCompiledJavaScriptInPackageScripts(backPackageJson);
execSync("cp -r -v scalingo/. build/");

console.log("Making tar.gz from transpiled code");
fs.chmodSync("build", 0o755);
execSync("tar -czf back-build.tar.gz build");
