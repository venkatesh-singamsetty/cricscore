#!/usr/bin/env python3
"""Generate the icon-based architecture images shown in the main README.

The images use official AWS architecture icons (bundled with the `diagrams`
package) plus brand / specialist agent icons stored in `docs/diagrams/icons/`.

Usage (Graphviz `dot` must be on PATH, e.g. `brew install graphviz`):

    python3 -m venv /tmp/diagrams-venv
    /tmp/diagrams-venv/bin/pip install diagrams pillow
    /tmp/diagrams-venv/bin/python docs/diagrams/generate_architecture_diagrams.py

Output PNGs are written to `docs/images/architecture/`.
The detailed Mermaid versions of these flows live in `docs/architecture.md`.
"""

from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import ECR, Lambda
from diagrams.aws.cost import Budgets
from diagrams.aws.database import Dynamodb
from diagrams.aws.devtools import XRay
from diagrams.aws.engagement import SES
from diagrams.aws.integration import SNS, SQS
from diagrams.aws.management import CloudwatchAlarm, CloudwatchLogs
from diagrams.aws.mobile import Amplify
from diagrams.aws.network import APIGateway, CloudFront, Route53
from diagrams.aws.security import ACM, Cognito, IAMRole
from diagrams.aws.storage import S3
from diagrams.custom import Custom

ROOT = Path(__file__).resolve().parent
ICONS = ROOT / "icons"
OUT = ROOT.parent / "images" / "architecture"
OUT.mkdir(parents=True, exist_ok=True)


def icon(name: str) -> str:
    return str(ICONS / f"{name}.png")


GRAPH = {
    "fontsize": "26",
    "fontname": "Helvetica-Bold",
    "bgcolor": "white",
    "pad": "0.5",
    "nodesep": "0.60",
    "ranksep": "1.15",
    "splines": "polyline",
    "concentrate": "false",
    "labelloc": "t",
}
NODE = {"fontsize": "12", "fontname": "Helvetica"}
EDGE = {"fontsize": "11", "fontname": "Helvetica-Bold"}


def cluster(label: str, color: str, fill: str) -> dict:
    return {
        "label": label,
        "graph_attr": {
            "bgcolor": fill,
            "pencolor": color,
            "fontcolor": color,
            "fontsize": "15",
            "fontname": "Helvetica-Bold",
            "style": "rounded",
            "margin": "18",
        },
    }


# Shared palette across all four diagrams.
BLUE, ORANGE, GREEN, PURPLE, GREY, TEAL = (
    "#1f6feb",
    "#e8590c",
    "#2f9e44",
    "#7048e8",
    "#495057",
    "#0ca678",
)


def edge(label: str = "", color: str = GREY, style: str = "bold") -> Edge:
    if label:
        return Edge(label=label, color=color, fontcolor=color, style=style)
    return Edge(color=color, style=style)


