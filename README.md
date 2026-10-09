# Your Dream Builder

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploy to Netlify

This app uses Vite with TanStack Start and Nitro. It renders routes on the server and includes a server-side quotes API, so it must be deployed with Nitro's Netlify Functions preset; it is not a static-only SPA. Netlify serves the built assets from `dist/` and runs the server and API through the generated function. No SPA rewrite is needed.

Use Node.js 22.12 or newer, then verify a production build locally:

```sh
npm install
npm run build
```

The repository's `netlify.toml` configures the build command and publish directory.
