# Introduction

dossier

## Run

> Run the website with make
> `make run`

## Structure

`apps/website` — Public marketing website (React Router v7, port 3000)

## Tech Stack

### Frameworks

- [React Router v7](https://reactrouter.com/) – Full-stack React framework (formerly Remix).

### Platforms

- [Fly.io](https://fly.io/) – Application deployment. Every push to `main` deploys once checks pass.

### UI

- [Arc UI](https://uiarc.dev/) – shadcn-compatible React components and blocks with motion built in.
- [Tailwind CSS v4](https://tailwindcss.com/) – Utility-first CSS framework.
- [Shadcn UI](https://ui.shadcn.com/) – Radix-based component primitives.
- [Motion](https://motion.dev/) – Animation library used by Arc.

### State & Data

- [TanStack Query v5](https://tanstack.com/query/latest/) – Server-state management
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) – Form handling and validation
