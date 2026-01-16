
import { LeaderboardEntry } from '../types.ts';

const DB_KEY = 'galactic_backend_db';

interface BackendDB {
    leaderboard: LeaderboardEntry[];
    events: { text: string, type: 'join' | 'win', timestamp: number }[];
}

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
    { name: "Viper One", score: 950000, avatar: "👨‍✈️", date: Date.now() - 10000000 },
    { name: "Star Ace", score: 820000, avatar: "👩‍🚀", date: Date.now() - 20000000 },
    { name: "Red Baron", score: 750000, avatar: "🧔", date: Date.now() - 30000000 },
    { name: "Nova", score: 600000, avatar: "👩‍🎤", date: Date.now() - 40000000 },
    { name: "Xeno Hunter", score: 550000, avatar: "👽", date: Date.now() - 50000000 },
];

class BackendService {
    private getDB(): BackendDB {
        const stored = localStorage.getItem(DB_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        // Initialize if empty
        const initial: BackendDB = {
            leaderboard: [...INITIAL_LEADERBOARD],
            events: []
        };
        this.saveDB(initial);
        return initial;
    }

    private saveDB(db: BackendDB) {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }

    // Simulate async network call
    async getLeaderboard(): Promise<LeaderboardEntry[]> {
        return new Promise(resolve => {
            setTimeout(() => {
                const db = this.getDB();
                resolve(db.leaderboard.sort((a, b) => b.score - a.score));
            }, 300);
        });
    }

    async registerUser(pilotName: string): Promise<string> {
        return new Promise(resolve => {
            const db = this.getDB();
            // Just simulate a "User Joined" event log
            db.events.push({ text: `${pilotName} has joined the sector fleet.`, type: 'join', timestamp: Date.now() });
            this.saveDB(db);
            resolve(`Welcome to the fleet, ${pilotName}. Systems synced.`);
        });
    }

    // Returns rank (1-based)
    async submitScore(pilotName: string, score: number, avatar: string): Promise<number> {
        return new Promise(resolve => {
            const db = this.getDB();
            
            // Check if user already exists, update if higher, or add new
            const existingIdx = db.leaderboard.findIndex(e => e.name === pilotName);
            if (existingIdx >= 0) {
                if (score > db.leaderboard[existingIdx].score) {
                    db.leaderboard[existingIdx].score = score;
                    db.leaderboard[existingIdx].date = Date.now();
                }
            } else {
                db.leaderboard.push({ name: pilotName, score, avatar, date: Date.now() });
            }

            // Sort and trim
            db.leaderboard.sort((a, b) => b.score - a.score);
            
            // Find Rank
            const rank = db.leaderboard.findIndex(e => e.name === pilotName) + 1;
            
            this.saveDB(db);
            resolve(rank);
        });
    }
}

export const backendService = new BackendService();
