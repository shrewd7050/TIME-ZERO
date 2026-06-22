from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, String, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import json
import asyncio
from typing import Dict, List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (CSS, JS, images)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Database setup (unchanged)
DATABASE_URL = "sqlite:///./pokemon.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class PlayerDB(Base):
    __tablename__ = "players"
    name = Column(String, primary_key=True, index=True)
    level = Column(Integer, default=1)
    wins = Column(Integer, default=0)
    losses = Column(Integer, default=0)

Base.metadata.create_all(bind=engine)

def get_player_stats(name: str) -> dict:
    db = SessionLocal()
    player = db.query(PlayerDB).filter(PlayerDB.name == name).first()
    db.close()
    if not player:
        return {"name": name, "level": 1, "wins": 0, "losses": 0}
    return {"name": player.name, "level": player.level, "wins": player.wins, "losses": player.losses}

def update_player_winner(name: str):
    db = SessionLocal()
    player = db.query(PlayerDB).filter(PlayerDB.name == name).first()
    if player:
        player.wins += 1
        player.level += 1
    else:
        player = PlayerDB(name=name, wins=1, level=2, losses=0)
        db.add(player)
    db.commit()
    db.close()

def update_player_loser(name: str):
    db = SessionLocal()
    player = db.query(PlayerDB).filter(PlayerDB.name == name).first()
    if player:
        player.losses += 1
    else:
        player = PlayerDB(name=name, wins=0, level=1, losses=1)
        db.add(player)
    db.commit()
    db.close()

# ---------- Serve the main page ----------
@app.get("/")
async def serve_home():
    return FileResponse("static/index.html")   # <-- index.html is now in static/

# ---------- Game WebSocket ----------
waiting_queue: List[WebSocket] = []
rooms: Dict[str, Dict] = {}

async def send_json(ws: WebSocket, data: dict):
    await ws.send_text(json.dumps(data))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # ... (your existing game WS code, unchanged) ...
    await websocket.accept()
    player_name = None
    current_room = None
    try:
        data = await websocket.receive_text()
        msg = json.loads(data)
        if msg.get("action") != "find" or "name" not in msg:
            await send_json(websocket, {"type": "error", "message": "Invalid join"})
            await websocket.close()
            return
        player_name = msg["name"][:30]
        stats = get_player_stats(player_name)
        await send_json(websocket, {"type": "connected", "stats": stats})
        waiting_queue.append(websocket)
        await send_json(websocket, {"type": "waiting", "message": "Searching for opponent..."})
        while len(waiting_queue) >= 2:
            p1 = waiting_queue.pop(0)
            p2 = waiting_queue.pop(0)
            if p1 == p2:
                continue
            room_id = f"room_{id(p1)}_{id(p2)}"
            rooms[room_id] = {
                "p1": p1, "p2": p2,
                "p1_name": None, "p2_name": None,
                "p1_health": 100, "p2_health": 100,
                "turn": "p1",
                "game_active": True,
            }
            await send_json(p1, {"type": "matched", "room_id": room_id})
            await send_json(p2, {"type": "matched", "room_id": room_id})
        while True:
            text = await websocket.receive_text()
            msg = json.loads(text)
            if msg.get("type") == "join_room":
                room_id = msg["room_id"]
                if room_id not in rooms:
                    await send_json(websocket, {"type": "error", "message": "Room not found"})
                    continue
                room = rooms[room_id]
                if room["p1"] == websocket:
                    room["p1_name"] = player_name
                elif room["p2"] == websocket:
                    room["p2_name"] = player_name
                else:
                    await send_json(websocket, {"type": "error", "message": "Not part of room"})
                    continue
                current_room = room_id
                opponent_name = room["p2_name"] if room["p1"] == websocket else room["p1_name"]
                await send_json(websocket, {"type": "opponent_name", "name": opponent_name})
                if room["p1_name"] and room["p2_name"]:
                    for ws_player in [room["p1"], room["p2"]]:
                        is_p1 = (room["p1"] == ws_player)
                        await send_json(ws_player, {
                            "type": "game_start",
                            "your_health": 100,
                            "opponent_health": 100,
                            "your_turn": (room["turn"] == "p1" and is_p1) or (room["turn"] == "p2" and not is_p1),
                            "p1_name": room["p1_name"],
                            "p2_name": room["p2_name"]
                        })
            elif msg.get("type") == "move" and current_room:
                room = rooms.get(current_room)
                if not room or not room["game_active"]:
                    continue
                is_p1 = (room["p1"] == websocket)
                if (is_p1 and room["turn"] != "p1") or (not is_p1 and room["turn"] != "p2"):
                    await send_json(websocket, {"type": "error", "message": "Not your turn"})
                    continue
                move = msg.get("move")
                if move not in [1, 2, 3]:
                    continue
                if is_p1:
                    room["p1_move"] = move
                else:
                    room["p2_move"] = move
                if "p1_move" in room and "p2_move" in room:
                    p1_move = room.pop("p1_move")
                    p2_move = room.pop("p2_move")
                    dmg1, dmg2 = 0, 0
                    if p1_move == 1 and p2_move == 1: dmg1, dmg2 = 0, 0
                    elif p1_move == 1 and p2_move == 2: dmg1, dmg2 = 15, 0
                    elif p1_move == 1 and p2_move == 3: dmg1, dmg2 = 0, 20
                    elif p1_move == 2 and p2_move == 1: dmg1, dmg2 = 0, 15
                    elif p1_move == 2 and p2_move == 2: dmg1, dmg2 = 5, 5
                    elif p1_move == 2 and p2_move == 3: dmg1, dmg2 = 10, 0
                    elif p1_move == 3 and p2_move == 1: dmg1, dmg2 = 20, 0
                    elif p1_move == 3 and p2_move == 2: dmg1, dmg2 = 0, 10
                    elif p1_move == 3 and p2_move == 3: dmg1, dmg2 = 0, 0
                    room["p1_health"] = max(0, room["p1_health"] - dmg1)
                    room["p2_health"] = max(0, room["p2_health"] - dmg2)
                    round_result = {
                        "type": "round_result",
                        "p1_move": p1_move,
                        "p2_move": p2_move,
                        "p1_health": room["p1_health"],
                        "p2_health": room["p2_health"],
                        "p1_damage": dmg1,
                        "p2_damage": dmg2
                    }
                    game_over = False
                    winner = None
                    if room["p1_health"] <= 0:
                        game_over = True
                        winner = "p2"
                    elif room["p2_health"] <= 0:
                        game_over = True
                        winner = "p1"
                    if game_over:
                        winner_name = room["p1_name"] if winner == "p1" else room["p2_name"]
                        loser_name = room["p2_name"] if winner == "p1" else room["p1_name"]
                        update_player_winner(winner_name)
                        update_player_loser(loser_name)
                        for ws_player in [room["p1"], room["p2"]]:
                            await send_json(ws_player, {
                                "type": "game_over",
                                "winner_name": winner_name,
                                "loser_name": loser_name,
                                "winner_stats": get_player_stats(winner_name)
                            })
                        room["game_active"] = False
                        asyncio.create_task(clean_room(current_room))
                    else:
                        room["turn"] = "p2" if room["turn"] == "p1" else "p1"
                        for ws_player in [room["p1"], room["p2"]]:
                            is_p1_player = (room["p1"] == ws_player)
                            round_result["your_turn"] = (room["turn"] == "p1" and is_p1_player) or (room["turn"] == "p2" and not is_p1_player)
                            await send_json(ws_player, round_result)
            elif msg.get("type") == "leave":
                break
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in waiting_queue:
            waiting_queue.remove(websocket)
        if current_room and current_room in rooms:
            room = rooms[current_room]
            other = room["p2"] if room["p1"] == websocket else room["p1"]
            if other:
                await send_json(other, {"type": "opponent_left"})
            del rooms[current_room]

