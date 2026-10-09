# Your Dream Builder

i wanna build something like this ?

is it possible?

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dccfdc34-5d34-4fea-a984-2ae033399f13).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

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
