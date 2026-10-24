"""The Forbidden API: PostgreSQL-backed card inventory and limited card draws.

Required environment variables: DATABASE_URL and BOT_TOKEN.
Run with: uvicorn app:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import random
import time
from urllib.parse import parse_qsl

import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
APP_ORIGIN = os.getenv("APP_ORIGIN", "https://bigboss020022-sudo.github.io").rstrip("/")

app = FastAPI(title="The Forbidden API", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[APP_ORIGIN],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Telegram-Init-Data"],
)

# Demonstration draw weights. "Мечта" is globally capped at ten issued copies.
CARD_DEFS = [
    ("Крестьянин", "Обычные", 4200, None),
    ("Воин", "Обычные", 2200, None),
    ("Фермер", "Обычные", 1400, None),
    ("Кузнец", "Обычные", 1000, None),
    ("Пекарь", "Обычные", 700, None),
    ("Торговец", "Обычные", 400, None),
    ("Король", "Особые", 350, None),
    ("Королева", "Особые", 300, None),
    ("Рыцарь", "Обычные", 650, None),
    ("Авел", "Обычные", 450, None),
    ("Каин", "Обычные", 450, None),
    ("Мечта", "MYTHIC", 100, 10),
    ("Безумие", "MYTHIC", 25, None),
    ("Шут", "Особые", 250, None),
    ("Смерть", "Всадники", 90, None),
    ("Чума", "Всадники", 90, None),
    ("Война", "Всадники", 90, None),
    ("Голод", "Всадники", 90, None),
    ("Дружба", "Особые", 0, None),
    ("Одержимость", "Особые", 0, None),
    ("Королевство", "Особые", 0, None),
]

RECIPES = {
    "Королевство": {"Крестьянин": 20, "Король": 1, "Королева": 1, "Рыцарь": 1},
    "Дружба": {"Авел": 1, "Каин": 1},
    "Одержимость": {"Мечта": 1, "Безумие": 1},
}


def get_db():
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="Server DATABASE_URL is not configured")
    try:
        return psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=10)
    except Exception:
        raise HTTPException(status_code=503, detail="Database connection failed")


def init_db():
    if not DATABASE_URL:
        return
    with psycopg.connect(DATABASE_URL, connect_timeout=10) as con:
        with con.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS card_defs (
                    name TEXT PRIMARY KEY,
                    rarity TEXT NOT NULL,
                    weight INTEGER NOT NULL CHECK (weight >= 0),
                    max_copies INTEGER NULL CHECK (max_copies IS NULL OR max_copies >= 0),
                    issued_copies INTEGER NOT NULL DEFAULT 0 CHECK (issued_copies >= 0),
                    CHECK (max_copies IS NULL OR issued_copies <= max_copies)
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS card_instances (
                    serial BIGSERIAL PRIMARY KEY,
                    card_name TEXT NOT NULL REFERENCES card_defs(name),
                    owner_id TEXT NOT NULL,
                    zone TEXT NOT NULL DEFAULT 'deck' CHECK (zone IN ('deck', 'taboo')),
                    obtained_at BIGINT NOT NULL
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_instances_owner ON card_instances(owner_id, zone)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_instances_card ON card_instances(card_name)")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS starter_grants (
                    owner_id TEXT PRIMARY KEY,
                    granted_at BIGINT NOT NULL
                )
            """)
            for name, rarity, weight, max_copies in CARD_DEFS:
                cur.execute(
                    """INSERT INTO card_defs(name, rarity, weight, max_copies)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (name) DO UPDATE SET
                         rarity = EXCLUDED.rarity,
                         weight = EXCLUDED.weight,
                         max_copies = CASE
                           WHEN card_defs.name = 'Мечта' THEN 10
                           ELSE card_defs.max_copies
                         END""",
                    (name, rarity, weight, max_copies),
                )


@app.on_event("startup")
def startup():
    init_db()


