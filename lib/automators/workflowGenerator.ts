import * as fs from "fs";
import * as path from "path";
import { Page } from "playwright";
import { askGemini } from "./geminiAutomator";

export async function generateWorkflow(
  page: Page,
  userPrompt: string
): Promise<{ nodes: any[], edges: any[] }> {
  
  const registryPath = path.join(process.cwd(), "node_registry.json");
  const nodeRegistry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  
  const orchestratorPrompt = `
You are the Master Architect AI for the FlowMind engine. 
The user has provided a high-level goal, and your job is to design a complete workflow graph (nodes and edges) to accomplish it.

--- USER'S GOAL ---
"${userPrompt}"

--- INSTRUCTIONS ---
1. Design a linear or branching workflow using ONLY the node types available in the provided node_registry.json file.
2. For each node, provide the required React Flow structure:
    - \`id\`: A unique string ID.
    - \`type\`: The exact \`type\` string from the registry.
    - \`position\`: An object with \`x\` and \`y\` coordinates (space them out visually, e.g. x: 100 y: 150 -> x: 450 y: 150).
    - \`data\`: Merge the \`default_data\` object from the registry with the specific \`accepts\` fields you choose to generate (like \`query\`, \`mode\`, or \`maxPages\`). Do NOT include "status" or "files" fields.
3. For each edge connecting them, provide:
    - \`id\`: A unique string ID representing the connection (e.g. "e1-2").
    - \`source\`: The ID of the upstream node.
    - \`target\`: The ID of the downstream node.
4. IMPORTANT: You MUST return strictly valid JSON wrapped in a \`workflow\` object like this:
{
  "workflow": {
    "nodes": [ { "id": "n1", "type": "research", "position": { "x": 100, "y": 100 }, "data": { "label": "Research Data", "query": "Latest AI news", "mode": "surface", "maxPages": 5 } } ],
    "edges": [ { "id": "e1-2", "source": "n1", "target": "n2" } ]
  }
}
Generate ONLY the JSON, nothing else.
`;

  console.log("[WorkflowGenerator] Asking Gemini to build workflow for: ", userPrompt);
  const rawResponse = await askGemini(page, orchestratorPrompt, [registryPath]);
  
  if (!rawResponse || rawResponse.trim() === "") {
    console.error("[WorkflowGenerator] Gemini failed to respond (empty string returned).");
    return { nodes: [], edges: [] };
  }
  
  try {
    const cleanJsonStr = (rawResponse.match(/\{[\s\S]*\}/) ?? [rawResponse])[0]
      .replace(/[\x00-\x1F]+/g, " ")
      .replace(/\/\/.*$/gm, "");
    
    const parsed = JSON.parse(cleanJsonStr);
    if (parsed.workflow && parsed.workflow.nodes && parsed.workflow.edges) {
      
      // Post-process the generated nodes to add system-level fields silently
      parsed.workflow.nodes = parsed.workflow.nodes.map((n: any) => {
        if (!n.data) n.data = {};
        n.data.status = "idle";
        n.data.files = [];
        return n;
      });

      console.log("[WorkflowGenerator] Successfully generated workflow.");
      return parsed.workflow;
    }
  } catch (err) {
    console.error("[WorkflowGenerator] Failed to parse AI generated workflow:", err);
  }
  
  return { nodes: [], edges: [] };
}
