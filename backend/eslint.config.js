const js = require("@eslint/js");
const globals = require("globals");
const pluginSecurity = require("eslint-plugin-security");
module.exports = [
  js.configs.recommended,
  pluginSecurity.configs.recommended,
  {
    ignores: [
      "scratch/**",
      "tmp_clear.js",
      "node_modules/**"
    ]
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.es2021
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "off",
      "no-debugger": "error"
    },
  },
];
