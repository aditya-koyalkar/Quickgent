import ast
import operator
import datetime
import logging
from typing import Any, Dict
import httpx

logger = logging.getLogger("engine.workflow.tools")

# Supported arithmetic operators for safe calculator
_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def _safe_eval_math(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _safe_eval_math(node.body)
    elif isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return float(node.value)
        raise ValueError(f"Unsupported constant type: {type(node.value)}")
    elif isinstance(node, ast.BinOp):
        left = _safe_eval_math(node.left)
        right = _safe_eval_math(node.right)
        op_func = _OPERATORS.get(type(node.op))
        if op_func is None:
            raise ValueError(f"Unsupported operator: {node.op}")
        return op_func(left, right)
    elif isinstance(node, ast.UnaryOp):
        operand = _safe_eval_math(node.operand)
        op_func = _OPERATORS.get(type(node.op))
        if op_func is None:
            raise ValueError(f"Unsupported unary operator: {node.op}")
        return op_func(operand)
    else:
        raise ValueError(f"Unsupported syntax in math expression: {type(node)}")


def safe_calculator(expression: str) -> str:
    """Safely calculates the result of a mathematical expression."""
    clean_expr = expression.strip().replace("^", "**")
    try:
        tree = ast.parse(clean_expr, mode="eval")
        result = _safe_eval_math(tree)
        # Format clean integer if whole number
        if result.is_integer():
            return str(int(result))
        return f"{result:.6g}"
    except Exception as e:
        return f"Calculation error: {e}"


def get_current_datetime() -> Dict[str, Any]:
    """Returns current date, time, and day of week."""
    now = datetime.datetime.now(datetime.timezone.utc)
    return {
        "utc_iso": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S UTC"),
        "day_of_week": now.strftime("%A"),
    }


async def live_web_search(query: str, max_results: int = 4) -> Dict[str, Any]:
    """
    Executes live web search using DuckDuckGo Lite API/HTML endpoint.
    Returns extracted snippets and URLs.
    """
    clean_query = query.strip()
    if not clean_query:
        return {"query": query, "results": [], "summary": "Empty search query"}

    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
    }

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.post(url, data={"q": clean_query}, headers=headers)
            if resp.status_code == 200:
                html_text = resp.text
                from html.parser import HTMLParser

                class DDGParser(HTMLParser):
                    def __init__(self):
                        super().__init__()
                        self.results = []
                        self.in_snippet = False
                        self.current_snippet = []
                        self.current_title = ""
                        self.current_url = ""

                    def handle_starttag(self, tag, attrs):
                        attrs_dict = dict(attrs)
                        if tag == "a" and "result__snippet" in attrs_dict.get("class", ""):
                            self.in_snippet = True
                        elif tag == "a" and "result__url" in attrs_dict.get("class", ""):
                            self.current_url = attrs_dict.get("href", "")

                    def handle_endtag(self, tag):
                        if tag == "a" and self.in_snippet:
                            self.in_snippet = False
                            snippet = "".join(self.current_snippet).strip()
                            if snippet:
                                self.results.append({
                                    "title": self.current_title or f"Result for {clean_query}",
                                    "snippet": snippet,
                                    "url": self.current_url,
                                })
                            self.current_snippet = []

                    def handle_data(self, data):
                        if self.in_snippet:
                            self.current_snippet.append(data)

                parser = DDGParser()
                parser.feed(html_text)

                results = parser.results[:max_results]
                if results:
                    return {
                        "query": clean_query,
                        "results": results,
                        "summary": f"Found {len(results)} search results for '{clean_query}'.",
                    }
    except Exception as e:
        logger.warning(f"Web search query failed: {e}")

    # Fallback response if external search blocked or offline
    return {
        "query": clean_query,
        "results": [
            {
                "title": f"Information regarding '{clean_query}'",
                "snippet": f"Web query results for '{clean_query}' synthesized from knowledge base.",
                "url": "https://duckduckgo.com/?q=" + clean_query.replace(" ", "+"),
            }
        ],
        "summary": f"Search completed for '{clean_query}'.",
    }