# ---------------------------------------------------------------------------
# 1. Platform overview (all AWS platform services; live-scoring internals in #2)
# ---------------------------------------------------------------------------
def platform_overview() -> None:
    with Diagram(
        "CricScore Platform Overview (AWS Serverless + Aiven PostgreSQL)",
        filename=str(OUT / "01_platform_overview"),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=GRAPH,
        node_attr=NODE,
        edge_attr=EDGE,
    ):
        users = Custom(
            "Fans / Scorers / Admins\n(Web & Mobile)", icon("tb_users")
        )

        with Cluster(**cluster("1. DNS, SSL & CDN Edge", BLUE, "#eef4ff")):
            dns = Route53("Route 53\nHosted Zone")
            acm = ACM("ACM\nSSL/TLS Certs")
            cdn = CloudFront("CloudFront\nCDN + OAC")
            site = S3("S3 Static Hosting\nReact SPA + Logs")

        with Cluster(
            **cluster("2. Auth (Amplify + Cognito) & API Gateway", ORANGE, "#fff4e6")
        ):
            amplify = Amplify("AWS Amplify\nAuth SDK & UI")
            auth = Cognito("Cognito User Pool\nJWT + Pre-Signup")
            http = APIGateway("API Gateway\nHTTP REST API")
            ws = APIGateway("API Gateway\nWebSocket API")

        with Cluster(
            **cluster("3. Serverless Compute (AWS Lambda)", ORANGE, "#fffaf0")
        ):
            iam = IAMRole("IAM Role\nLeast-Privilege")
            match_api = Lambda("match-api\nMatches & Admin")
            chat = Lambda("chat-api\nAI Assistant (#3)")
            score = Lambda("score-update\nLive Balls (#2)")
            ml = Lambda("ml-predict\nWin Predictor (#4)")

        with Cluster(
            **cluster("4. Data, Registries & Email", GREEN, "#ebfbee")
        ):
            pg = Custom(
                "Aiven PostgreSQL 16\n+ pgvector", icon("postgresql")
            )
            mail = SES("Amazon SES\nScorecard Emails")
            s3_reg = S3("Amazon S3\nBackups, Models & State")
            ecr = ECR("Amazon ECR\nml-predict Image")

        with Cluster(
            **cluster("5. Observability, Tracing & Cost", GREY, "#f8f9fa")
        ):
            logs = CloudwatchLogs("CloudWatch Logs\n7-Day Retention")
            xray = XRay("AWS X-Ray\n5% Trace Sampling")
            alarms = CloudwatchAlarm("CloudWatch Alarms\n+ SNS Alerts")
            budget = Budgets("AWS Budgets\n~$1/mo Guardrail")

        # Lock top-to-bottom vertical ordering within each cluster for zero crossings
        for a, b in [(amplify, auth), (auth, ws), (ws, http)]:
            a >> Edge(style="invis", constraint="false", weight="10") >> b
        for a, b in [(iam, score), (score, chat), (chat, match_api), (match_api, ml)]:
            a >> Edge(style="invis", constraint="false", weight="10") >> b
        for a, b in [(logs, xray), (xray, alarms), (alarms, budget)]:
            a >> Edge(style="invis", constraint="false", weight="10") >> b
        for a, b in [(pg, mail), (mail, s3_reg), (s3_reg, ecr)]:
            a >> Edge(style="invis", constraint="false", weight="10") >> b

        # Edge 1: Static Frontend Delivery (Route 53 -> ACM -> CloudFront -> S3)
        users >> edge("HTTPS", BLUE) >> dns >> edge("TLS", BLUE) >> acm >> edge("Origin", BLUE) >> cdn >> edge("OAC", BLUE) >> site

        # Edge 2: Identity (AWS Amplify -> Cognito -> HTTP API JWT Authorizer) & API Entry
        users >> edge("Sign In", ORANGE) >> amplify
        amplify >> Edge(color=ORANGE, fontcolor=ORANGE, style="bold", label="SRP / JWT", constraint="false") >> auth
        auth >> edge("Authorizer", ORANGE, "dashed") >> iam
        users >> edge("REST + JWT", ORANGE) >> http
        users << edge("Live Push (#2)", GREEN) << ws

        # API Gateway -> Serverless Compute
        http >> edge("Route", ORANGE) >> match_api
        http >> edge("Route", ORANGE) >> chat
        http >> edge("Route", ORANGE) >> score
        http >> edge("Route", ORANGE) >> ml
        ws << edge("SNS + Broadcaster (#2)", GREEN, "dashed") << score

        # Serverless Compute -> Data, Registries & Email (100% genuine connections)
        match_api >> edge("Send Report", ORANGE) >> mail
        match_api >> edge("Read / Write", GREEN) >> pg
        match_api >> edge("Match Backups", GREEN, "dashed") >> s3_reg
        chat >> edge("Read-Only SQL + RAG", PURPLE) >> pg
        score >> edge("SQS + Worker (#2)", GREEN, "dashed") >> pg
        ml >> edge("Load Model v2.2.0", GREEN) >> s3_reg
        ml >> edge("Container Image", ORANGE, "dashed") >> ecr

        # Serverless Compute -> Observability, Tracing & Cost Governance (upper band, zero crossings)
        iam >> edge("Cost Guardrail", GREY, "dotted") >> budget
        iam >> edge("Error Alarms", GREY, "dotted") >> alarms
        iam >> edge("7d Logs", GREY, "dotted") >> logs
        iam >> edge("Active Traces", GREY, "dotted") >> xray


