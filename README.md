# GymBot AI Server

The server that handles the ChatGPT API for the GymBot AI app.

## Development

You'll need Node.js v18 and PNPM.

Then, clone this repository. Install dependencies:

```sh
pnpm i
```

After that, to build the TypeScript source code into JavaScript:
```sh
./node_modules/.bin/esbuild --outdir=dist src/index.ts && ln -fs "../src/prompt.json" dist
```

Then, to run the server:
```sh
node dist/index.js
```

**Note:** remember to format your code by running `pnpm format` before pushing,
to keep our code and commits tidy.
