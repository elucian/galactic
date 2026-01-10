
import { MissionType } from "../types.ts";

export async function getMissionBriefing(targetName: string, type: MissionType, difficulty: number): Promise<string> {
  // Simulate network delay for UI consistency
  await new Promise(resolve => setTimeout(resolve, 600));

  const templates = [
    `Intelligence reports a surge in Xenos activity near ${targetName}. Strategic Command mandates an immediate ${type} operation. Threat Level: ${difficulty}.`,
    `The colony at ${targetName} is under heavy fire. Initiate ${type} protocol and neutralize all hostiles. Priority Alpha.`,
    `Mysterious energy signatures detected around ${targetName}. Engage for ${type} sweep. Watch your fuel reserves.`,
    `Sector ${targetName} has gone dark. Reconnaissance suggests Class ${difficulty} Xenos presence. Proceed with caution.`,
    `Urgent: ${type} mission authorized for ${targetName}. Civilians have been evacuated. Clear the zone.`,
    `Intercept hostile fleet converging on ${targetName}. Maintain orbit and engage at will.`,
    `Scanner data indicates high-value targets in the ${targetName} system. Execute ${type} maneuvers immediately.`
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}