async def clean_room(room_id: str):
    await asyncio.sleep(5)
    if room_id in rooms:
        del rooms[room_id]

# ---------- Chat WebSocket ----------
chat_rooms: Dict[str, List[WebSocket]] = {}
chat_history: Dict[str, List[dict]] = {}

async def send_chat_json(ws: WebSocket, data: dict):
    await ws.send_text(json.dumps(data))

@app.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket):
    # ... (your existing chat WS code, unchanged) ...
    await websocket.accept()
    current_room = None
    username = None
    try:
        data = await websocket.receive_text()
        msg = json.loads(data)
        if msg.get("action") != "join" or "room" not in msg or "username" not in msg:
            await send_chat_json(websocket, {"type": "error", "message": "Invalid join"})
            await websocket.close()
            return
        room_name = msg["room"]
        raw_username = msg.get("username")
        if not raw_username or raw_username == "null" or raw_username.strip() == "":
            raw_username = "Random-user123"
        username = raw_username[:20]
        current_room = room_name
        if room_name not in chat_rooms:
            chat_rooms[room_name] = []
            chat_history[room_name] = []
        chat_rooms[room_name].append(websocket)
        history = chat_history[room_name][-20:]
        await send_chat_json(websocket, {"type": "history", "messages": history})
        join_msg = {"type": "message", "username": "System", "text": f"{username} joined the room", "timestamp": asyncio.get_event_loop().time()}
        for ws in chat_rooms[room_name]:
            if ws != websocket:
                await send_chat_json(ws, join_msg)
        while True:
            text = await websocket.receive_text()
            msg = json.loads(text)
            if msg.get("type") == "message":
                user_msg = {
                    "type": "message",
                    "username": username,
                    "text": msg["text"][:200],
                    "timestamp": asyncio.get_event_loop().time()
                }
                chat_history[room_name].append(user_msg)
                if len(chat_history[room_name]) > 100:
                    chat_history[room_name] = chat_history[room_name][-100:]
                for ws in chat_rooms[room_name]:
                    await send_chat_json(ws, user_msg)
            elif msg.get("type") == "leave":
                break
    except WebSocketDisconnect:
        pass
    finally:
        if current_room and current_room in chat_rooms:
            if websocket in chat_rooms[current_room]:
                chat_rooms[current_room].remove(websocket)
            if not chat_rooms[current_room]:
                del chat_rooms[current_room]
            else:
                leave_msg = {"type": "message", "username": "System", "text": f"{username} left the room", "timestamp": asyncio.get_event_loop().time()}
                for ws in chat_rooms[current_room]:
                    await send_chat_json(ws, leave_msg)