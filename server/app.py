"""The Forbidden API prototype: SQLite inventory + globally limited random draws.
Run with: uvicorn app:app --host 0.0.0.0 --port 8000
Set BOT_TOKEN before exposing this service publicly.
"""
from __future__ import annotations
import hashlib, hmac, json, os, random, sqlite3, time
from urllib.parse import parse_qsl
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = os.getenv("FORBIDDEN_DB", "forbidden.db")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
APP_ORIGIN = os.getenv("APP_ORIGIN", "https://bigboss020022-sudo.github.io")
app = FastAPI(title="The Forbidden API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=[APP_ORIGIN, APP_ORIGIN + "/the-forbidden-game"], allow_credentials=False, allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type", "X-Telegram-Init-Data"])

CARD_DEFS = [
    ("Крестьянин", "Обычные", 4200, None),
    ("Воин", "Обычные", 2200, None),
    ("Фермер", "Обычные", 1400, None),
    ("Кузнец", "Обычные", 1000, None),
    ("Пекарь", "Обычные", 700, None),
    ("Торговец", "Обычные", 400, None),
    # Demo limit only; confirm the actual limit and odds before launch.
    ("Мечта", "MYTHIC", 100, 10),
]

def db():
    con = sqlite3.connect(DB_PATH, timeout=15, isolation_level=None)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con

def init_db():
    con = db()
    try:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS card_defs (
          name TEXT PRIMARY KEY, rarity TEXT NOT NULL, weight INTEGER NOT NULL,
          max_copies INTEGER, issued_copies INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS card_instances (
          serial INTEGER PRIMARY KEY AUTOINCREMENT,
          card_name TEXT NOT NULL REFERENCES card_defs(name),
          owner_id TEXT NOT NULL,
          zone TEXT NOT NULL DEFAULT 'deck',
          obtained_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_instances_owner ON card_instances(owner_id, zone);
        CREATE INDEX IF NOT EXISTS idx_instances_card ON card_instances(card_name);
        """)
        for name, rarity, weight, limit_count in CARD_DEFS:
            con.execute("INSERT OR IGNORE INTO card_defs(name,rarity,weight,max_copies) VALUES(?,?,?,?)", (name, rarity, weight, limit_count))
    finally:
        con.close()

@app.on_event("startup")
def startup():
    init_db()

def validate_init_data(raw: str) -> dict:
    if not BOT_TOKEN:
        raise HTTPException(503, "Server BOT_TOKEN is not configured")
    if not raw:
        raise HTTPException(401, "Open this app through Telegram")
    pairs = dict(parse_qsl(raw, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise HTTPException(401, "Invalid Telegram initData")
    auth_date = int(pairs.get("auth_date", "0") or 0)
    if abs(int(time.time()) - auth_date) > 86400:
        raise HTTPException(401, "Telegram session expired; reopen the Mini App")
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received_hash):
        raise HTTPException(401, "Telegram signature check failed")
    try:
        user = json.loads(pairs["user"])
        return {"id": str(user["id"]), "first_name": user.get("first_name", "Player")}
    except Exception:
        raise HTTPException(401, "Telegram user data is missing")

def require_user(x_telegram_init_data: str | None):
    return validate_init_data(x_telegram_init_data or "")

@app.get("/health")
def health():
    return {"ok": True, "service": "The Forbidden API", "version": app.version}

@app.get("/api/me/cards")
def my_cards(x_telegram_init_data: str | None = Header(default=None)):
    user = require_user(x_telegram_init_data)
    con = db()
    try:
        rows = con.execute("""SELECT i.serial, i.card_name, i.zone, i.obtained_at, d.rarity, d.max_copies
          FROM card_instances i JOIN card_defs d ON d.name=i.card_name
          WHERE i.owner_id=? ORDER BY i.serial""", (user["id"],)).fetchall()
        return {"user": user, "cards": [dict(r) for r in rows]}
    finally:
        con.close()

@app.post("/api/draw")
def draw_card(x_telegram_init_data: str | None = Header(default=None)):
    user = require_user(x_telegram_init_data)
    con = db()
    try:
        # Serializes competing draws, so a limited card cannot exceed its cap.
        con.execute("BEGIN IMMEDIATE")
        rows = con.execute("SELECT name, rarity, weight, max_copies, issued_copies FROM card_defs WHERE max_copies IS NULL OR issued_copies < max_copies").fetchall()
        if not rows:
            con.rollback()
            raise HTTPException(409, "No cards are available right now")
        total = sum(max(0, int(r["weight"])) for r in rows)
        point = random.randrange(total)
        chosen = rows[0]
        for row in rows:
            point -= int(row["weight"])
            if point < 0:
                chosen = row
                break
        now = int(time.time())
        con.execute("UPDATE card_defs SET issued_copies=issued_copies+1 WHERE name=?", (chosen["name"],))
        cur = con.execute("INSERT INTO card_instances(card_name,owner_id,zone,obtained_at) VALUES(?,?, 'deck', ?)", (chosen["name"], user["id"], now))
        serial = cur.lastrowid
        con.commit()
        return {"ok": True, "card": {"name": chosen["name"], "rarity": chosen["rarity"], "serial": serial, "max_copies": chosen["max_copies"], "issued_copies": int(chosen["issued_copies"])+1}, "message": "Card granted"}
    except HTTPException:
        raise
    except Exception:
        con.rollback()
        raise HTTPException(500, "Card draw failed safely; no card was granted")
    finally:
        con.close()

class MoveRequest(BaseModel):
    serial: int
    zone: str

@app.post("/api/me/card-zone")
def move_card(body: MoveRequest, x_telegram_init_data: str | None = Header(default=None)):
    user = require_user(x_telegram_init_data)
    if body.zone not in {"deck", "taboo"}:
        raise HTTPException(400, "zone must be deck or taboo")
    con = db()
    try:
        cur = con.execute("UPDATE card_instances SET zone=? WHERE serial=? AND owner_id=?", (body.zone, body.serial, user["id"]))
        if cur.rowcount != 1:
            raise HTTPException(404, "Card instance not found for this player")
        return {"ok": True, "serial": body.serial, "zone": body.zone}
    finally:
        con.close()
