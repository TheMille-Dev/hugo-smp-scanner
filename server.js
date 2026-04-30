const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
};

// Hilfsfunktion: sicher einen Request machen
async function safeFetch(url, opts = {}) {
    try {
        const res = await axios.get(url, { timeout: 8000, ...opts });
        return res.data;
    } catch {
        return null;
    }
}

// Minecraft UUID + echten Name von Mojang holen
async function getMojangData(name) {
    const data = await safeFetch(`https://api.mojang.com/users/profiles/minecraft/${name}`);
    if (!data || !data.id) return null;
    return {
        uuid: data.id,
        uuid_formatted: data.id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5'),
        real_name: data.name,
    };
}

// Name-History von Mojang (falls verfügbar)
async function getNameHistory(uuid) {
    // Mojang hat die offizielle Name-History API eingestellt, aber wir versuchen es trotzdem
    // über einen Proxy-Dienst
    const data = await safeFetch(`https://api.ashcon.app/mojang/v2/user/${uuid}`);
    if (!data) return null;
    return {
        username_history: data.username_history || [],
        created_at: data.created_at || null,
        textures: data.textures || null,
    };
}

// HugoSMP RSC-Stream parsen
async function getHugoSMPData(name) {
    const raw = await safeFetch(`https://hugosmp-tracker.net/player/${name}?_rsc=ni8cy`, {
        headers: { ...HEADERS, 'RSC': '1', 'Next-Router-State-Tree': '1' }
    });
    if (!raw) return {};

    const result = {};

    // Geld / Balance
    const moneyMatch = raw.match(/([\d\.,]+)\s*\$/);
    if (moneyMatch) result.balance = moneyMatch[0].trim();

    // Kills
    const killsMatch = raw.match(/"kills"\s*:\s*(\d+)/);
    if (killsMatch) result.kills = parseInt(killsMatch[1]);

    // Deaths
    const deathsMatch = raw.match(/"deaths"\s*:\s*(\d+)/);
    if (deathsMatch) result.deaths = parseInt(deathsMatch[1]);

    // Playtime
    const playtimeMatch = raw.match(/"playtime"\s*:\s*"([^"]+)"/);
    if (playtimeMatch) result.playtime = playtimeMatch[1];

    // Rank / Rang
    const rankMatch = raw.match(/"rank"\s*:\s*"([^"]+)"/);
    if (rankMatch) result.rank = rankMatch[1];

    // Level
    const levelMatch = raw.match(/"level"\s*:\s*(\d+)/);
    if (levelMatch) result.level = parseInt(levelMatch[1]);

    // Online status
    const onlineMatch = raw.match(/"online"\s*:\s*(true|false)/);
    if (onlineMatch) result.online = onlineMatch[1] === 'true';

    // Last seen
    const lastSeenMatch = raw.match(/"lastSeen"\s*:\s*"([^"]+)"/);
    if (lastSeenMatch) result.last_seen = lastSeenMatch[1];

    // First join
    const firstJoinMatch = raw.match(/"firstJoin"\s*:\s*"([^"]+)"/);
    if (firstJoinMatch) result.first_join = firstJoinMatch[1];

    // Faction / Clan
    const factionMatch = raw.match(/"faction"\s*:\s*"([^"]+)"/);
    if (factionMatch) result.faction = factionMatch[1];

    // KD-Ratio berechnen
    if (result.kills !== undefined && result.deaths !== undefined && result.deaths > 0) {
        result.kd_ratio = (result.kills / result.deaths).toFixed(2);
    }

    return result;
}

// Vollständige HTML-Seite parsen für mehr Daten
async function getHugoSMPHtml(name) {
    const html = await safeFetch(`https://hugosmp-tracker.net/player/${name}`, {
        headers: HEADERS
    });
    if (!html) return {};

    const result = {};

    // Alle Zahlen-Patterns suchen
    const balanceMatch = html.match(/([\d\.,]+)\s*(?:Dollar|\$|Coins)/i);
    if (balanceMatch) result.balance_html = balanceMatch[0];

    // JSON-LD oder Next.js __NEXT_DATA__ suchen
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
    if (nextDataMatch) {
        try {
            const nextData = JSON.parse(nextDataMatch[1]);
            result.next_data = nextData;
        } catch {}
    }

    return result;
}

