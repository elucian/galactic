
import { GoogleGenAI } from "@google/genai";
import { MissionType } from "../types";

export async function getMissionBriefing(targetName: string, type: MissionType): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a military commander in a space colonization game called Galactic Defender. 
      Generate a short, intense mission briefing (max 3 sentences) for a ${type} mission at the location "${targetName}". 
      Mention the struggle between human colonists and mysterious alien species. Use a gritty, retro-scifi tone similar to Raptor: Call of the Shadows.`,
    });
    
    return response.text || "Intelligence reports a surge in Xenos activity. Strategic Command mandates an immediate operation. Failure is not an option.";
  } catch (error) {
    console.error("Gemini Briefing Error:", error);
    const briefings = [
      `Intelligence reports a surge in Xenos activity near ${targetName}. Strategic Command mandates an immediate ${type} operation.`,
      `The colony at ${targetName} is under heavy fire from unknown alien vessels. Initiate ${type} protocol immediately.`,
      `Mysterious energy signatures detected around ${targetName}. Scramble for ${type} engagement. Good luck, guardian.`
    ];
    return briefings[Math.floor(Math.random() * briefings.length)];
  }
}
