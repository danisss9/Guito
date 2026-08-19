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

## FAQs

No FAQs for now. (⌐■_■)