// Tracker-eigene API versuchen
async function getTrackerAPI(name) {
    const endpoints = [
        `https://api.hugosmp-tracker.net/v1/player/${name}`,
        `https://api.hugosmp-tracker.net/v1/players/${name}`,
        `https://api.hugosmp-tracker.net/player/${name}`,
        `https://hugosmp-tracker.net/api/player/${name}`,
    ];

    for (const url of endpoints) {
        const data = await safeFetch(url, { headers: HEADERS });
        if (data && typeof data === 'object' && !data.error) {
            return { source: url, data };
        }
    }
    return null;
}

app.get('/api/scan/:name', async (req, res) => {
    const name = req.params.name.trim();
    if (!name) return res.status(400).json({ error: 'Kein Name angegeben' });

    try {
        // Alle Quellen parallel abfragen
        const [mojang, hugoRSC, hugoHtml, trackerAPI, ashcon] = await Promise.all([
            getMojangData(name),
            getHugoSMPData(name),
            getHugoSMPHtml(name),
            getTrackerAPI(name),
            safeFetch(`https://api.ashcon.app/mojang/v2/user/${name}`),
        ]);

        // Prüfen ob Spieler überhaupt existiert
        if (!mojang) {
            return res.status(404).json({ error: `Spieler "${name}" nicht gefunden` });
        }

        // Alle Daten zusammenführen
        const profile = {
            // Grundinfos
            name: mojang.real_name || name,
            uuid: mojang.uuid,
            uuid_formatted: mojang.uuid_formatted,

            // Avatare & Skins
            avatar: `https://api.hugosmp-tracker.net/v1/assets/player/avatar/${name}.png`,
            avatar_fallback: `https://crafatar.com/avatars/${mojang.uuid}?size=256&overlay`,
            skin_full: `https://crafatar.com/renders/body/${mojang.uuid}?scale=10&overlay`,
            skin_head: `https://crafatar.com/renders/head/${mojang.uuid}?scale=10`,
            skin_raw: `https://crafatar.com/skins/${mojang.uuid}`,

            // Minecraft Profil
            minecraft: {
                uuid: mojang.uuid,
                uuid_formatted: mojang.uuid_formatted,
                name: mojang.real_name,
            },

            // Name-History aus Ashcon
            username_history: ashcon?.username_history || [],
            account_created: ashcon?.created_at || null,

            // HugoSMP Stats
            smp: {
                balance: hugoRSC.balance || null,
                kills: hugoRSC.kills ?? null,
                deaths: hugoRSC.deaths ?? null,
                kd_ratio: hugoRSC.kd_ratio ?? null,
                playtime: hugoRSC.playtime || null,
                rank: hugoRSC.rank || null,
                level: hugoRSC.level ?? null,
                online: hugoRSC.online ?? null,
                last_seen: hugoRSC.last_seen || null,
                first_join: hugoRSC.first_join || null,
                faction: hugoRSC.faction || null,
            },

            // Rohdaten von Tracker-API (falls gefunden)
            tracker_api: trackerAPI ? trackerAPI.data : null,

            // Links
            links: {
                profile: `https://hugosmp-tracker.net/player/${name}`,
                namemc: `https://namemc.com/player/${mojang.uuid}`,
            },

            // Meta
            fetched_at: new Date().toISOString(),
        };

        res.json(profile);
    } catch (error) {
        console.error('Fehler:', error.message);
        res.status(500).json({ error: 'Interner Fehler beim Abrufen der Daten' });
    }
});

// Alle SMP-Mitglieder (falls verfügbar)
app.get('/api/members', async (req, res) => {
    const data = await safeFetch('https://api.hugosmp-tracker.net/v1/players', { headers: HEADERS });
    if (!data) return res.status(404).json({ error: 'Spielerliste nicht verfügbar' });
    res.json(data);
});

app.listen(3000, () => {
    console.log('✅ Hugo SMP Scanner läuft auf http://localhost:3000');
});
