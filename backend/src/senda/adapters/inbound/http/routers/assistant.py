from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException

from senda.adapters.inbound.http.dependencies import assistant_settings, chat_uc
from senda.adapters.inbound.http.schemas import AssistantStatusOut, ChatIn, ChatOut
from senda.application.assistant.tools import MissionContext
from senda.application.use_cases.assistant import ChatTurn, ChatWithAssistant
from senda.config import Settings
from senda.domain.errors import AssistantUnavailable

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.get("/status", response_model=AssistantStatusOut)
def status(s: Settings = Depends(assistant_settings)) -> AssistantStatusOut:
    """El frontend oculta el panel de chat si el asistente no está configurado."""
    return AssistantStatusOut(enabled=s.assistant_enabled,
                              model=s.llm_model if s.assistant_enabled else None)


@router.post("/chat", response_model=ChatOut)
def chat(body: ChatIn,
         build: Callable[[MissionContext], ChatWithAssistant] | None = Depends(chat_uc)
         ) -> ChatOut:
    """Orden al asistente: ejecuta los mismos casos de uso que la interfaz y devuelve el
    plan y los cambios de vista para aplicarlos en la pantalla del usuario."""
    if build is None:
        raise HTTPException(status_code=503, detail="Assistant is not configured")
    if body.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="The last message must come from the user")
    try:
        history = [ChatTurn(m.role, m.content) for m in body.messages]
        reply = build(body.mission.to_context()).execute(history)
    except AssistantUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return ChatOut.from_domain(reply)
