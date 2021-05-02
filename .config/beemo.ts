const config =  {
    "module": "@beemo/dev",
    "drivers": {
        "babel": true,
        "eslint": {
            args: [
                '--cache-location',
                './node_modules/.cache/eslint',
                '--cache',
            ]
        },
        "jest": true,
        "prettier": true,
        "typescript"  : true,
    },
    "settings": {
        "useBuiltIns": false,
        "node": true
    }
}

export default config;