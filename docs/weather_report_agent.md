# 🌦️ Cricket Match Weather Report Agent & Open-Meteo Setup Guide

CricScore includes a **Cricket Match Weather Report Specialist Agent** integrated into the AI Chat Assistant via the **Model Context Protocol (MCP)**. Players, captains, umpires, and scorers can query **live hour-by-hour match weather** or **tomorrow's / upcoming match forecasts** for any city or ground worldwide with **zero API keys required**, keeping CricScore's cloud footprint at **~$1/month** across `dev` and `prod`.

---

## 🎯 1. Open-Meteo Integration Specifications

| Capability                   | Open-Meteo Endpoint / Feature                                      | CricScore Implementation Detail                                                                                                                                                                           |
| :--------------------------- | :----------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Licensing & Cost**         | `100% Free` for non-commercial / open-source use (no API key)      | • Zero secrets or environment variables required<br/>• No paid API keys needed in `.env.local`, Terraform, or GitHub Actions                                                                              |
| **Global Geocoding**         | `GET https://geocoding-api.open-meteo.com/v1/search`               | • Resolves `"Chicago, IL"`, `"Schaumburg"`, `"Dallas, TX"`, or `"London"`<br/>• Returns exact `latitude`, `longitude`, and local IANA `timezone`                                                          |
| **City Token Fallback**      | `geocodeLocation()` in `getMatchWeather.js`                        | • If `"City, State"` returns no direct hit, automatically retries with the primary city token<br/>• Filters candidates by matching `admin1` (state) or `country`                                          |
| **Hourly Weather Telemetry** | `GET https://api.open-meteo.com/v1/forecast` (NOAA GFS/HRRR/ECMWF) | • Fetches hourly `temperature_2m` (`°F` & `°C`), `apparent_temperature`, and `relative_humidity_2m`<br/>• Fetches `precipitation_probability` (`%`), `precipitation` (`mm`), and `wind_speed_10m` (`mph`) |

---

## 💬 2. User Flows in the AI Chat Assistant

In the **AI Chat Assistant** (`ChatComponent.tsx`), users can click prompt chip **`6. "Can you check the weather report for our match?"`** or ask in natural language (`Rule 11` in `chatHandler.js` and `weather_node` in `apps/ai-service/cricscore_ai/graph.py`):

| Flow       | User Prompt Example                                                      | Tool Call Arguments                                                                     | Returned Forecast Window & Output                                                                                                     |
| :--------- | :----------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **Flow A** | _"Can you check the weather report for our match?"_ (no city provided)   | • ❌ **None** (asks user for location first)<br/>• Never guesses a city or ground       | • Prompts user: _"Could you please provide me with the city or ground where the match is taking place? Additionally, let me know..."_ |
| **Flow B** | _"What is the weather forecast for the next 4 hours in Schaumburg, IL?"_ | `get_match_weather({ location: "Schaumburg, IL", targetDate: "today", hoursAhead: 4 })` | • Current conditions at the ground<br/>• Next `4` hours hour-by-hour table<br/>• **Cricket & DLS Advisory**                           |
| **Flow C** | _"How is the weather for tomorrow's match in Chicago?"_                  | `get_match_weather({ location: "Chicago", targetDate: "tomorrow" })`                    | • Match-day daytime window (`08:00–21:00` local time)<br/>• Peak rain/wind summary<br/>• **Cricket & DLS Advisory**                   |

### Tool Input Schema (`get_match_weather`)

| Parameter    | Type                | Default   | Allowed Values & Behavior                                                                                                                      |
| :----------- | :------------------ | :-------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `location`   | `string` (required) | —         | • City, town, or venue name (e.g., `"Chicago, IL"`, `"Schaumburg"`, `"Dallas"`)                                                                |
| `targetDate` | `string` (optional) | `"today"` | • `"today"`: live match next `N` hours<br/>• `"tomorrow"`: daytime window (`08:00–21:00`)<br/>• `"YYYY-MM-DD"`: specific date up to 7 days out |
| `hoursAhead` | `number` (optional) | `6`       | • Clamped to `1–24` hours ahead when `targetDate` is `"today"`                                                                                 |

---

