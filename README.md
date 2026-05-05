# 🧠 Paper.js – 2D Physics Engine (ECS-Based)

A lightweight **2D physics engine** built using an **Entity Component System (ECS)** architecture.

This project focuses on clean architecture, modular systems, and real-time physics simulation in the browser using **TypeScript + Vite**.

---

## 🚀 Live Demo

👉 (Add your Vercel link here after deployment)

---

## 🎥 Demo Preview

(Add your video or GIF here)

---

## ✨ Features

- ⚙️ ECS Architecture (Entity, Component, System)
- 🧱 Collision Detection & Resolution
- 🌍 Gravity & Physics Simulation
- 🔁 Sub-stepping for stable collisions
- 🎯 Configurable bounce and physics parameters
- 🐞 Debug mode (velocity vectors, toggles)
- 🎨 Simple rendering system using Canvas

---

## 🏗️ Project Structure

```
src/
│
├── ecs/            # Core ECS implementation
│   ├── Entity.ts
│   ├── Component.ts
│   └── World.ts
│
├── components/     # Data components
│   ├── Transform.ts
│   ├── Physics.ts
│   ├── Sprite.ts
│   └── Collider.ts
│
├── systems/        # Logic systems
│   ├── PhysicsSystem.ts
│   ├── CollisionSystem.ts
│   └── RenderSystem.ts
│
├── core/
│   └── Vector2D.ts
│
├── utils/
│   ├── EngineConfig.ts
│   └── SpatialGrid.ts
│
└── main.ts         # Entry point
```

---

## ⚡ Getting Started

### 1. Clone the repo

```
git clone https://github.com/MrXgroot/paper-js.git
cd paper-js
```

### 2. Install dependencies

```
npm install
```

### 3. Run dev server

```
npm run dev
```

---

## 🧪 Controls / Debug

- Toggle Debug Mode
- Adjust Bounce
- Change Substeps
- Show Velocity vectors

---

## 🧠 Core Concepts

### Entity Component System (ECS)

- **Entity** → ID
- **Component** → Data (Transform, Physics, etc.)
- **System** → Logic (Physics, Rendering, Collision)

---

## 🚧 Future Improvements

- Broad-phase optimization (Quadtree / Grid improvements)
- Rotation physics
- Constraints / joints
- Better rendering pipeline
- Performance tuning

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create a branch (`feature/your-feature`)
3. Commit changes
4. Open a Pull Request

---

## 📜 License

This project is licensed under the **MIT License**.

---

## ⭐ Support

If you like this project, give it a star ⭐
