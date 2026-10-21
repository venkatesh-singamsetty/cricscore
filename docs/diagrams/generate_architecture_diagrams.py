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
            score = Lambda("score-update\nlive balls")
            chat = Lambda("chat-api\nAI assistant")
            ml = Lambda("ml-predict\nwin probability")

        with Cluster(**cluster("4. Data & services", GREEN, "#ebfbee")):
            pg = Custom("Aiven PostgreSQL 16\n+ pgvector", icon("postgresql"))
            backups = S3("S3\nmatch backups")
            mail = SES("SES\nmatch report emails")
            llm = Custom("OpenAI-compatible\nLLM provider", icon("openai"))

        logs = Cloudwatch("CloudWatch\nlogs (7 days) + alarms")

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
        chat >> edge("read-only", PURPLE) >> pg
        chat >> edge("tool calling", PURPLE) >> llm
        ml >> Edge(color=GREY, style="dotted", label="all Lambdas log here", fontcolor=GREY) >> logs


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
            pg = Custom("Aiven PostgreSQL\nmatches / innings / balls", icon("aiven"))

        scorer >> edge("1", ORANGE) >> http >> edge("2", ORANGE) >> producer
        producer >> edge("3a publish", BLUE) >> sns >> edge("4a", BLUE) >> broadcaster
        broadcaster >> edge("5a who is online?", BLUE) >> conns
        broadcaster >> edge("6a push", BLUE) >> ws >> edge("7a", BLUE) >> viewers
        producer >> edge("3b enqueue", GREEN) >> sqs >> edge("4b batch", GREEN) >> worker
        worker >> edge("5b write", GREEN) >> pg


# ---------------------------------------------------------------------------
# 3. AI assistant
# ---------------------------------------------------------------------------
def ai_assistant() -> None:
    with Diagram(
        "AI Assistant: Read-Only Agent with MCP Tools",
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

        with Cluster(**cluster("chat-api Lambda (Node.js)", PURPLE, "#f3f0ff")):
            guard = Custom("Guardrails\nread-only, clean history,\n1 issue per message", icon("tb_shield-lock"))
            agent = Custom("Agent loop\n(MCP client)", icon("tb_robot"))
            with Cluster(**cluster("MCP tools (in-memory server)", PURPLE, "#ffffff")):
                sql = Custom("execute_sql\nSELECT only", icon("tb_database-search"))
                rules = Custom("search_tournament_rules\nvector RAG", icon("tb_brain"))
                weather = Custom("get_match_weather", icon("tb_cloud-rain"))
                issue = Custom("create_github_issue", icon("github"))

        llm = Custom("OpenAI-compatible LLM\n(decides which tool)", icon("openai"))

        with Cluster(**cluster("Data sources", GREEN, "#ebfbee")):
            pg = Custom("Aiven PostgreSQL\nmatches + pgvector rules", icon("postgresql"))
            meteo = Custom("Open-Meteo\nfree forecast", icon("openmeteo"))
            gh = Custom("GitHub Issues", icon("github"))

        fan >> Edge(label="1 ask  /  5 answer", color=PURPLE, fontcolor=PURPLE, style="bold", dir="both") >> http
        http >> edge("2", PURPLE) >> guard >> agent
        agent >> Edge(label="3 which tool?", color=PURPLE, fontcolor=PURPLE, style="bold", dir="both") >> llm
        agent >> edge("4 call tool", PURPLE) >> [sql, rules, weather, issue]
        sql >> edge("read-only", GREEN) >> pg
        rules >> pg
        weather >> meteo
        issue >> gh


# ---------------------------------------------------------------------------
# 4. MLOps & win prediction
# ---------------------------------------------------------------------------
def mlops() -> None:
    with Diagram(
        "MLOps: From Ball-by-Ball Data to Live Win Probability",
        filename=str(OUT / "04_mlops_win_prediction"),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=GRAPH,
        node_attr=NODE,
        edge_attr=EDGE,
    ):
        with Cluster(**cluster("1. Data (versioned)", BLUE, "#eef4ff")):
            data = Custom("Cricsheet T20\nball-by-ball", icon("tb_chart-line"))
            dvc = Custom("DVC\ndataset versioning", icon("dvc"))

        with Cluster(**cluster("2. Train & compare 8 models", PURPLE, "#f3f0ff")):
            sk = Custom("scikit-learn\nbaselines", icon("scikitlearn"))
            xgb = Custom("XGBoost\nchampion", icon("xgboost"))
            mlflow = Custom("MLflow\nexperiment tracking", icon("mlflow"))

        with Cluster(**cluster("3. Gate & publish (GitHub Actions)", ORANGE, "#fff4e6")):
            gate = Custom("Quality gates\naccuracy + ROC-AUC\n+ SHA-256 manifest", icon("githubactions"))
            registry = S3("S3\nversioned model registry")
            ecr = ECR("ECR\ninference image")

        with Cluster(**cluster("4. Serve live", GREEN, "#ebfbee")):
            http = APIGateway("HTTP API\nPOST /match/predict")
            ml = Lambda("ml-predict Lambda\nPython 3.12 container")
            engine = Custom("Hybrid engine\nXGBoost + DP\nchase sim + DLS", icon("tb_brain"))

        viewers = Custom("Fans see live\nwin probability", icon("tb_users"))

        data >> dvc >> edge("train", PURPLE) >> [sk, xgb]
        [sk, xgb] >> mlflow >> edge("best model", ORANGE) >> gate
        gate >> registry
        gate >> Edge(label="docker build", color=ORANGE, fontcolor=ORANGE) >> ecr
        viewers >> edge("request", GREEN) >> http >> ml
        ecr >> edge("image", GREEN, "dashed") >> ml
        registry >> edge("checksum-verified model", GREEN, "dashed") >> ml
        ml >> engine


if __name__ == "__main__":
    platform_overview()
    live_scoring()
    ai_assistant()
    mlops()
    print(f"Diagrams written to {OUT}")
