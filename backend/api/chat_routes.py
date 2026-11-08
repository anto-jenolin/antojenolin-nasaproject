"""
TerraPulse AI — Chat Routes (AI Copilot)
Server-side LLM integration. API key never exposed to frontend.
"""

from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth import get_current_user
from database import User
from services.chat_service import (
    chat_completion, get_provider_status, test_connection
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[Dict[str, Any]] = None
    stream: bool = True


@router.get("/status")
async def provider_status(current_user: User = Depends(get_current_user)):
    """Return LLM provider configuration status. Never exposes the API key."""
    return get_provider_status()


@router.post("/test")
async def test_provider(current_user: User = Depends(get_current_user)):
    """Test the LLM provider with a real minimal request."""
    result = await test_connection()
    return result


@router.post("/message")
async def chat(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a message to the LLM and stream the response."""
    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    if body.stream:
        async def event_stream():
            async for chunk in chat_completion(messages, body.context, stream=True):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )
    else:
        full_response = ""
        async for chunk in chat_completion(messages, body.context, stream=False):
            full_response += chunk
        return {"response": full_response}
