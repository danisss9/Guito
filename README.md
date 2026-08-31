# Guito

**G**u**IT**o ([**GUI**to](https://dicionario.priberam.org/guito)) is a free and simple git client.

## Table of Contents

- [Guito](#guito)
  - [Table of Contents](#table-of-contents)
  - [Install](#install)
  - [Use](#use)
  - [Arguments](#arguments)
  - [Changelog](#changelog)
  - [FAQs](#faqs)

## Install

```cmd
npm install -g guito
```

Guito is also available as a Visual Studio Code extension. After installing it from the
Marketplace, select **Guito** in the status bar to open the current workspace repository.

## Use

Run the following command on the folder where you git repository is:

```cmd
npx guito
```

## Arguments

| Argument          | Description                                |
| ----------------- | ------------------------------------------ |
| `--port <number>` | Port to serve the UI on (default: `8080`). |
| `--no-open`       | Do not open the browser automatically.     |

## Changelog

**Version 0.5:**

- added a Visual Studio Code extension with local and remote workspace support
- added automated npm and Visual Studio Marketplace publishing

**Version 0.4:**

- rebuilt the UI with Angular
- added commit graph visualization
- added branch filtering and remote branch toggle
- added commit search
- added commit diff viewer

**Version 0.3:**

- added more git functionalities

**Version 0.2:**

- added header and table components

**Version 0.1:**

- published library

## Development

Install the dependencies and build everything:

```cmd
npm install
npm run build
npm start
```

To develop the UI with hot reload, run the API server and the Angular dev server in separate terminals:

```cmd
npm run dev:server
```

```cmd
npm run dev
```

The UI dev server proxies `/api` requests to the API server.

### Release publishing

Stable GitHub Releases tagged `vX.Y.Z` publish the matching npm package and VS Code
extension through `.github/workflows/release.yml`. Before the first release, configure
GitHub Actions as the trusted publisher for both `guito` on npm and the `danisss9`
Visual Studio Marketplace publisher, using the exact workflow filename `release.yml`.

## FAQs

No FAQs for now. (⌐■_■)
