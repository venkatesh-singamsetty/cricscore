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


def edge(label: str, color: str, style: str = "bold") -> Edge:
    return Edge(label=label, color=color, fontcolor=color, style=style)


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

        with Cluster(**cluster("2. Sign in & call APIs", ORANGE, "#fff4e6")):
            auth = Cognito("Cognito\nJWT tokens")
            http = APIGateway("API Gateway\nHTTP API")
            ws = APIGateway("API Gateway\nWebSocket API")

        with Cluster(**cluster("3. Serverless compute (AWS Lambda)", ORANGE, "#fffaf0")):
            match_api = Lambda("match-api\nmatches & admin")
            chat = Lambda("chat-api\nAI assistant")
            score = Lambda("score-update\nlive balls")
            ml = Lambda("ml-predict\nwin probability")

        with Cluster(**cluster("4. Data & Persistence", GREEN, "#ebfbee")):
            pg = Custom("Aiven PostgreSQL 16\n+ pgvector", icon("postgresql"))
            llm = Custom("OpenAI-compatible\nLLM provider", icon("openai"))
            backups = S3("S3\nmatch backups")
            mail = SES("SES\nmatch report emails")

        with Cluster(**cluster("5. Observability & Alarms", GREY, "#f8f9fa")):
            logs = Cloudwatch("CloudWatch Logs\n(7-day retention)")
            alarms = Cloudwatch("CloudWatch Alarms\n(error rate triggers)")

        users >> edge("open site", BLUE) >> dns >> cdn >> site
        users >> edge("sign in", ORANGE) >> auth
        users >> edge("REST calls + JWT", ORANGE) >> http
        ws >> edge("live score push", GREEN) >> users

        http >> match_api
        http >> score
        http >> chat
        http >> ml

        match_api >> pg
        match_api >> backups
        match_api >> mail
        score >> edge("fan-out (diagram 2)", GREEN, "dashed") >> ws
        score >> edge("persist", GREEN, "dashed") >> pg
        chat >> edge("read-only SQL + vector", PURPLE) >> pg
        chat >> edge("tool calling", PURPLE) >> llm

        # All Lambda compute functions stream logs and wire to CloudWatch Alarms
        for fn in [match_api, score, chat, ml]:
            fn >> Edge(color=GREY, style="dotted") >> logs
        match_api >> Edge(color=RED, style="dotted") >> alarms
        score >> Edge(color=RED, style="dotted") >> alarms


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
        "Agentic AI Architecture: Autonomous Specialist Agents & MCP",
        filename=str(OUT / "03_ai_assistant"),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=GRAPH,
        node_attr=NODE,
        edge_attr=EDGE,
    ):
        fan = Custom("Fan asks a question\n(chat widget)", icon("tb_message-chatbot"))
        http = APIGateway("API Gateway\nPOST /chat")

        with Cluster(**cluster("Autonomous Multi-Agent System (chat-api Lambda)", PURPLE, "#f3f0ff")):
            guard = Custom("Security Guardrails\nread-only, sanitized history,\n1-issue rate guard", icon("tb_shield-lock"))
            supervisor = Custom("Agent Supervisor\n& MCP Orchestrator", icon("tb_robot"))

            with Cluster(**cluster("Specialist AI Agents (Domain-Bounded MCP Tools)", PURPLE, "#ffffff")):
                match_agent = Custom("Match Stats Agent\n(Autonomous Text-to-SQL)", icon("tb_database-search"))
                rules_agent = Custom("Tournament Rules Agent\n(Vector RAG + pgvector)", icon("tb_brain"))
                weather_agent = Custom("Weather Specialist Agent\n(Open-Meteo & DLS Impact)", icon("tb_cloud-rain"))
                issue_agent = Custom("Issue Reporter Agent\n(GitHub Tracker Integration)", icon("github"))

        llm = Custom("OpenAI-compatible LLM\n(Autonomous tool selection)", icon("openai"))

        with Cluster(**cluster("Knowledge Stores & External APIs", GREEN, "#ebfbee")):
            pg_rel = Custom("Aiven PostgreSQL 16\n(Live & historical matches)", icon("postgresql"))
            pg_vec = Custom("pgvector Store\n(PDF rulebook embeddings)", icon("postgresql"))
            meteo = Custom("Open-Meteo API\n(Free global hourly forecast)", icon("openmeteo"))
            gh = Custom("GitHub Issues API\n(Bug & feature tracking)", icon("github"))

        fan >> Edge(label="1 ask  /  5 answer", color=PURPLE, fontcolor=PURPLE, style="bold", dir="both") >> http
        http >> edge("2 request", PURPLE) >> guard >> supervisor
        supervisor >> Edge(label="3 autonomous routing", color=PURPLE, fontcolor=PURPLE, style="bold", dir="both") >> llm
        supervisor >> edge("4 delegate", PURPLE) >> [match_agent, rules_agent, weather_agent, issue_agent]
        match_agent >> edge("read-only SQL", GREEN) >> pg_rel
        rules_agent >> edge("cosine search", GREEN) >> pg_vec
        weather_agent >> edge("hourly forecast", GREEN) >> meteo
        issue_agent >> edge("create issue", GREEN) >> gh


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
            dvc = Custom("DVC Dataset Tracking\n(cricket-data/t20s_json.dvc)", icon("dvc"))

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
        gate >> registry
        gate >> Edge(label="docker push", color=ORANGE, fontcolor=ORANGE) >> ecr
        viewers >> edge("ball update", GREEN) >> http >> ml
        ecr >> edge("container image", GREEN, "dashed") >> ml
        registry >> edge("checksum-verified model", GREEN, "dashed") >> ml
        ml >> engine


if __name__ == "__main__":
    platform_overview()
    live_scoring()
    ai_assistant()
    mlops()
    print(f"Diagrams written to {OUT}")
