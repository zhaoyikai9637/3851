// Flat ESLint configuration using only ESLint core (no plugins), so it runs with
// `npx eslint .` without changing the locked dependency tree.
export default [
  {
    ignores: ["**/node_modules/**", "**/dist/assets/**", "**/coverage/**", "JRS Login and profile/integrations/**"],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: "readonly", document: "readonly", location: "readonly", localStorage: "readonly",
        sessionStorage: "readonly", fetch: "readonly", console: "readonly", process: "readonly",
        URL: "readonly", URLSearchParams: "readonly", setTimeout: "readonly", clearTimeout: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true }],
      "no-undef": "off",
      "no-debugger": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "eqeqeq": ["warn", "smart"],
      "max-len": ["warn", { code: 160, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreRegExpLiterals: true }],
      "max-statements-per-line": ["warn", { max: 2 }],
    },
  },
];