## 🏗️ 3. Architecture & Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Player / Scorer / Fan
    participant UI as ChatComponent.tsx
    participant APIGW as API Gateway (POST /chat)
    participant ChatAPI as chat-api Lambda (MCP Client)
    participant MCP as In-Process MCP Server (getMatchWeather.js)
    participant LLM as OpenAI / Configured LLM
    participant Geo as Open-Meteo Geocoding API
    participant Weather as Open-Meteo Forecast API

    User->>UI: Clicks "Can you check the weather report for our match?"
    UI->>APIGW: POST /chat { message }
    APIGW->>ChatAPI: Invoke chatHandler
    ChatAPI->>LLM: System Prompt (Rule 11) + Tools Schema
    LLM-->>ChatAPI: Ask user for City/Ground & Live vs Tomorrow
    ChatAPI-->>UI: "Could you please provide the city or ground..."

    User->>UI: "Chicago, IL for the next 4 hours"
    UI->>APIGW: POST /chat { message, history }
    APIGW->>ChatAPI: Invoke chatHandler
    ChatAPI->>LLM: System Prompt + Conversation History + Tools Schema
    LLM-->>ChatAPI: Tool Call: get_match_weather({ location: "Chicago, IL", targetDate: "today", hoursAhead: 4 })
    ChatAPI->>MCP: mcpClient.callTool("get_match_weather", args)
    MCP->>Geo: GET /v1/search?name=Chicago&count=5
    Geo-->>MCP: { latitude: 41.85, longitude: -87.65, timezone: "America/Chicago" }
    MCP->>Weather: GET /v1/forecast?latitude=41.85&longitude=-87.65&hourly=...&timezone=auto
    Weather-->>MCP: Hourly temperature, rain probability %, precipitation mm, wind speed
    MCP->>MCP: Map WMO codes + compute Cricket & DLS Advisory
    MCP-->>ChatAPI: Return structured JSON weather report
    ChatAPI->>LLM: Tool Result JSON
    LLM-->>ChatAPI: Format hour-by-hour Cricket Weather Report
    ChatAPI-->>UI: Display forecast & DLS advisory to user
```

---

## 🏏 4. Cricket & DLS Advisory Threshold Matrix

Inside `buildCricketAdvisory()` (`apps/backend/lambdas/chat-api/mcp/tools/getMatchWeather.js`), hourly metrics are translated into actionable cricket and Duckworth-Lewis-Stern (DLS) guidance:

| Condition Threshold                                               | Generated Cricket & DLS Advisory                                                                                                          |
| :---------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| • **`maxRainProb >= 60%`**<br/>• OR **`totalPrecipMm >= 2.0 mm`** | • **High risk of rain interruption**<br/>• Recommends keeping **DLS par score projections** ready in case of overs reduction              |
| • **`maxRainProb >= 30%`**<br/>• OR **`totalPrecipMm > 0 mm`**    | • **Passing showers possible**<br/>• Notes that cloud cover and humidity may assist swing bowlers and advises monitoring for brief delays |
| • **`maxWindMph >= 20 mph`** (Dry)                                | • **Breezy conditions**<br/>• Advises captains and bowlers to factor crosswinds into bowling ends and boundary defense                    |
| • **`maxRainProb < 30%`** & Dry & **`< 20 mph`** wind             | • **Ideal cricket weather**<br/>• Full uninterrupted match likely without DLS rain delays                                                 |

---

## 🧪 5. Key Files & Verification Commands

| Subsystem                          | File Path                                                                                                                                          | Responsibility                                                                                                      |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| **Node.js MCP Weather Tool**       | [`apps/backend/lambdas/chat-api/mcp/tools/getMatchWeather.js`](../apps/backend/lambdas/chat-api/mcp/tools/getMatchWeather.js)                      | • Open-Meteo geocoding & city fallback<br/>• Hourly forecast slicing, WMO code mapping, and DLS advisory generation |
| **MCP Server Registry**            | [`apps/backend/lambdas/chat-api/mcp/server.js`](../apps/backend/lambdas/chat-api/mcp/server.js)                                                    | • Registers `get_match_weather` schema on the in-memory MCP server                                                  |
| **Supervisor Routing (`Rule 11`)** | [`apps/backend/lambdas/chat-api/handlers/chatHandler.js`](../apps/backend/lambdas/chat-api/handlers/chatHandler.js)                                | • Enforces location-clarification prompt before calling the weather tool                                            |
| **Python LangGraph Specialist**    | • [`apps/ai-service/cricscore_ai/tools.py`](../apps/ai-service/cricscore_ai/tools.py)<br/>• [`graph.py`](../apps/ai-service/cricscore_ai/graph.py) | • Implements `get_match_weather` tool<br/>• Runs `weather_node` specialist agent                                    |
| **Frontend Chat UI**               | [`apps/frontend/src/components/ChatComponent.tsx`](../apps/frontend/src/components/ChatComponent.tsx)                                              | • Surfaces prompt chip `#6` for one-click match weather checks                                                      |

```bash
# 1. Run Backend MCP weather tool unit tests
npm --prefix apps/backend test -- --run

# 2. Run Python LangGraph multi-agent weather tests
./apps/ai-service/.venv/bin/pytest apps/ai-service -q

# 3. Run Frontend ChatComponent tests
npm --prefix apps/frontend test -- --run src/test/ChatComponent.test.tsx
```

---

## 🔗 Related Documentation

- [**AI Architecture (Agentic RAG & MCP)**](./ai_architecture.md)
- [**GitHub Issue Specialist Agent Guide**](./github_issue_agent.md)
- [**MLOps & DLS Par Score Guide**](./mlops_tutorial.md)
- [**Architecture & AI/MLOps FAQ**](./architecture_faq.md)
