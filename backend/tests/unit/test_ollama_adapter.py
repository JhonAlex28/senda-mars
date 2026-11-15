"""El adaptador traduce la conversación neutral al formato de Ollama (servidor simulado)."""
import json

import httpx
import pytest

from senda.adapters.outbound.llm.ollama_model import OllamaAssistantModel
from senda.application.assistant.conversation import (AssistantMessage, ToolCall, ToolResult,
                                                      ToolResults, ToolSpec, UserMessage)
from senda.domain.errors import AssistantUnavailable


def _model(handler):
    client = httpx.Client(base_url="http://ollama", transport=httpx.MockTransport(handler))
    return OllamaAssistantModel("qwen3:4b", client=client)


def test_sends_tools_and_parses_tool_calls():
    seen = {}

    def handler(request):
        seen.update(json.loads(request.content))
        return httpx.Response(200, json={"message": {"role": "assistant", "content": "", "tool_calls": [
            {"function": {"name": "plan_eva", "arguments": {"target_ids": ["T03"]}}}]}})

    turn = _model(handler).next_turn("sys", [UserMessage("hola")],
                                     [ToolSpec("plan_eva", "d", {"type": "object"})])
    assert [(c.name, c.arguments) for c in turn.tool_calls] == [("plan_eva", {"target_ids": ["T03"]})]
    assert seen["messages"][0] == {"role": "system", "content": "sys"}
    assert seen["tools"][0]["function"]["name"] == "plan_eva"
    assert seen["stream"] is False


def test_tool_results_are_sent_by_tool_name():
    seen = {}

    def handler(request):
        seen.update(json.loads(request.content))
        return httpx.Response(200, json={"message": {"role": "assistant", "content": "Listo."}})

    history = [UserMessage("hola"), AssistantMessage("", (ToolCall("c1", "plan_eva", {}),)),
               ToolResults((ToolResult("c1", "boom", is_error=True),))]
    turn = _model(handler).next_turn("sys", history, [])
    assert turn.text == "Listo." and not turn.tool_calls
    assert seen["messages"][2]["tool_calls"][0]["function"]["name"] == "plan_eva"
    assert seen["messages"][3] == {"role": "tool", "tool_name": "plan_eva", "content": "ERROR: boom"}


def test_string_arguments_are_parsed():
    def handler(request):
        return httpx.Response(200, json={"message": {"content": "", "tool_calls": [
            {"function": {"name": "x", "arguments": '{"topic": "readiness"}'}}]}})

    turn = _model(handler).next_turn("sys", [UserMessage("?")], [])
    assert turn.tool_calls[0].arguments == {"topic": "readiness"}


def test_unreachable_server_raises_unavailable():
    def handler(request):
        raise httpx.ConnectError("refused")

    with pytest.raises(AssistantUnavailable):
        _model(handler).next_turn("sys", [UserMessage("?")], [])


EXPLAIN = ToolSpec("explain_system", "d", {"type": "object"})


def _replying(content):
    return _model(lambda request: httpx.Response(
        200, json={"message": {"role": "assistant", "content": content}}))


@pytest.mark.parametrize("content", [
    'explain_system\n{"topic": "readiness"}',
    '<tool_call>{"name": "explain_system", "arguments": {"topic": "readiness"}}</tool_call>',
    '<tool>\n{"name": "explain_system", "arguments": {"topic": "readiness"}}\n</tool>',
    '{"name": "explain_system", "arguments": {"topic": "readiness"}}',
])
def test_tool_call_written_as_text_is_recovered(content):
    turn = _replying(content).next_turn("sys", [UserMessage("hi")], [EXPLAIN])
    assert turn.text == ""
    assert [(c.name, c.arguments) for c in turn.tool_calls] == [
        ("explain_system", {"topic": "readiness"})]


def test_text_that_names_no_tool_stays_text():
    for content in ("hola", "fast"):
        turn = _replying(content).next_turn("sys", [UserMessage("hi")], [EXPLAIN])
        assert turn.text == content and not turn.tool_calls


def test_reachable_only_when_the_model_is_downloaded():
    tags = {"models": [{"name": "qwen3:4b"}]}
    assert _model(lambda r: httpx.Response(200, json=tags)).is_reachable()
    assert not _model(lambda r: httpx.Response(200, json={"models": []})).is_reachable()

    def down(request):
        raise httpx.ConnectError("refused")
    assert not _model(down).is_reachable()
