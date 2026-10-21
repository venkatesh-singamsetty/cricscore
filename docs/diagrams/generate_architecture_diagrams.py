#!/usr/bin/env python3
"""Generate the icon-based architecture images shown in the main README.

The images use official AWS architecture icons (bundled with the `diagrams`
package) plus brand / generic icons stored in `docs/diagrams/icons/`.

Usage (Graphviz `dot` must be on PATH, e.g. `brew install graphviz`):

    python3 -m venv /tmp/diagrams-venv
    /tmp/diagrams-venv/bin/pip install diagrams
    /tmp/diagrams-venv/bin/python docs/diagrams/generate_architecture_diagrams.py

Output PNGs are written to `docs/images/architecture/`.
The detailed Mermaid versions of these flows live in `docs/architecture.md`.
"""

from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import ECR, Lambda
from diagrams.aws.database import Dynamodb
from diagrams.aws.engagement import SES
from diagrams.aws.integration import SNS, SQS
from diagrams.aws.management import Cloudwatch
from diagrams.aws.network import APIGateway, CloudFront, Route53
from diagrams.aws.security import Cognito
from diagrams.aws.storage import S3
from diagrams.custom import Custom

ROOT = Path(__file__).resolve().parent
ICONS = ROOT / "icons"
OUT = ROOT.parent / "images" / "architecture"
OUT.mkdir(parents=True, exist_ok=True)


def icon(name: str) -> str:
    return str(ICONS / f"{name}.png")


GRAPH = {
    "fontsize": "28",
    "fontname": "Helvetica-Bold",
    "bgcolor": "white",
    "pad": "0.6",
    "nodesep": "0.7",
    "ranksep": "1.1",
    "splines": "spline",
    "labelloc": "t",
}
NODE = {"fontsize": "13", "fontname": "Helvetica"}
EDGE = {"fontsize": "12", "fontname": "Helvetica-Bold"}


def cluster(label: str, color: str, fill: str) -> dict:
    return {
        "label": label,
        "graph_attr": {
            "bgcolor": fill,
            "pencolor": color,
            "fontcolor": color,
            "fontsize": "16",
            "fontname": "Helvetica-Bold",
            "style": "rounded",
            "margin": "18",
        },
    }


# Colours shared across all diagrams so the legend reads the same everywhere.
BLUE, ORANGE, GREEN, PURPLE, GREY, RED = (
    "#1f6feb",
    "#e8590c",
    "#2f9e44",
    "#7048e8",
    "#868e96",
    "#c92a2a",
)


def edge(label: str, color: str, style: str = "bold", constraint: str = "true") -> Edge:
    return Edge(label=label, color=color, fontcolor=color, style=style, constraint=constraint)


