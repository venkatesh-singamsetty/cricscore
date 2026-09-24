# 📚 CricScore Documentation Hub

Welcome to the CricScore documentation directory. This folder contains all architectural, operational, and deployment documentation for the platform.

## 🏗️ Architecture & Core Concepts

- [**Architecture Overview**](./architecture.md) — High-level system design, fan-out event flow, and multi-tenant isolation.
- [**Authentication & Authorization**](./auth.md) — AWS Cognito User Pools, JWT validation, and Guest/Admin role models.
- [**API Documentation**](./api.md) — Backend HTTP & WebSocket endpoints, request/response formats.
- [**Agentic AI Architecture**](./ai_architecture.md) — How the RAG and MCP tools are integrated for the AI Chat Assistant.

## 🚀 Deployment & Infrastructure

- [**Full Deployment Guide**](./deployment.md) — Step-by-step tutorial to deploy CricScore to AWS from scratch.
- [**Terraform Infrastructure Guide & Tutorial**](./terraform_guide.md) — Comprehensive HCL architecture walkthrough and hands-on tutorial.
- [**Real-Time WebSockets & Event Fan-Out Tutorial**](./websocket_tutorial.md) — Architecture and implementation guide for live score streaming.
- [**GitHub Actions CI/CD**](./github_actions.md) — Explains the automated pipeline that runs on every push.
- [**Aiven PostgreSQL**](./aiven.md) — How to set up and manage the primary database.

## 🛡️ Operations & Security

- [**Security Posture**](./security_posture.md) — DevSecOps pipeline, automated static/dynamic scanning, and IAM strategies.
- [**Branch Protection**](./branch_protection.md) — Rules ensuring code quality and automated testing.
- [**Cost Management**](./cost_management.md) — Breakdown of the free-tier optimizations and cost analysis per AWS service.
- [**AWS Resources Dashboard**](./aws_resources_dashboard.md) — An auto-generated dashboard providing direct links to the live AWS infrastructure in the console.
- [**Observability**](./observability.md) — AWS X-Ray distributed tracing and CloudWatch monitoring.

## 🛠️ Engineering & Development

- [**Contributing & Developer Workflow**](../CONTRIBUTING.md) — Step-by-step feature branch and PR workflow guide.
- [**Testing Strategy**](./testing.md) — E2E tests via Playwright, unit tests, and security tests.
- [**Node.js Guidelines**](./nodejs_guide.md) — Best practices and configuration for the Lambda backend.
- [**Troubleshooting Log**](./troubleshooting.md) — Detailed engineering traces of bugs, race conditions, and their resolutions.
- [**Release Process**](./release_process.md) — How to cut, tag, and ship new versions of CricScore.
- [**Changelog**](./changelog.md) — History of features, fixes, and architectural changes.
