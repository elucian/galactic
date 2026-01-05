
import { MissionType } from "../types";

export async function getMissionBriefing(targetName: string, type: MissionType): Promise<string> {
  const briefings = [
    `Intelligence reports a surge in Xenos activity near ${targetName}. Strategic Command mandates an immediate ${type} operation. Failure is not an option.`,
    `The colony at ${targetName} is under heavy fire. Your objective: initiate ${type} protocol and neutralize all hostiles in the sector.`,
    `Mysterious energy signatures detected around ${targetName}. Engage for ${type} sweep. Watch your fuel levels, pilot.`,
    `The rim-world ${targetName} has gone dark. Scramble for ${type} engagement. We need those resources secured.`,
    `Xenos swarm fleets are converging on ${targetName}. Tactical analysis suggests a high-priority ${type} mission. Good luck, guardian.`
  ];
  
  // Return a random briefing from the local pool
  return briefings[Math.floor(Math.random() * briefings.length)];
}
