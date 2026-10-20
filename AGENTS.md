# Project instructions

- Read `ARCHITECTURE.md` before searching source or changing functionality.
- Update the architecture map when modules, entry points, dependencies, configuration or data flows change.
- Do not run tests, linters, builds, typechecks or other automated verification unless explicitly requested by the user.
- Use TypeScript and React Native components. Keep user-facing copy in Polish.
- Routes belong in `src/app/`; feature code belongs outside the route directory.
- Use `npx expo install` for new Expo/React Native dependencies to select SDK-compatible versions.
- Read Expo documentation matching the major version of `expo` in `package.json` before using Expo APIs.
- Configure native behavior in `app.json`; do not hand-edit generated `ios/` or `android/` directories.
