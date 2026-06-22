# ⚡ Time Zero – Pokémon Battle Arena

A real‑time multiplayer Pokémon‑style battle game with live chat rooms.  
Challenge friends in online duels or play against the computer – all in a modern, glass‑morphic web interface.

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)
![WebSockets](https://img.shields.io/badge/WebSockets-Realtime-orange.svg)

---

## 🎮 Features

- **Single Player Mode** – Fight against a CPM (Computer Player) with attack/defend mechanics and “thinking” delays.
- **Online Two‑Player Mode** – Real‑time battles via WebSockets. Matchmaking, turn‑based combat, winner stats saved.
- **Chat Rooms** – Two live chat rooms (News & Music) with message history, join/leave notifications, and persistent WebSocket connections.
- **Player Progression** – Wins increase your level and are stored in an SQLite database.
- **Modern UI** – Animated hero section, background fade on scroll, glass‑morphic cards, fully responsive.

---

## 🛠️ Tech Stack

| Component       | Technology                          |
|----------------|-------------------------------------|
| Backend        | Python + FastAPI                    |
| Real‑time      | WebSockets (game + chat)            |
| Database       | SQLite (via SQLAlchemy)             |
| Frontend       | HTML5, CSS3, Vanilla JS             |
| Styling        | CSS Grid / Flexbox, backdrop‑filter |

---

## 📦 Installation

### 1. Clone the repository
```bash
git clone https://github.com/shrewd7050/TIME-ZERO.git
cd time-zero-pokemon
