# Tasks

## 1. Metadata and shell

- [x] 1.1 Add shared backoffice navigation, permission, route and title metadata; verify all existing merchant/admin paths remain present.
- [x] 1.2 Update `BackofficeShell` and `Merchant.js` to consume the shared metadata and shell slots; verify JavaScript syntax and component route wiring.

## 2. Targeted verification

- [x] 2.1 Run UI regression and Node request race tests; verify all selected checks pass without changing API behavior.
- [x] 2.2 Run `git diff --check` and `openspec validate frontend-shell-metadata-refactor --strict`; verify the diff is limited to frontend shell structure and metadata.
