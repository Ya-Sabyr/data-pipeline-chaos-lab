"""
Reference Python + FastAPI backend that demonstrates the HTTP contract
chaoslab tests. Functionally equivalent to the Node Express example;
chaoslab does not care which language a backend is written in.

Run with:
    pip install -r requirements.txt
    uvicorn main:app --port 3001
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="chaoslab-example-python-fastapi-backend")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class CreateInvoiceRequest(BaseModel):
    invoice_id: str
    wallet_address: Optional[str] = None
    expected_amount: Optional[float] = None
    token_mint: Optional[str] = None


class Invoice(BaseModel):
    invoice_id: str
    wallet_address: Optional[str] = None
    expected_amount: Optional[float] = None
    token_mint: Optional[str] = None
    status: str = "pending"
    paid_tx_signature: Optional[str] = None
    paid_at: Optional[str] = None
    created_at: str


class IncomingEvent(BaseModel):
    event_id: Optional[str] = None
    tx_signature: str
    slot: Optional[int] = None
    event_type: Optional[str] = None
    invoice_id: Optional[str] = None
    wallet_address: Optional[str] = None
    amount: Optional[float] = None
    token_mint: Optional[str] = None
    timestamp: Optional[str] = None


class EventRecord(BaseModel):
    event_id: str
    tx_signature: str
    invoice_id: str
    amount: float
    outcome: str
    reason: Optional[str] = None
    received_at: str


invoices: dict[str, Invoice] = {}
events_by_signature: dict[str, EventRecord] = {}
events: list[EventRecord] = []


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "name": "chaoslab-example-python-fastapi-backend"}


@app.post("/admin/reset")
def reset() -> dict[str, bool]:
    invoices.clear()
    events_by_signature.clear()
    events.clear()
    return {"reset": True}


@app.post("/invoices", status_code=201)
def create_invoice(payload: CreateInvoiceRequest) -> Invoice:
    if payload.invoice_id in invoices:
        raise HTTPException(status_code=409, detail="invoice already exists")
    invoice = Invoice(
        invoice_id=payload.invoice_id,
        wallet_address=payload.wallet_address,
        expected_amount=payload.expected_amount,
        token_mint=payload.token_mint,
        status="pending",
        created_at=_now_iso(),
    )
    invoices[payload.invoice_id] = invoice
    return invoice


@app.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: str) -> Invoice:
    inv = invoices.get(invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="not found")
    return inv


@app.post("/webhooks/solana")
def receive_webhook(evt: IncomingEvent) -> dict[str, object]:
    now = _now_iso()
    event_id = evt.event_id or f"auto_{int(datetime.now().timestamp() * 1000)}_{len(events)}"
    invoice_id = evt.invoice_id or ""
    amount = float(evt.amount) if evt.amount is not None else 0.0

    if evt.tx_signature in events_by_signature:
        dupe = EventRecord(
            event_id=event_id,
            tx_signature=evt.tx_signature,
            invoice_id=invoice_id,
            amount=amount,
            outcome="duplicate",
            reason="tx_signature already seen",
            received_at=now,
        )
        events.append(dupe)
        return {"processed": False, "reason": "duplicate", "event_id": dupe.event_id}

    invoice = invoices.get(invoice_id) if invoice_id else None
    if invoice is None:
        ignored = EventRecord(
            event_id=event_id,
            tx_signature=evt.tx_signature,
            invoice_id=invoice_id,
            amount=amount,
            outcome="ignored",
            reason="unknown_invoice",
            received_at=now,
        )
        events.append(ignored)
        events_by_signature[evt.tx_signature] = ignored
        return {"processed": False, "reason": "unknown_invoice", "event_id": ignored.event_id}

    processed = EventRecord(
        event_id=event_id,
        tx_signature=evt.tx_signature,
        invoice_id=invoice_id,
        amount=amount,
        outcome="processed",
        received_at=now,
    )
    events.append(processed)
    events_by_signature[evt.tx_signature] = processed
    invoice.status = "paid"
    invoice.paid_tx_signature = evt.tx_signature
    invoice.paid_at = now
    return {"processed": True, "event_id": processed.event_id}


@app.get("/events")
def list_events() -> dict[str, object]:
    return {"events": [e.model_dump() for e in events], "total": len(events)}


@app.get("/events/summary")
def events_summary() -> dict[str, int]:
    processed = sum(1 for e in events if e.outcome == "processed")
    duplicate = sum(1 for e in events if e.outcome == "duplicate")
    ignored = sum(1 for e in events if e.outcome == "ignored")
    return {
        "total_events": len(events),
        "processed_events": processed,
        "duplicate_events": duplicate,
        "ignored_events": ignored,
    }
