# Test Forum Server

Simple HTTP server that serves test vulnerability articles for SCA agent testing.

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

The server will start on `http://localhost:3001`

## Endpoints

- `GET /article/vulnerability` - Returns HTML article about lodash vulnerability (CVE-2021-23337)
- `GET /health` - Health check endpoint

## Test Article

The test article contains information about:
- Package: lodash
- CVE ID: CVE-2021-23337
- Severity: HIGH
- Affected versions: <4.17.21

This article will be used to test the SCA agent's forum scraping and vulnerability extraction capabilities.