def validate_init_data(raw: str) -> dict:
    if not BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Server BOT_TOKEN is not configured")
    if not raw:
        raise HTTPException(status_code=401, detail="Open this app through Telegram")
    try:
        pairs = dict(parse_qsl(raw, keep_blank_values=True, strict_parsing=False))
        received_hash = pairs.pop("hash", None)
        if not received_hash:
            raise ValueError("missing hash")
        now = int(time.time())
        auth_date = int(pairs.get("auth_date", "0") or 0)
        if auth_date <= 0 or now - auth_date > 86400 or auth_date - now > 60:
            raise HTTPException(status_code=401, detail="Telegram session expired; reopen the Mini App")
        data_check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
        secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        expected = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, received_hash):
            raise HTTPException(status_code=401, detail="Telegram signature check failed. Check that Render BOT_TOKEN matches the token for the bot that owns this Mini App, then reopen it in Telegram.")
        user = json.loads(pairs["user"])
        return {"id": str(user["id"]), "first_name": user.get("first_name", "Player")}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Telegram user data is invalid")


def require_user(x_telegram_init_data: str | None):
    return validate_init_data(x_telegram_init_data or "")


@app.get("/health")
def health():
    # Report configuration presence only; never expose secrets.
    return {
        "ok": True,
        "service": "The Forbidden API",
        "version": app.version,
        "config": {
            "bot_token_configured": bool(BOT_TOKEN),
            "database_url_configured": bool(DATABASE_URL),
        },
    }


@app.get("/api/catalog")
def catalog():
    return {
        "cards": [
            {"name": name, "rarity": rarity, "weight": weight, "max_copies": cap}
            for name, rarity, weight, cap in CARD_DEFS
        ],
        "recipes": RECIPES,
    }


def grant_beta_starter_cards(con, owner_id: str):
    """Grant one Madness and one random positive-weight card once per player."""
    granted = con.execute(
        """INSERT INTO starter_grants(owner_id, granted_at) VALUES (%s, %s)
           ON CONFLICT (owner_id) DO NOTHING RETURNING owner_id""",
        (owner_id, int(time.time())),
    ).fetchone()
    if not granted:
        return

    starter_names = ["Безумие"]
    candidates = con.execute(
        """SELECT name FROM card_defs
           WHERE name <> 'Безумие' AND weight > 0
             AND (max_copies IS NULL OR issued_copies < max_copies)"""
    ).fetchall()
    if candidates:
        starter_names.append(random.choice(candidates)["name"])

    for card_name in starter_names:
        updated = con.execute(
            "UPDATE card_defs SET issued_copies = issued_copies + 1 WHERE name = %s RETURNING name",
            (card_name,),
        ).fetchone()
        if updated:
            con.execute(
                """INSERT INTO card_instances(card_name, owner_id, zone, obtained_at)
                   VALUES (%s, %s, 'deck', %s)""",
                (card_name, owner_id, int(time.time())),
            )


@app.get("/api/me/cards")
def my_cards(x_telegram_init_data: str | None = Header(default=None)):
    user = require_user(x_telegram_init_data)
    with get_db() as con:
        grant_beta_starter_cards(con, user["id"])
        rows = con.execute(
            """SELECT i.serial, i.card_name, i.zone, i.obtained_at, d.rarity, d.max_copies
               FROM card_instances i JOIN card_defs d ON d.name = i.card_name
               WHERE i.owner_id = %s ORDER BY i.serial""",
            (user["id"],),
        ).fetchall()
    return {"user": user, "cards": rows}


