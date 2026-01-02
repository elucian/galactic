
import { GoogleGenAI } from "@google/genai";
import { MissionType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getMissionBriefing(targetName: string, type: MissionType): Promise<string> {
  try {
    const prompt = `Generate a short (2-3 sentence) military space mission briefing for the target: ${targetName}. 
    The mission type is ${type}. Context: Humans are colonizing the galaxy and a mysterious alien race is attacking. 
    Keep it retro-scifi themed. Direct and gritty.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text || "Communication relay unstable. Mission parameters classified. Prepare for engagement.";
  } catch (error) {
    console.error("Gemini Briefing Error:", error);
    return "Intelligence reports are inconclusive. All pilots to battle stations. Good luck.";
  }
}
