# 📡 Hugo SMP Intelligence Scanner v2.0

A cyberpunk-themed, lightweight intelligence scanner designed to query and display detailed player profiles from the **Hugo SMP**. It aggregates data from the Mojang API, the unofficial HugoSMP Tracker API, and server-side scraping to provide a comprehensive overview of a player's statistics, economy, recent activities, and more.

## ✨ Features

- **Player Intel:** Displays UUID, rank, faction, level, online status, playtime, and timestamps (first join / last seen).
- **Economy Tracking:** Shows current balance and recent activities (auctions, purchases, sales).
- **Combat Stats:** Real-time Kills, Deaths, and K/D Ratio calculation.
- **Dynamic Assets:** Automatically fetches Minecraft player avatars.
- **Cyberpunk UI:** Fully responsive, animated grid layout with a sleek terminal/hacker aesthetic.

## 🚀 Getting Started Locally

This project uses a standard Node.js & Express backend to proxy the APIs and serve the frontend.

### Prerequisites
- Node.js (v18 or higher recommended)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_NAME/hugo-smp-scanner.git
   cd hugo-smp-scanner
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to: **[http://localhost:3000](http://localhost:3000)**

## ☁️ Deployment (Coolify)

Deploying this app via [Coolify](https://coolify.io/) is incredibly straightforward thanks to Nixpacks.

1. Connect your GitHub account to Coolify.
2. Click **+ New Resource** and select **Public (or Private) Repository**.
3. Select this repository.
4. Coolify will automatically detect the Node.js environment.
5. Go to the configuration and ensure the **Port** is set to `3000`.
6. Click **Deploy**. Coolify will handle the `npm install` and run the `npm start` command automatically!

## 🛠 Tech Stack
- **Frontend:** Vanilla HTML, CSS (Custom Cyberpunk Design), JavaScript
- **Backend:** Node.js, Express, Axios (for API fetching and CORS bypassing)
