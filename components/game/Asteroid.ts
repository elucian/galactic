
import { QuadrantType } from '../../types';
import { ASTEROID_VARIANTS } from './utils';

export class Asteroid {
  x: number; y: number; z: number; hp: number; vx: number; vy: number; vz: number; size: number; color: string; 
  loot: { type: string, id?: string, name?: string; quantity?: number } | null = null;
  vertices: {x:number, y:number, z:number}[]; 
  faces: {indices: number[], normal: {x:number, y:number, z:number}}[];
  ax: number = 0; ay: number = 0; az: number = 0; vax: number; vay: number; vaz: number;
  material: 'rock' | 'ice' | 'metal' = 'rock';

  constructor(w: number, diff: number, quadrant: QuadrantType) {
    this.x = Math.random() * w; this.y = -200; this.z = (Math.random() - 0.5) * 600;
    this.vy = 2 + Math.random() * 2; 
    this.vx = (Math.random() - 0.5) * 6; 
    this.vz = (Math.random() - 0.5);
    this.size = 12 + Math.random() * 15; 
    this.hp = (this.size * 30) + (this.size * this.size);
    this.vax = (Math.random() - 0.5) * 0.05; 
    this.vay = (Math.random() - 0.5) * 0.05; 
    this.vaz = (Math.random() - 0.5) * 0.05; 
    
    let variantPool = [];
    if (quadrant === QuadrantType.ALFA) {
        variantPool = [...Array(6).fill('ice'), ...Array(3).fill('platinum'), 'rock', 'copper'];
    } else if (quadrant === QuadrantType.BETA) {
        variantPool = ['ice', 'ice', 'ice', 'ice', 'platinum', 'platinum', 'rock', 'rock', 'copper', 'copper'];
    } else if (quadrant === QuadrantType.GAMA) {
        variantPool = ['ice', 'ice', 'ice', 'platinum', 'platinum', 'rock', 'rock', 'rock', 'rust', 'rust', 'copper'];
    } else if (quadrant === QuadrantType.DELTA) {
        variantPool = ['gold', 'gold', 'gold', 'rare', 'rare', 'platinum', 'platinum', 'ice', 'ice', 'ice'];
    } else {
        variantPool = ['rock', 'ice'];
    }

    const selectedType = variantPool[Math.floor(Math.random() * variantPool.length)];
    const variant = ASTEROID_VARIANTS.find(v => v.type === selectedType) || ASTEROID_VARIANTS[2]; 
    this.color = variant.color;
    
    // Determine Material for Sound
    if (variant.type === 'ice' || variant.type === 'platinum' || variant.type === 'rare') {
        this.material = 'ice';
    } else if (variant.type === 'gold' || variant.type === 'copper') {
        this.material = 'metal';
    } else {
        this.material = 'rock';
    }

    if (Math.random() > 0.8) {
        this.loot = null;
    } else {
        const lootType = variant.loot[Math.floor(Math.random() * variant.loot.length)];
        let capType = lootType.charAt(0).toUpperCase() + lootType.slice(1);
        let finalType = lootType;
        if (lootType === 'silver') { finalType = 'platinum'; capType = 'Silver Ore'; }
        if (lootType === 'iridium') { finalType = 'platinum'; capType = 'Iridium Ore'; }
        if (lootType === 'tungsten') { finalType = 'iron'; capType = 'Tungsten Ore'; }
        if (lootType === 'energy') { finalType = 'energy'; capType = 'Energy Cell'; }

        if (['water', 'fuel', 'gold', 'platinum', 'lithium', 'iron', 'copper', 'chromium', 'titanium', 'energy'].includes(finalType)) {
            let qty = 1;
            let id = finalType; // Default ID is type name
            
            // Special Cases for IDs
            if (finalType === 'fuel') id = 'can_fuel';
            if (finalType === 'energy') id = 'batt_cell';
            if (finalType === 'water') id = 'water';

            if (variant.type === 'ice' && finalType === 'water') qty = 5;
            if (variant.type === 'ice' && finalType === 'fuel') qty = 2;
            
            this.loot = { type: finalType, id, name: capType, quantity: qty };
        } else {
            this.loot = { type: 'goods', id: finalType, name: capType, quantity: 1 };
        }
    }

    const t = (1 + Math.sqrt(5)) / 2; 
    const r = 1/t; 
    const p = t;
    const baseVerts = [
        [1,1,1], [1,1,-1], [1,-1,1], [1,-1,-1],
        [-1,1,1], [-1,1,-1], [-1,-1,1], [-1,-1,-1],
        [0, r, p], [0, r, -p], [0, -r, p], [0, -r, -p],
        [r, p, 0], [r, -p, 0], [-r, p, 0], [-r, -p, 0],
        [p, 0, r], [p, 0, -r], [-p, 0, r], [-p, 0, -r]
    ];
    this.vertices = baseVerts.map(v => ({ 
        x: v[0]*this.size + (Math.random()-0.5)*this.size*0.3, 
        y: v[1]*this.size + (Math.random()-0.5)*this.size*0.3, 
        z: v[2]*this.size + (Math.random()-0.5)*this.size*0.3
    }));
    const indices = [
        [0, 16, 2, 10, 8], [0, 8, 4, 14, 12], [16, 17, 1, 12, 0], [1, 9, 11, 3, 17], 
        [1, 12, 14, 5, 9], [2, 13, 15, 6, 10], [13, 3, 17, 16, 2], [3, 11, 7, 15, 13], 
        [4, 8, 10, 6, 18], [14, 4, 18, 19, 5], [5, 19, 7, 11, 9], [15, 7, 19, 18, 6]
    ];
    this.faces = indices.map(idxList => {
        let nx=0, ny=0, nz=0;
        idxList.forEach(i => { nx += baseVerts[i][0]; ny += baseVerts[i][1]; nz += baseVerts[i][2]; });
        const len = Math.hypot(nx, ny, nz);
        return { indices: idxList, normal: {x: nx/len, y: ny/len, z: nz/len} };
    });
  }
}
