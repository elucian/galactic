
import { GoogleGenAI } from "@google/genai";
import { MissionType } from "../types.ts";

export async function getMissionBriefing(targetName: string, type: MissionType, difficulty: number): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a short, high-stakes tactical mission briefing for a space pilot in a "Raptor: Call of the Shadows" style game.
      
      Context:
      Target Planet/Entity: ${targetName}
      Operation Type: ${type}
      Threat Level: Class ${difficulty}
      
      Lore: Humanity has colonized the galaxy but is now besieged by diverse, hostile alien species across different sectors.
      
      Requirements:
      - Max 200 characters.
      - Gritty, retro-military tone.
      - Reference the sector or specific alien threat.
      - Professional yet urgent.`,
      config: {
        temperature: 0.8,
        topP: 0.95,
      },
    });

    return response.text?.trim() || "Communication interference detected. Standard combat protocols are in effect.";
  } catch (error) {
    console.error("Gemini Briefing Error:", error);
    // Return a themed fallback
    const fallbacks = [
      `Intelligence reports a surge in Xenos activity near ${targetName}. Strategic Command mandates an immediate ${type} operation.`,
      `The colony at ${targetName} is under heavy fire. Initiate ${type} protocol and neutralize all hostiles.`,
      `Mysterious energy signatures detected around ${targetName}. Engage for ${type} sweep. Watch your fuel.`,
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}
