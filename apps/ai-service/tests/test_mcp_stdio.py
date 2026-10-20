"""End-to-end: spawn the server over stdio and talk to it with the MCP client."""
import asyncio
import json
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[1]


async def _session_calls():
    params = StdioServerParameters(
        command=sys.executable,
        args=["-m", "cricscore_ai.mcp_server"],
        cwd=str(ROOT),
        env={"PATH": "", "PYTHONPATH": str(ROOT)},  # no DB/LLM credentials
    )
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            names = {t.name for t in (await s.list_tools()).tools}
            res = await s.call_tool("get_match_details", {"match_id": "11111111-1111-4111-8111-111111111111"})
            return names, res


def test_stdio_roundtrip_without_credentials():
    names, res = asyncio.run(asyncio.wait_for(_session_calls(), 30))
    assert "predict_match_outcome" in names and len(names) == 6
    text = json.dumps(res.model_dump(), default=str)
    assert "not configured" in text