# ---------------------------------------------------------------------------
# 2. Live scoring: one ball, two paths
# ---------------------------------------------------------------------------
def live_scoring() -> None:
    with Diagram(
        "Live Scoring Flow: One Ball, Two Parallel Paths",
        filename=str(OUT / "02_live_scoring_flow"),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=GRAPH,
        node_attr=NODE,
        edge_attr=EDGE,
    ):
        scorer = Custom("Scorer\n(Taps Ball)", icon("tb_device-mobile"))
        http = APIGateway("HTTP API\nPOST /update-score")
        producer = Lambda("score-update\nLambda")

        with Cluster(
            **cluster("FAST PATH: Sub-Second Fan Broadcast", BLUE, "#eef4ff")
        ):
            sns = SNS("Amazon SNS\nmatch-events")
            broadcaster = Lambda("broadcaster\nLambda")
            conns = Dynamodb("DynamoDB\nActive Connections")
            ws = APIGateway("WebSocket API\n@connections")

        viewers = Custom("Live Viewers\n(Scoreboard)", icon("tb_users"))

        with Cluster(
            **cluster("SAFE PATH: Ordered Database Persistence", GREEN, "#ebfbee")
        ):
            sqs = SQS("Amazon SQS FIFO\nstorage-buffer.fifo")
            worker = Lambda("storage-worker\nLambda")
            pg = Custom(
                "Aiven PostgreSQL 16\nmatches / innings / balls",
                icon("postgresql"),
            )

        scorer >> edge("1. Ball", ORANGE) >> http >> edge("2. Invoke", ORANGE) >> producer
        producer >> edge("3a. Publish", BLUE) >> sns >> edge("4a. Trigger", BLUE) >> broadcaster
        broadcaster >> edge("5a. Lookup", BLUE) >> conns >> edge("6a. Push", BLUE) >> ws >> edge("7a. Stream", BLUE) >> viewers
        producer >> edge("3b. Enqueue", GREEN) >> sqs >> edge("4b. Poll", GREEN) >> worker >> edge("5b. Persist", GREEN) >> pg


# ---------------------------------------------------------------------------
# 3. AI assistant: Autonomous Multi-Agent System via MCP
# ---------------------------------------------------------------------------
def ai_assistant() -> None:
    with Diagram(
        "CricScore Agentic AI Architecture: Supervisor, MCP & Specialist Agents",
        filename=str(OUT / "03_ai_assistant"),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=GRAPH,
        node_attr=NODE,
        edge_attr=EDGE,
    ):
        with Cluster(**cluster("1. Client & API Entry", BLUE, "#eef4ff")):
            fan = Custom(
                "Fan / Scorer\n(Chat Widget)", icon("tb_message-chatbot")
            )
            http = APIGateway("API Gateway\nPOST /chat")

        with Cluster(
            **cluster(
                "2. Orchestration & Guardrails (chat-api Lambda)",
                ORANGE,
                "#fffaf0",
            )
        ):
            chat_lambda = Lambda("chat-api\nLambda Handler")
            guard = Custom(
                "Security Guardrails\nRead-Only • PII Strip\n1-Issue Rate Guard",
                icon("tb_shield-lock"),
            )
            supervisor = Custom(
                "Agent Supervisor\nContext Injection &\nTool Orchestrator",
                icon("tb_robot"),
            )
            llm = Custom(
                "OpenAI-Compatible LLM\ngpt-4o-mini\n(Intent & Synthesis)",
                icon("openai"),
            )
            mcp = Custom(
                "In-Memory MCP\nClient <-> Server\n(Credential Isolation)",
                icon("mcp_hub"),
            )

        with Cluster(
            **cluster(
                "3. Specialist AI Agents (MCP Tools)", PURPLE, "#f3f0ff"
            )
        ):
            stats_agent = Custom(
                "Match Stats Agent\nexecute_sql\n(Read-Only SELECT)",
                icon("agent_stats"),
            )
            rules_agent = Custom(
                "Tournament Rules Agent\nsearch_tournament_rules\n(Vector RAG + Citation)",
                icon("agent_rules"),
            )
            weather_agent = Custom(
                "Weather Specialist Agent\nget_match_weather\n(Hourly Rain & DLS)",
                icon("agent_weather"),
            )
            issue_agent = Custom(
                "GitHub Issue Agent\ncreate_github_issue\n(2-Step Confirmed)",
                icon("agent_issue"),
            )

        with Cluster(
            **cluster("4. Backing Data Stores & External APIs", GREEN, "#ebfbee")
        ):
            pg_sql = Custom(
                "Aiven PostgreSQL 16\nLive Matches, Innings\n& Player Stats",
                icon("postgresql"),
            )
            pg_vec = Custom(
                "PostgreSQL pgvector\nRulebook Embeddings\n(Cosine Similarity)",
                icon("tb_database-search"),
            )
            meteo = Custom(
                "Open-Meteo API\nGeocoding & Live\nHourly Forecast",
                icon("openmeteo"),
            )
            gh = Custom(
                "GitHub REST API\nRepository Issues\nTracker",
                icon("github"),
            )

        # Clean left-to-right flow with straight lines
        fan >> edge("Ask", BLUE) >> http >> edge("Invoke", ORANGE) >> chat_lambda
        chat_lambda >> edge("Enforce", ORANGE) >> guard >> edge("Context", ORANGE) >> supervisor
        supervisor >> Edge(label="Reason & Synthesize", color=PURPLE, fontcolor=PURPLE, style="bold", dir="both") >> llm
        supervisor >> Edge(label="Dispatch Tool", color=PURPLE, fontcolor=PURPLE, style="bold") >> mcp

        # MCP dispatches to the 4 specialist agents (1-to-1 row alignment with backing stores)
        mcp >> edge("SQL Tool", PURPLE) >> stats_agent >> edge("3s Read-Only Txn", GREEN) >> pg_sql
        mcp >> edge("RAG Tool", PURPLE) >> rules_agent >> edge("Top-K Chunks", GREEN) >> pg_vec
        mcp >> edge("Weather Tool", PURPLE) >> weather_agent >> edge("Hourly Weather", TEAL) >> meteo
        mcp >> edge("Issue Tool", PURPLE) >> issue_agent >> edge("File Issue", ORANGE) >> gh


