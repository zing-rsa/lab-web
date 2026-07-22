# lab-web

A showcase of my lab infrastructure, centred on an interactive [React Flow](https://reactflow.dev) diagram of the components and how they fit together. Lives at `infra.zingdev.xyz`.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 3 · bun
- `@xyflow/react` for the diagram

## Develop

```sh
bun install
bun dev            # http://localhost:3000
bun run build      # standalone production build
bun run lint
```