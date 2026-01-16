
import { LeaderboardEntry } from '../types.ts';

const DB_KEY = 'galactic_backend_db';

interface BackendDB {
    leaderboard: LeaderboardEntry[];
    events: { text: string, type: 'join' | 'win', timestamp: number }[];
}

// Initial leaderboard is empty as requested (single player start)
const INITIAL_LEADERBOARD: LeaderboardEntry[] = [];

class BackendService {
    private getDB(): BackendDB {
        // Safe check for SSR environments (Next.js/Vite SSG)
        if (typeof window === 'undefined') return { leaderboard: [], events: [] };

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
        if (typeof window !== 'undefined') {
            localStorage.setItem(DB_KEY, JSON.stringify(db));
        }
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
                    db.leaderboard[existingIdx].avatar = avatar; // Update avatar too
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
