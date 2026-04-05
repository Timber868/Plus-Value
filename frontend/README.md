# Le Onze Comptable — Frontend

The Angular frontend for **Le Onze Comptable**, a Ligue 1 club finance and transfer intelligence web app.

Built with Angular 19, TypeScript, and SCSS.

## Getting Started

### Prerequisites

- Node.js (check `.nvmrc` or `package.json` engines if specified)
- Angular CLI: `npm install -g @angular/cli`

### Install Dependencies
```bash
cd frontend
npm install
```

### Development Server
```bash
ng serve
```

Navigate to `http://localhost:4200/`. The app reloads automatically on file changes.

API requests prefixed with `/api` are proxied to the backend at `http://localhost:3000` via `proxy.conf.json`. Make sure the backend is running before testing any API calls.

## Build
```bash
ng build
```

Build artifacts are output to `dist/`.

## Testing
```bash
ng test
```

Runs unit tests with [Karma](https://karma-runner.github.io).

## Project Structure