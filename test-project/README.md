# Test Project

Simple test project that uses a vulnerable version of lodash (4.17.15) which is vulnerable to CVE-2021-23337.

## Setup

```bash
yarn install
# or
npm install
```

This will generate `yarn.lock` or `package-lock.json` with lodash@4.17.15 and its transitive dependencies.

## Purpose

This project is used to test the SCA agent's ability to:
1. Analyze lock files (yarn.lock or package-lock.json)
2. Detect vulnerable packages in the dependency tree
3. Identify transitive dependencies

## Vulnerable Package

- **Package**: lodash
- **Installed Version**: 4.17.15
- **Vulnerable Versions**: <4.17.21
- **CVE**: CVE-2021-23337
- **Severity**: HIGH

