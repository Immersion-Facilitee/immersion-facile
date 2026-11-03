process.env.TZ = "Europe/Paris";

module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.(m?[jt]sx?)$": ["@swc/jest"],
  },
  transformIgnorePatterns: [
    "node_modules\\/(?!(.pnpm|@|parse5|uuid|shared-routes))",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "mjs"],
  moduleNameMapper: {
    "^shared$": "<rootDir>/../shared/src/index.ts",
  },
};
