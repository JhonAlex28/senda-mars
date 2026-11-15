"""Adaptador de salida: registro de la misión en una base de datos SQL.

Implementa los puertos PlanRepository, CrewRepository y ProcedureRepository con SQLAlchemy
Core, así que el mismo código sirve para:
  - SQLite (un archivo, sin instalar nada) en desarrollo: sqlite:///data/senda.db
  - Postgres en la nube (Neon, Supabase…): postgresql+psycopg://usuario:clave@host/db

Las tablas se crean solas al arrancar. Los planes guardan su contenido como JSON (texto), que
funciona igual en ambos motores."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (Column, DateTime, Integer, MetaData, String, Table, Text, create_engine,
                        delete, insert, select, update)
from sqlalchemy.engine import Engine

from senda.domain.models.mission_log import Crew, CrewMember, ProcedureRecord, SavedPlan

metadata = MetaData()

plans = Table(
    "plans", metadata,
    Column("id", String(36), primary_key=True),
    Column("title", String(120), nullable=False),
    Column("sol", Integer, nullable=False, index=True),
    Column("site_id", String(40), nullable=False),
    Column("status", String(12), nullable=False),
    Column("created_by", String(20)),
    Column("summary", Text, nullable=False),
    Column("payload", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

crew = Table(
    "crew", metadata,
    Column("id", Integer, primary_key=True),          # una sola fila (id = 1)
    Column("data", Text, nullable=False),
)

procedures = Table(
    "procedures", metadata,
    Column("id", String(36), primary_key=True),
    Column("site_id", String(40), nullable=False, index=True),
    Column("target_id", String(20), nullable=False),
    Column("crew_member", String(20)),
    Column("plan_id", String(36)),
    Column("completed_at", DateTime(timezone=True), nullable=False),
)


def normalize_url(url: str) -> str:
    """Neon/Render/Heroku dan "postgres://"; SQLAlchemy con psycopg 3 necesita otro prefijo."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


def _utc(value: datetime | None) -> datetime:
    value = value or datetime.now(timezone.utc)
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class SqlMissionStore:
    def __init__(self, url: str, engine: Engine | None = None) -> None:
        self.url = normalize_url(url)
        self._engine = engine or create_engine(self.url, future=True, pool_pre_ping=True)
        metadata.create_all(self._engine)

    @property
    def backend(self) -> str:
        return self._engine.dialect.name   # "sqlite" | "postgresql"

    # ---------- planes ----------

    def find(self, sol: int | None = None) -> list[SavedPlan]:
        query = select(plans).order_by(plans.c.sol, plans.c.updated_at.desc())
        if sol is not None:
            query = query.where(plans.c.sol == sol)
        with self._engine.connect() as conn:
            return [_plan(row) for row in conn.execute(query).mappings()]

    def get(self, plan_id: str) -> SavedPlan | None:
        with self._engine.connect() as conn:
            row = conn.execute(select(plans).where(plans.c.id == plan_id)).mappings().first()
        return _plan(row) if row else None

    def save(self, plan: SavedPlan) -> SavedPlan:
        values = {"title": plan.title, "sol": plan.sol, "site_id": plan.site_id,
                  "status": plan.status, "created_by": plan.created_by,
                  "summary": json.dumps(plan.summary, ensure_ascii=False),
                  "payload": json.dumps(plan.payload, ensure_ascii=False),
                  "created_at": _utc(plan.created_at), "updated_at": _utc(plan.updated_at)}
        with self._engine.begin() as conn:
            exists = conn.execute(select(plans.c.id).where(plans.c.id == plan.id)).first()
            if exists:
                values.pop("created_at")
                conn.execute(update(plans).where(plans.c.id == plan.id).values(**values))
            else:
                conn.execute(insert(plans).values(id=plan.id, **values))
        saved = self.get(plan.id)
        assert saved is not None
        return saved

    def delete(self, plan_id: str) -> bool:
        with self._engine.begin() as conn:
            return conn.execute(delete(plans).where(plans.c.id == plan_id)).rowcount > 0

    # ---------- tripulación ----------

    def get_crew(self) -> Crew | None:
        with self._engine.connect() as conn:
            row = conn.execute(select(crew.c.data).where(crew.c.id == 1)).first()
        if not row:
            return None
        data = json.loads(row[0])
        return Crew(data["team_name"], tuple(CrewMember(**m) for m in data["members"]))

    def save_crew(self, value: Crew) -> Crew:
        data = json.dumps({"team_name": value.team_name,
                           "members": [m.__dict__ for m in value.members]}, ensure_ascii=False)
        with self._engine.begin() as conn:
            if conn.execute(select(crew.c.id).where(crew.c.id == 1)).first():
                conn.execute(update(crew).where(crew.c.id == 1).values(data=data))
            else:
                conn.execute(insert(crew).values(id=1, data=data))
        return value

    # ---------- procedimientos ----------

    def find_procedures(self, site_id: str | None = None) -> list[ProcedureRecord]:
        query = select(procedures).order_by(procedures.c.completed_at)
        if site_id:
            query = query.where(procedures.c.site_id == site_id)
        with self._engine.connect() as conn:
            return [ProcedureRecord(r["id"], r["site_id"], r["target_id"], _utc(r["completed_at"]),
                                    r["crew_member"], r["plan_id"])
                    for r in conn.execute(query).mappings()]

    def add_procedure(self, record: ProcedureRecord) -> ProcedureRecord:
        with self._engine.begin() as conn:
            conn.execute(insert(procedures).values(
                id=record.id, site_id=record.site_id, target_id=record.target_id,
                crew_member=record.crew_member, plan_id=record.plan_id,
                completed_at=_utc(record.completed_at)))
        return record


def _plan(row: Any) -> SavedPlan:
    return SavedPlan(row["id"], row["title"], row["sol"], row["site_id"], row["status"],
                     row["created_by"], json.loads(row["summary"]), json.loads(row["payload"]),
                     _utc(row["created_at"]), _utc(row["updated_at"]))


class CrewStore:
    """Vista CrewRepository sobre el mismo almacén (puerto con get/save)."""

    def __init__(self, store: SqlMissionStore) -> None:
        self._store = store

    def get(self) -> Crew | None:
        return self._store.get_crew()

    def save(self, value: Crew) -> Crew:
        return self._store.save_crew(value)


class ProcedureStore:
    """Vista ProcedureRepository sobre el mismo almacén."""

    def __init__(self, store: SqlMissionStore) -> None:
        self._store = store

    def find(self, site_id: str | None = None) -> list[ProcedureRecord]:
        return self._store.find_procedures(site_id)

    def add(self, record: ProcedureRecord) -> ProcedureRecord:
        return self._store.add_procedure(record)