# ---------------------------------------------------------------------------
# 3. Vector RAG: Tournament Rules Ingestion & Semantic Retrieval
# ---------------------------------------------------------------------------
def vector_rag() -> None:
    with Diagram(
        "CricScore Vector RAG Architecture: Tournament Rules Ingestion & Semantic Retrieval",
        filename=str(OUT / "03_vector_rag_architecture"),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=GRAPH,
        node_attr=NODE,
        edge_attr=EDGE,
    ):
        with Cluster(**cluster("1. Ingestion & Query Ingress", BLUE, "#eef4ff")):
            admin = Custom(
                "Admin Scorer\n(Upload Rulebook PDF)", icon("tb_device-mobile")
            )
            http = APIGateway("API Gateway\nPOST /rules/upload\nPOST /chat")
            viewer = Custom(
                "Viewer / Fan\n(Tournament Rule Query)",
                icon("tb_message-chatbot"),
            )
            admin >> Edge(style="invis") >> viewer

        with Cluster(
            **cluster(
                "2. Document Processing & Embedding", ORANGE, "#fffaf0"
            )
        ):
            parser = Custom(
                "PDF Parser & Splitter\npdf-parse • Paragraphs\n~1,000 Chars / Chunk",
                icon("tb_shield-lock"),
            )
            embedder = Custom(
                "OpenAI Embeddings\ntext-embedding-3-small\n(1536-d Vectors)",
                icon("openai"),
            )
            chat_lambda = Lambda(
                "chat-api Lambda\nRules Handler &\nMCP Rules Agent"
            )
            parser >> Edge(style="invis") >> chat_lambda

        with Cluster(
            **cluster(
                "3. Vector Store & HNSW Index (PostgreSQL)", GREEN, "#ebfbee"
            )
        ):
            pg_store = Custom(
                "Aiven PostgreSQL 16\ntournament_rules Table\n(doc_name, chunk_text)",
                icon("postgresql"),
            )
            hnsw_idx = Custom(
                "PostgreSQL pgvector\nHNSW Cosine Index\nvector_cosine_ops (<=>)",
                icon("tb_database-search"),
            )

        with Cluster(
            **cluster(
                "4. Grounded Synthesis & Citations", PURPLE, "#f3f0ff"
            )
        ):
            supervisor = Custom(
                "Agent Supervisor\nTop-8 Chunk Context\nPrompt Assembler",
                icon("tb_robot"),
            )
            llm = Custom(
                "OpenAI LLM\ngpt-4o-mini\n(Grounded Synthesis)", icon("openai")
            )
            response = Custom(
                "Grounded Rule Answer\nMandatory Citations\n[Source: doc_name]",
                icon("agent_rules"),
            )

        # Ingestion Flow (Top Path)
        admin >> edge("Upload PDF", BLUE) >> http
        http >> edge("Cognito Admin JWT", ORANGE) >> parser
        parser >> edge("Text Chunks", ORANGE) >> embedder
        embedder >> edge("1536-d Vectors", GREEN) >> pg_store
        pg_store >> edge("Index", GREEN) >> hnsw_idx

        # Query & Retrieval Flow (Bottom Path)
        viewer >> edge("Ask Rule Question", BLUE) >> http
        http >> edge("Invoke /chat", ORANGE) >> chat_lambda
        chat_lambda >> edge("Vectorize Query", ORANGE) >> embedder
        embedder >> edge("Query Vector", GREEN) >> hnsw_idx
        hnsw_idx >> edge("Top-8 Rule Chunks", PURPLE) >> supervisor
        supervisor >> edge("Synthesize", PURPLE) >> llm
        llm >> edge("Cite Rule Source", PURPLE) >> response


