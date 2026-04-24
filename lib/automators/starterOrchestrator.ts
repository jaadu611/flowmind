import { Page } from "playwright";
import { askGemini } from "./geminiAutomator";

export interface WorkflowConfig {
  nodes: any[];
  edges: any[];
}

/**
 * Runs the Starter AI using Gemini to figure out exactly what every node in the workflow should do.
 * It reads the Canvas JSON and the user's ultimate goal, then generates instructions per node.
 */
export async function runStarterOrchestrator(
  page: Page,
  userQuery: string,
  workflowData: WorkflowConfig
): Promise<string> {
  const orchestratorPrompt = `
You are the Master Orchestrator AI for the FlowMind engine. 
Your job is to analyze the user's objective and a structured graph representation of their created workflow.
You will then generate the precise queries and instructions for EVERY node in the workflow to ensure the system executes the user's objective flawlessly.

--- USER'S MAIN OBJECTIVE ---
"${userQuery}"

--- WORKFLOW TOPOLOGY ---
${JSON.stringify(workflowData, null, 2)}

--- YOUR INSTRUCTIONS ---
1. Identify the sequence of execution based on the 'edges' array (from source to target).
2. For each node in the sequence, determine EXACTLY what instructions/query it needs to accomplish the user's objective.
3. Keep in mind the node types:
   - "research": Takes a search query. It scrapes the web and outputs raw text files. You must provide the perfect search query.
   - "gemini": Takes files and an instruction prompt to analyze, summarize, or generate data.
   - "notebookLM": Takes files and an instruction prompt to act as a deep QA/reasoning engine on those files.
4. IMPORTANT: Do not output conversational filler. You MUST output your response strictly as a JSON object formatted exactly like this:
{
  "orchestration_plan": [
    {
      "node_id": "node_123",
      "node_type": "research",
      "generated_instructions": "Latest advancements in quantum computing implementations 2026"
    },
    {
      "node_id": "node_456",
      "node_type": "notebookLM",
      "generated_instructions": "Based on the provided research files, extract the top 3 bottlenecks in quantum scaling."
    }
  ]
}

Analyze the workflow topology, trace the logic path, and generate the orchestration plan JSON now.
`;

  console.log("[StarterOrchestrator] Sending workflow topology to Gemini Starter AI...");
  const rawResponse = await askGemini(page, orchestratorPrompt, []);
  console.log("[StarterOrchestrator] Received orchestration plan.");
  
  return rawResponse;
}
