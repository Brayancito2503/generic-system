# Feature-Based Architecture

This project follows a strict **Feature-Based Architecture** aligned with **CQRS** principles.

## Structure Rule
Every feature must follow this folder structure:

```text
src/features/<feature-name>/
├── api/         # Axios definitions (Pure transport layer)
├── components/  # Feature-specific UI components
├── hooks/       # CQRS Hooks (The only valid way to access data)
│   ├── use<Feature>Queries.ts   # Read Operations (GET)
│   └── use<Feature>Mutations.ts # Write Operations (POST, PUT, DELETE)
├── types/       # Feature-specific TypeScript interfaces/types
└── index.ts     # Public API (Exports what other features can see)
```

## Guidelines

1.  **Do NOT import from `api/*` directly in Components.** Always use `hooks/*`.
2.  **Strict Typing:** All API calls must be typed. `Axios` response is automatically unwrapped by the interceptor, so `api` functions return `Promise<T>`.
3.  **Encapsulation:** If a component is only used within this feature, keep it in `components/`. If it's shared, move to `src/components/ui` or `src/components/shared`.