# ---------------------------------------------------------------------------
# 4. MLOps & live win prediction
# ---------------------------------------------------------------------------
def mlops() -> None:
    with Diagram(
        "MLOps & Hybrid Win Prediction: From Cricsheet Data to Live Probabilities",
        filename=str(OUT / "04_mlops_win_prediction"),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=GRAPH,
        node_attr=NODE,
        edge_attr=EDGE,
    ):
        with Cluster(**cluster("1. Dataset & Versioning", BLUE, "#eef4ff")):
            data = Custom(
                "Cricsheet T20 Data\n786K+ Ball Deliveries",
                icon("tb_chart-line"),
            )
            dvc = Custom(
                "DVC Dataset Tracking\nt20s_json.zip.dvc\n+ dvc.yaml / dvc.lock",
                icon("dvc"),
            )

        with Cluster(
            **cluster(
                "2. Multi-Model Training & Selection", PURPLE, "#f3f0ff"
            )
        ):
            bench = Custom(
                "8-Model Benchmark\ncompare_models.py\n(Scikit-Learn + XGBoost)",
                icon("scikitlearn"),
            )
            mlflow = Custom(
                "MLflow Tracking\nAccuracy, Log Loss,\nBrier & ROC-AUC",
                icon("mlflow"),
            )
            xgb = Custom(
                "Promoted Champion\nXGBoost v2.2.0\n(ROC-AUC 0.77)",
                icon("xgboost"),
            )

        with Cluster(
            **cluster(
                "3. Quality Gate & Artifact Registries", ORANGE, "#fff4e6"
            )
        ):
            gate = Custom(
                "CI Quality Gate\nAcc >= 60%, AUC >= 65%\n+ SHA-256 Manifest",
                icon("githubactions"),
            )
            s3_reg = S3(
                "Amazon S3 Registry\nmodels/v2.2.0/\n(.joblib + manifest)"
            )
            ecr = ECR(
                "Amazon ECR Registry\nml-predict:v2.2.0\n(Python 3.12 Image)"
            )

        http = APIGateway("API Gateway\nPOST /match/predict")

        with Cluster(
            **cluster(
                "4. Real-Time Hybrid Inference (AWS Lambda)", GREEN, "#ebfbee"
            )
        ):
            ml = Lambda(
                "ml-predict Lambda\nLoads S3 Model into /tmp\n& Verifies SHA-256"
            )
            engine = Custom(
                "Hybrid Win Engine\nXGBoost + Markov DP\n+ DLS Par Scaling",
                icon("tb_brain"),
            )

        viewers = Custom(
            "Live Scoreboard\nSub-Second Win %", icon("tb_users")
        )

        # Sequential left-to-right pipeline without parallel-champion confusion
        data >> edge("Extract", BLUE) >> dvc >> edge("Train 8 Models", PURPLE) >> bench
        bench >> edge("Log Metrics", PURPLE) >> mlflow >> edge("Select Best", PURPLE) >> xgb
        xgb >> edge("Validate", ORANGE) >> gate
        gate >> edge("Upload Artifact", ORANGE) >> s3_reg
        gate >> edge("Push Image", ORANGE) >> ecr
        gate >> Edge(style="invis") >> http
        s3_reg >> edge("Fetch + SHA-256", GREEN) >> ml
        ecr >> edge("Container Image", GREEN, "dashed") >> ml
        http >> edge("Ball State", GREEN) >> ml
        ml >> edge("Blend", GREEN) >> engine >> edge("Live Win %", BLUE) >> viewers


if __name__ == "__main__":
    platform_overview()
    live_scoring()
    vector_rag()
    ai_assistant()
    mlops()
    print(f"Diagrams written to {OUT}")