@app.post("/api/draw")
def draw_card(x_telegram_init_data: str | None = Header(default=None)):
    user = require_user(x_telegram_init_data)
    try:
        with get_db() as con:
            # Lock all definitions in a consistent order so simultaneous draws cannot exceed a global cap.
            rows = con.execute(
                """SELECT name, rarity, weight, max_copies, issued_copies
                   FROM card_defs
                   WHERE max_copies IS NULL OR issued_copies < max_copies
                   ORDER BY name FOR UPDATE"""
            ).fetchall()
            if not rows:
                raise HTTPException(status_code=409, detail="No cards are available right now")
            total = sum(int(row["weight"]) for row in rows)
            if total <= 0:
                raise HTTPException(status_code=503, detail="No available cards have a positive draw weight")
            point = random.randrange(total)
            chosen = rows[0]
            for row in rows:
                point -= int(row["weight"])
                if point < 0:
                    chosen = row
                    break
            updated = con.execute(
                """UPDATE card_defs SET issued_copies = issued_copies + 1
                   WHERE name = %s AND (max_copies IS NULL OR issued_copies < max_copies)
                   RETURNING issued_copies""",
                (chosen["name"],),
            ).fetchone()
            if not updated:
                raise HTTPException(status_code=409, detail="Card limit reached; please try again")
            instance = con.execute(
                """INSERT INTO card_instances(card_name, owner_id, zone, obtained_at)
                   VALUES (%s, %s, 'deck', %s) RETURNING serial""",
                (chosen["name"], user["id"], int(time.time())),
            ).fetchone()
            return {"ok": True, "card": {
                "name": chosen["name"], "rarity": chosen["rarity"],
                "serial": int(instance["serial"]), "max_copies": chosen["max_copies"],
                "issued_copies": int(updated["issued_copies"]),
            }, "message": "Card granted"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Card draw failed safely; no card was granted")


class MoveRequest(BaseModel):
    serial: int = Field(gt=0)
    zone: str


@app.post("/api/me/card-zone")
def move_card(body: MoveRequest, x_telegram_init_data: str | None = Header(default=None)):
    user = require_user(x_telegram_init_data)
    if body.zone not in {"deck", "taboo"}:
        raise HTTPException(status_code=400, detail="zone must be deck or taboo")
    with get_db() as con:
        row = con.execute(
            """UPDATE card_instances SET zone = %s
               WHERE serial = %s AND owner_id = %s RETURNING serial, zone""",
            (body.zone, body.serial, user["id"]),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Card instance not found for this player")
    return {"ok": True, "serial": int(row["serial"]), "zone": row["zone"]}


class CraftRequest(BaseModel):
    ingredients: dict[str, int]


@app.post("/api/craft")
def craft_card(body: CraftRequest, x_telegram_init_data: str | None = Header(default=None)):
    user = require_user(x_telegram_init_data)
    ingredients = body.ingredients
    if not ingredients or any(not isinstance(qty, int) or qty <= 0 for qty in ingredients.values()):
        raise HTTPException(status_code=400, detail="Ingredients must be positive integer quantities")
    recipe = next((
        (name, required) for name, required in RECIPES.items()
        if ingredients == required
    ), None)
    if recipe is None:
        raise HTTPException(status_code=400, detail="Unknown recipe; no cards were consumed")
    output_name, required = recipe
    try:
        with get_db() as con:
            # Lock this player's inventory and verify every exact copy before consuming anything.
            rows = con.execute(
                """SELECT serial, card_name FROM card_instances
                   WHERE owner_id = %s AND zone = 'deck'
                   ORDER BY serial FOR UPDATE""",
                (user["id"],),
            ).fetchall()
            by_name = {}
            for row in rows:
                by_name.setdefault(row["card_name"], []).append(int(row["serial"]))
            if any(len(by_name.get(name, [])) < qty for name, qty in required.items()):
                raise HTTPException(status_code=409, detail="Not enough ingredients in your deck")
            consumed = [serial for name, qty in required.items() for serial in by_name[name][:qty]]
            con.execute(
                "DELETE FROM card_instances WHERE owner_id = %s AND serial = ANY(%s)",
                (user["id"], consumed),
            )
            new_card = con.execute(
                """INSERT INTO card_instances(card_name, owner_id, zone, obtained_at)
                   VALUES (%s, %s, 'deck', %s) RETURNING serial""",
                (output_name, user["id"], int(time.time())),
            ).fetchone()
            return {"ok": True, "card": {"name": output_name, "serial": int(new_card["serial"]), "rarity": "Особые"}}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Craft failed safely; try again")
