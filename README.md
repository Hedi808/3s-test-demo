# 3S — Standard Sharing Software

3S is a small full-stack JavaScript application created to test DevOps automation platforms like CloudMind.

It has:

- A Node.js backend using the built-in `node:http` module
- A frontend built with plain HTML, CSS, and JavaScript
- No external dependencies
- A public health endpoint at `/api/status`
- A simple in-memory sharing system

## Purpose

This project is intentionally simple. It is designed to test whether CloudMind can:

1. Analyze a new repository
2. Detect the language and framework/runtime
3. Detect the start command
4. Detect the port
5. Detect the health endpoint
6. Generate Docker files
7. Generate Kubernetes manifests
8. Generate Azure deployment files
9. Generate CI/CD workflow
10. Deploy the app to Azure Container Apps

## Tech Stack

- Runtime: Node.js
- Backend: Native Node.js HTTP server
- Frontend: HTML, CSS, JavaScript
- Port: `3000`
- Health path: `/api/status`
- Start command:

```bash
npm start