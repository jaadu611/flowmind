import * as fs from "fs";
import * as path from "path";
import { Page } from "playwright";
import { askGemini } from "./geminiAutomator";

export interface WorkflowConfig {
  nodes: any[];
  edges: any[];
}

export async function runWorkflowChecker(
  page: Page,
  userQuery: string,
  workflowData: WorkflowConfig
): Promise<any[]> {
  
  const registryPath = path.join(process.cwd(), "node_registry.json");
  const nodeRegistry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  
  const orchestratorPrompt = `
You are the Master Orchestrator and Validation AI for the FlowMind engine. 
The user is trying to run a visual workflow configuration to accomplish a main objective.
Some of their nodes might be missing prompts/queries, or their instructions might be inefficient.
Your job is to analyze their workflow nodes and edges, fix any empty or broken "query" fields inside their data objects, and return the ENTIRE repaired nodes array exactly matching its original schema, just with the updated 'data.query' fields.

--- USER'S MAIN OBJECTIVE ---
"${userQuery}"

--- WORKFLOW EDGES ---
${JSON.stringify(workflowData.edges, null, 2)}

--- WORKFLOW NODES (NEEDS SANITIZATION) ---
${JSON.stringify(workflowData.nodes, null, 2)}

--- AVAILABLE NODE REGISTRY ---
${JSON.stringify(nodeRegistry, null, 2)}

--- YOUR INSTRUCTIONS ---
1. Analyze the edge sequence (how data flows from source to target).
2. For each node in the nodes array, check its \`data.query\` property.
3. If \`data.query\` is empty, vague, or missing, GENERATE the absolute perfect, strict prompt/instruction needed for that node to contribute towards the User's Main Objective based on its type as defined in the Registry.
4. Use the "accepts" fields in the Node Registry to know exactly what kind of query/instruction that specific node needs to function.
5. You MUST return JSON representing the corrected \`nodes\` array wrapped in a parent object like this:
{
  "sanitized_nodes": [ <THE FULL ARRAY OF NODE OBJECTS WITH UPDATED data.query FIELDS> ]
}
Do not output anything else. Output only valid JSON.
`;

  console.log("[WorkflowChecker] Sending workflow topology to Gemini Starter AI for validation...");
  const rawResponse = await askGemini(page, orchestratorPrompt, []);
  
  try {
    const cleanJsonStr = (rawResponse.match(/\{[\s\S]*\}/) ?? [rawResponse])[0]
      .replace(/[\x00-\x1F]+/g, " ")
      .replace(/\/\/.*$/gm, "");
    
    const parsed = JSON.parse(cleanJsonStr);
    if (parsed.sanitized_nodes && Array.isArray(parsed.sanitized_nodes)) {
      console.log("[WorkflowChecker] Successfully repaired workflow nodes.");
      return parsed.sanitized_nodes;
    }
  } catch (err) {
    console.error("[WorkflowChecker] Failed to parse AI repair response:", err);
  }
  
  // Fallback to returning original nodes if it fails to parse
  return workflowData.nodes;
}