# ---------------------------------------------------------------------------
# 1. Platform overview
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
        users = Custom("Fans / Scorers / Admins\n(browser or phone)", icon("tb_users"))

        with Cluster(**cluster("1. Load the app", BLUE, "#eef4ff")):
            dns = Route53("Route 53\nDNS")
            cdn = CloudFront("CloudFront\nCDN")
            site = S3("S3\nReact build")

        with Cluster(**cluster("2. Sign in & APIs", ORANGE, "#fff4e6")):
            auth = Cognito("Cognito\nJWT tokens")
            http = APIGateway("API Gateway\nHTTP API")
            ws = APIGateway("API Gateway\nWebSocket API")

        # Order Lambdas to vertically align with their downstream targets in Box 4
        with Cluster(**cluster("3. Serverless compute (AWS Lambda)", ORANGE, "#fffaf0")):
            match_api = Lambda("match-api\nmatches & admin")
            ml = Lambda("ml-predict\nwin probability")
            score = Lambda("score-update\nlive balls")
            chat = Lambda("chat-api\nAI assistant")

        # Order Persistence/Services to align with Lambdas, eliminating line crossings
        with Cluster(**cluster("4. Data & Persistence", GREEN, "#ebfbee")):
            mail = SES("SES\nmatch report emails")
            backups = S3("S3\nbackups & ML models")
            pg = Custom("Aiven PostgreSQL 16\n+ pgvector", icon("postgresql"))
            llm = Custom("OpenAI-compatible\nLLM provider", icon("openai"))

        with Cluster(**cluster("5. Observability & Alarms", GREY, "#f8f9fa")):
            logs = Cloudwatch("CloudWatch Logs\n(7-day retention)")
            alarms = Cloudwatch("CloudWatch Alarms\n(error rate triggers)")

        # 1. Load the app
        users >> edge("open site", BLUE) >> dns >> cdn >> site

        # 2. Ingress & Auth
        users >> edge("sign in", ORANGE) >> auth
        users >> edge("REST calls + JWT", ORANGE) >> http
        users >> edge("live WebSocket push", GREEN, "dashed") >> ws

        # 3. HTTP Ingress to Compute (clean separate routes)
        http >> edge("match routes", ORANGE) >> match_api
        http >> edge("prediction", ORANGE) >> ml
        http >> edge("ball update", ORANGE) >> score
        http >> edge("chat query", ORANGE) >> chat

        # 4. Compute to Storage & External Services (aligned pairs = no crossings)
        match_api >> edge("send email", ORANGE) >> mail
        match_api >> edge("backup", GREEN) >> backups
        match_api >> edge("read / write", GREEN) >> pg

        ml >> edge("load model", GREEN, "dashed") >> backups

        score >> edge("persist", GREEN, "dashed") >> pg
        score >> edge("fan-out (diagram 2)", GREEN, "dashed", constraint="false") >> ws

        chat >> edge("read SQL + vector", PURPLE) >> pg
        chat >> edge("tool calling", PURPLE) >> llm

        # 5. Observability (constraint=false prevents lines from cutting through Postgres/LLM)
        for fn in [match_api, ml, score, chat]:
            fn >> Edge(color=GREY, style="dotted", constraint="false") >> logs
        match_api >> Edge(color=RED, style="dotted", constraint="false") >> alarms
        score >> Edge(color=RED, style="dotted", constraint="false") >> alarms


# ---------------------------------------------------------------------------
# 2. Live scoring: one ball, two paths
# ---------------------------------------------------------------------------
def live_scoring() -> None:
    with Diagram(
        "Live Scoring Flow: One Ball, Two Paths",
        filename=str(OUT / "02_live_scoring_flow"),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=GRAPH,
        node_attr=NODE,
        edge_attr=EDGE,
    ):
        scorer = Custom("Scorer\n(taps a ball)", icon("tb_device-mobile"))
        http = APIGateway("HTTP API\nPOST /update-score")
        producer = Lambda("score-update\nLambda")

        with Cluster(**cluster("FAST PATH: viewers see it in < 1s", BLUE, "#eef4ff")):
            sns = SNS("SNS\nlive-score-fanout")
            broadcaster = Lambda("broadcaster\nLambda")
            conns = Dynamodb("DynamoDB\nWebSocket connections")
            ws = APIGateway("WebSocket API\n@connections")

        viewers = Custom("Fans watching\n(live scoreboard)", icon("tb_users"))

        with Cluster(**cluster("SAFE PATH: never lose a ball", GREEN, "#ebfbee")):
            sqs = SQS("SQS\npersistence queue")
            worker = Lambda("storage-worker\nLambda")
            pg = Custom("Aiven PostgreSQL 16\nmatches / innings / balls", icon("postgresql"))

        scorer >> edge("1", ORANGE) >> http >> edge("2", ORANGE) >> producer
        producer >> edge("3a publish", BLUE) >> sns >> edge("4a", BLUE) >> broadcaster
        broadcaster >> edge("5a who is online?", BLUE) >> conns
        broadcaster >> edge("6a push", BLUE) >> ws >> edge("7a", BLUE) >> viewers
        producer >> edge("3b enqueue", GREEN) >> sqs >> edge("4b batch", GREEN) >> worker
        worker >> edge("5b write", GREEN) >> pg


