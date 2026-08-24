module.exports = {
  testEnvironment: "node",
  transform: {
   "^.+\\.(m?[jt]sx?)$": ["@swc/jest"],
  },
  transformIgnorePatterns: [
    "node_modules\\/(?!(.pnpm|@|parse5|uuid|nanoid))"
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "mjs"],
};
