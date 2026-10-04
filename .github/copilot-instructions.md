Before writing code, designing architecture, or modifying infrastructure, you MUST review the relevant Markdown files located in the `.agents/skills/` directory.

These skills are the single source of truth for the CricScore repository and govern:

- Frontend architecture and dynamic state propagation
- Backend database pooling and event-driven architecture
- Agentic RAG, MCP tool execution, and pgvector embeddings
- Strict AWS Free-Tier cost governance (no NAT gateways, etc.)
- Security standards and secrets management
- CI/CD workflow rules and mandatory local validations
- MLOps and testing standards
- Cheatsheet maintenance and documentation accuracy

Ensure your generated code strictly adheres to the boundaries and standard practices defined in those files.