# ---------------------------------------------------------------------------
# 3. AI assistant: Agentic Multi-Agent AI System
# ---------------------------------------------------------------------------
def ai_assistant() -> None:
    with Diagram(
        "CricScore Agentic AI Architecture: Lambda, MCP & Multi-Agent System",
        filename=str(OUT / "03_ai_assistant"),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=GRAPH,
        node_attr=NODE,
        edge_attr=EDGE,
    ):
        with Cluster(**cluster("1. Client Request", BLUE, "#eef4ff")):
            fan = Custom("Fan / Scorer\n(chat widget)", icon("tb_message-chatbot"))
            http = APIGateway("API Gateway\nPOST /chat")

        with Cluster(**cluster("2. AWS Serverless Compute (chat-api Lambda)", ORANGE, "#fffaf0")):
            chat_lambda = Lambda("chat-api\nLambda Handler")
            guard = Custom("Security Guardrails\nread-only SQL guard,\n1-issue rate limit", icon("tb_shield-lock"))
            orchestrator = Custom("Agent Orchestrator\n& Supervisor", icon("tb_robot"))
            mcp_client = Custom("MCP Client\n(Protocol Adapter)", icon("tb_brain"))

            with Cluster(**cluster("Individual Specialist Agents", PURPLE, "#ffffff")):
                match_agent = Custom("Match Stats Agent\n(Text-to-SQL)", icon("tb_database-search"))
                rules_agent = Custom("Rules Agent\n(Vector RAG)", icon("tb_brain"))
                weather_agent = Custom("Weather Agent\n(Open-Meteo & DLS)", icon("tb_cloud-rain"))
                issue_agent = Custom("Issue Agent\n(GitHub Tracker)", icon("github"))

            with Cluster(**cluster("MCP Server & Tools", PURPLE, "#f3f0ff")):
                mcp_server = Custom("In-Memory MCP Server\n(Tool Schema Registry)", icon("tb_robot"))
                tools = Custom("MCP Tools\nexecute_sql • search_rules\nget_weather • create_issue", icon("tb_database-search"))

        with Cluster(**cluster("3. Reasoning Engine", PURPLE, "#f3f0ff")):
            llm = Custom("OpenAI-Compatible LLM\n(Autonomous Reasoning\n& Tool Selection)", icon("openai"))

        with Cluster(**cluster("4. Data Stores & External APIs", GREEN, "#ebfbee")):
            pg_rel = Custom("Aiven PostgreSQL 16\n(Matches & stats)", icon("postgresql"))
            pg_vec = Custom("pgvector Store\n(Rulebook embeddings)", icon("postgresql"))
            meteo = Custom("Open-Meteo API\n(Live weather & rain)", icon("openmeteo"))
            gh = Custom("GitHub Issues API\n(Issue filing)", icon("github"))

        with Cluster(**cluster("5. Response Delivery", BLUE, "#eef4ff")):
            output = Custom("Sanitized Output\n(Answer, Citations,\n& Tactical Cards)", icon("tb_message-chatbot"))

        # 1. Ingress Flow
        fan >> edge("ask", BLUE) >> http >> edge("invoke", ORANGE) >> chat_lambda
        chat_lambda >> edge("sanitize", PURPLE) >> guard >> orchestrator

        # 2. Orchestrator <-> LLM Reasoning Loop
        orchestrator >> Edge(label="1. prompt & tools / 3. tool results", color=PURPLE, fontcolor=PURPLE, style="bold") >> llm
        llm >> Edge(label="2. tool decisions / 4. final answer", color=PURPLE, fontcolor=PURPLE, style="bold") >> orchestrator

        # 3. Orchestrator <-> MCP Client <-> Specialist Agents <-> MCP Server & Tools
        orchestrator >> Edge(label="dispatch tool calls\n(results return)", color=PURPLE, fontcolor=PURPLE, style="bold", dir="both") >> mcp_client
        mcp_client >> edge("delegate", PURPLE) >> [match_agent, rules_agent, weather_agent, issue_agent]
        [match_agent, rules_agent, weather_agent, issue_agent] >> edge("invoke", PURPLE) >> mcp_server
        mcp_server >> Edge(label="executes", color=PURPLE, fontcolor=PURPLE, style="bold", dir="both") >> tools

        # 4. Tools query External Stores & APIs
        tools >> edge("read-only SQL", GREEN) >> pg_rel
        tools >> edge("cosine search", GREEN) >> pg_vec
        tools >> edge("hourly forecast", GREEN) >> meteo
        tools >> edge("create issue", GREEN) >> gh

        # 5. Final Response Delivery (Orchestrator returns synthesized answer)
        orchestrator >> Edge(label="5. return synthesized response", color=BLUE, fontcolor=BLUE, style="bold") >> output


