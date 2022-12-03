module.exports = {
  "$schema": "http://json.schemastore.org/prettierrc",
  "arrowParens": "always",
  "bracketSameLine": false,
  "bracketSpacing": true,
  "embeddedLanguageFormatting": "auto",
  "endOfLine": "lf",
  "printWidth": 100,
  "proseWrap": "always",
  "semi": true,
  "singleAttributePerLine": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "useTabs": false,
  "overrides": [
    {
      "files": [
        "*.json",
        "*.yml",
        "*.yaml"
      ],
      "options": {
        "useTabs": false
      }
    },
    {
      "files": [
        "*.json"
      ],
      "options": {
        "parser": "json-stringify"
      }
    },
    {
      "files": [
        "*.mdx",
      ],
    }
  ]
};