# ---------------------------------------------------------------------------
# 4. MLOps & win prediction
# ---------------------------------------------------------------------------
def mlops() -> None:
    with Diagram(
        "MLOps & Hybrid Win Prediction: From Data to Live Probabilities",
        filename=str(OUT / "04_mlops_win_prediction"),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=GRAPH,
        node_attr=NODE,
        edge_attr=EDGE,
    ):
        with Cluster(**cluster("1. Dataset & DVC Versioning", BLUE, "#eef4ff")):
            data = Custom("Cricsheet T20 Data\n(786K+ ball-by-ball deliveries)", icon("tb_chart-line"))
            dvc = Custom("DVC Dataset Tracking\n(cricket-data/t20s_json.zip.dvc)", icon("dvc"))

        with Cluster(**cluster("2. Multi-Model Experimentation & Tracking", PURPLE, "#f3f0ff")):
            sk = Custom("scikit-learn Baselines\n(Logistic, RF, ExtraTrees, HGB)", icon("scikitlearn"))
            xgb = Custom("XGBoost Champion\n(v2.2.0, ROC-AUC > 0.65)", icon("xgboost"))
            mlflow = Custom("MLflow Tracking\n(Log loss, Brier, ROC-AUC)", icon("mlflow"))

        with Cluster(**cluster("3. CI/CD Governance & Packaging (GitHub Actions)", ORANGE, "#fff4e6")):
            gate = Custom("Quality Gates\n(Accuracy >= 60%, ROC-AUC >= 65%,\nSHA-256 Manifest)", icon("githubactions"))
            registry = S3("Amazon S3\n(models/v2.2.0/ registry)")
            ecr = ECR("Amazon ECR\n(:v2.2.0 container image)")

        with Cluster(**cluster("4. Real-Time Hybrid Inference (AWS Lambda)", GREEN, "#ebfbee")):
            http = APIGateway("API Gateway\nPOST /match/predict")
            ml = Lambda("ml-predict Lambda\n(Python 3.12 container)")
            engine = Custom("Hybrid Probability Engine\n(Par RPO + DP Chase + DLS)", icon("tb_brain"))

        viewers = Custom("Fans & Live Scoreboard\n(Real-time win probability %)", icon("tb_users"))

        data >> dvc >> edge("train", PURPLE) >> [sk, xgb]
        [sk, xgb] >> mlflow >> edge("champion model", ORANGE) >> gate
        gate >> edge("save artifact", ORANGE) >> registry
        gate >> Edge(label="docker push", color=ORANGE, fontcolor=ORANGE) >> ecr
        viewers >> edge("ball update", GREEN) >> http >> ml
        ecr >> edge("container image", GREEN, "dashed") >> ml
        registry >> edge("checksum-verified model", GREEN, "dashed") >> ml
        ml >> edge("evaluate", GREEN) >> engine


if __name__ == "__main__":
    platform_overview()
    live_scoring()
    ai_assistant()
    mlops()
    print(f"Diagrams written to {OUT}")
