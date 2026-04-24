"use client";

import React, { useCallback } from "react";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Background,
  BackgroundVariant,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { NotebookLMNode } from "./nodes/NotebookLMNode";
import { GeminiNode } from "./nodes/Gemininode";
import { ExportNode } from "./nodes/ExportNode";
import { Chatgptnode } from "./nodes/Chatgptnode";
import {
  Search,
  Play,
  ChevronDown,
  Save,
  Upload,
  Undo2,
  Redo2,
  X,
  Sparkles,
  Loader2,
  FileDown,
  MessageSquare,
} from "lucide-react";
import { ResearchNode } from "./nodes/Researchnode";
import Image from "next/image";
import gsap from "gsap";

const SidebarCategory = ({ category, onAddNode, nodeSearch }: any) => {
  const [expanded, setExpanded] = React.useState(true);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const filteredNodes = category.nodes.filter(
    (n: any) =>
      n.label.toLowerCase().includes(nodeSearch.toLowerCase()) ||
      n.description.toLowerCase().includes(nodeSearch.toLowerCase()),
  );

  React.useEffect(() => {
    if (contentRef.current) {
      if (expanded) {
        gsap.fromTo(
          contentRef.current,
          { height: 0, opacity: 0 },
          { height: "auto", opacity: 1, duration: 0.3, ease: "power2.out" },
        );
      } else {
        gsap.to(contentRef.current, {
          height: 0,
          opacity: 0,
          duration: 0.2,
          ease: "power2.in",
        });
      }
    }
  }, [expanded]);

  if (filteredNodes.length === 0) return null;

  return (
    <div className="flex flex-col border-b border-gray-800 py-2.5 first:pt-1 last:border-b-0 last:pb-0">
      <div
        className="flex items-center justify-between cursor-pointer px-1 group select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <label className="text-[8px] text-slate-500 uppercase font-black tracking-widest cursor-pointer group-hover:text-slate-300 transition-colors">
          {category.title}
        </label>
        <button className="text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center">
          <ChevronDown
            size={12}
            className={`transition-transform duration-300 ${expanded ? "" : "-rotate-90"}`}
          />
        </button>
      </div>

      <div ref={contentRef} className="overflow-hidden">
        <div className="flex flex-col gap-1 pt-2">
          {filteredNodes.map((node: any) => (
            <button
              key={node.type}
              onClick={() => onAddNode(node.type)}
              className="group flex items-start justify-between px-2 py-1 rounded bg-[#1e293b]/20 border border-gray-800/50 hover:bg-[#1e293b]/40 transition-all cursor-pointer text-slate-400 hover:text-white text-left"
            >
              <div className="flex h-10 items-center justify-center gap-3">
                <div style={{ color: node.color }} className="shrink-0 mt-0.5">
                  {node.icon}
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-[11px] font-semibold truncate w-full">
                    {node.label}
                  </span>
                  <span
                    className="text-[8px] text-slate-600 group-hover:text-slate-500 font-medium leading-tight truncate w-32"
                    title={node.description}
                  >
                    {node.description}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  notebooklm: NotebookLMNode,
  gemini: GeminiNode,
  chatgpt: Chatgptnode,
  research: ResearchNode,
  export_file: ExportNode,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

function getExecutionOrder(nodes: Node[], edges: Edge[]): Node[] {
  const targetIds = new Set(edges.map((e) => e.target));
  const startNode = nodes.find((n) => !targetIds.has(n.id));
  if (!startNode) return nodes;

  const order: Node[] = [];
  const visited = new Set<string>();
  let current: Node | undefined = startNode;

  while (current && !visited.has(current.id)) {
    order.push(current);
    visited.add(current.id);
    const nextEdge = edges.find((e) => e.source === current!.id);
    current = nextEdge
      ? nodes.find((n) => n.id === nextEdge.target)
      : undefined;
  }

  nodes.forEach((n) => {
    if (!visited.has(n.id)) order.push(n);
  });
  return order;
}

type NodeType =
  | "notebooklm"
  | "gemini"
  | "chatgpt"
  | "research"
  | "export_file";

const NODE_DEFAULTS: Record<NodeType, { label: string }> = {
  notebooklm: { label: "NotebookLM" },
  gemini: { label: "Gemini" },
  chatgpt: { label: "ChatGPT" },
  research: { label: "Research" },
  export_file: { label: "Export File" },
};

export const Canvas: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const historyRef = React.useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyLength, setHistoryLength] = React.useState(0);
  const dataChangeHandlers = React.useRef(
    new Map<string, (patch: Record<string, unknown>) => void>(),
  );

  const pushHistory = React.useCallback(
    (currentNodes: Node[], currentEdges: Edge[]) => {
      historyRef.current.push({ nodes: currentNodes, edges: currentEdges });
      if (historyRef.current.length > 50) historyRef.current.shift();
      setHistoryLength(historyRef.current.length);
    },
    [],
  );

  const undo = React.useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    setHistoryLength(historyRef.current.length);
    setRedoStack((stack) => [{ nodes, edges }, ...stack]); // Save current state to redo
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [setNodes, setEdges, nodes, edges]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  const [lastSelectedNodeId, setLastSelectedNodeId] = React.useState<
    string | null
  >(null);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        pushHistory(nodes, eds);
        setRedoStack([]); // Clear redo on new action
        return addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: "#334155", strokeWidth: 1 },
          },
          eds,
        );
      });
    },
    [setEdges, nodes, pushHistory],
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (
        event.shiftKey &&
        lastSelectedNodeId &&
        lastSelectedNodeId !== node.id
      ) {
        // Connect from last to current
        const connection: Connection = {
          source: lastSelectedNodeId,
          target: node.id,
          sourceHandle: null,
          targetHandle: null,
        };

        // Check if already connected
        const exists = edges.some(
          (e) =>
            e.source === connection.source && e.target === connection.target,
        );
        if (!exists) {
          onConnect(connection);
        }
      }
      setLastSelectedNodeId(node.id);
    },
    [lastSelectedNodeId, edges, onConnect],
  );

  const onDataChange = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      );
    },
    [setNodes],
  );

  const addNode = (type: NodeType) => {
    setNodes((nds) => {
      pushHistory(nds, edges);
      setRedoStack([]); // Clear redo on new action
      const id = Math.random().toString(36).substr(2, 9);
      dataChangeHandlers.current.set(id, (patch) => onDataChange(id, patch));
      return [
        ...nds,
        {
          id,
          type,
          position: {
            x: 120 + Math.random() * 300,
            y: 120 + Math.random() * 200,
          },
          data: {
            label: NODE_DEFAULTS[type].label,
            status: "idle",
            query: "",
            files: [],
            fileData: [],
            acceptImports: true,
            maxPages: type === "research" ? 3 : 10,
            filename: type === "export_file" ? "report.pdf" : undefined,
            onDataChange: (patch: Record<string, unknown>) =>
              dataChangeHandlers.current.get(id)?.(patch),
          },
        },
      ];
    });
  };

  const setNodeStatus = (
    id: string,
    status: "idle" | "loading" | "success" | "failed",
  ) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, status } } : n)),
    );
  };

  const [isValidating, setIsValidating] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationPrompt, setGenerationPrompt] = React.useState("");

  const generateAIWorkflow = async () => {
    if (!generationPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: generationPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && data.workflow) {
          // ensure data change handlers load properly by triggering them with default handlers
          const newNodes = data.workflow.nodes.map((n: any) => ({
            ...n,
            data: {
              ...n.data,
              onDataChange: (patch: Record<string, unknown>) =>
                onDataChange(n.id, patch),
            },
          }));
          const newEdges = data.workflow.edges.map((e: any) => ({
            ...e,
            animated: true,
            style: { stroke: "#334155", strokeWidth: 1 },
          }));
          pushHistory(nodes, edges);
          setNodes(newNodes);
          setEdges(newEdges);
          setGenerationPrompt("");
        }
      }
    } catch (err) {
      console.error("Failed to generate workflow:", err);
    }
    setIsGenerating(false);
  };

  const runWorkflow = async () => {
    if (nodes.length === 0) return;

    setIsValidating(true);
    let currentNodes = [...nodes];

    try {
      const checkRes = await fetch("/api/check-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: currentNodes,
          edges,
          userQuery: generationPrompt || "Execute workflow",
        }),
      });

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.status === "success" && checkData.sanitized_nodes) {
          currentNodes = checkData.sanitized_nodes;
          // Update UI to show the AI-filled fields
          setNodes(currentNodes);
        }
      }
    } catch (err) {
      console.warn(
        "Workflow validation skipped or failed, running with current nodes:",
        err,
      );
    }

    setIsValidating(false);

    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, status: "idle" } })),
    );

    const ordered = getExecutionOrder(currentNodes, edges);
    const nodePromises: Record<string, Promise<any>> = {};

    for (const node of ordered) {
      nodePromises[node.id] = (async () => {
        // Find dependencies
        const incomingEdges = edges.filter((e) => e.target === node.id);
        const parentPromises = incomingEdges.map((e) => nodePromises[e.source]);

        // Wait for all parents to finish
        const parentOutputs = await Promise.all(parentPromises);

        let mergedOutput: any = { files: [], data: "" };
        const acceptImports = node.data.acceptImports !== false; // true by default

        if (acceptImports && parentOutputs.length > 0) {
          parentOutputs.forEach((out) => {
            if (!out) return;
            if (out.files && Array.isArray(out.files)) {
              mergedOutput.files.push(...out.files);
            }
            if (typeof out.data === "string") {
              mergedOutput.data += (mergedOutput.data ? "\n\n" : "") + out.data;
            } else if (out.data?.files) {
              mergedOutput.files.push(...out.data.files);
            }
          });
        }

        setNodeStatus(node.id, "loading");

        try {
          const res = await fetch("/api/run-node", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: node.type,
              config: {
                query: node.data.query ?? "",
                files: node.data.files ?? [],
                fileData: node.data.fileData ?? [],
                label: node.data.label ?? "",
                maxPages: node.data.maxPages ?? 10,
                mode: node.data.mode ?? "deep",
                previousOutput: mergedOutput,
              },
            }),
          });

          if (!res.ok) throw new Error(`Node ${node.id} failed`);

          const output = await res.json();
          setNodeStatus(node.id, "success");
          return output;
        } catch (err) {
          setNodeStatus(node.id, "failed");
          throw err; // Propagate failure to downstream nodes
        }
      })();
    }

    try {
      await Promise.all(Object.values(nodePromises));
    } catch (err) {
      console.warn("Workflow execution halted due to a node failure.");
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [nodeSearch, setNodeSearch] = React.useState("");
  const [redoStack, setRedoStack] = React.useState<
    { nodes: Node[]; edges: Edge[] }[]
  >([]);

  const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);

  const redo = React.useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack(redoStack.slice(1));
    pushHistory(nodes, edges);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [redoStack, nodes, edges, pushHistory, setNodes, setEdges]);

  const styledEdges = edges.map((edge) => {
    const highlighted =
      edge.selected ||
      selectedNodeIds.includes(edge.source) ||
      selectedNodeIds.includes(edge.target);
    return {
      ...edge,
      animated: highlighted || edge.animated,
      style: {
        stroke: highlighted ? "#3b82f6" : "#334155",
        strokeWidth: highlighted ? 2 : 1,
        transition: "stroke 0.2s, stroke-width 0.2s",
      },
    };
  });

  return (
    <div className="w-screen h-screen bg-[#010204] flex flex-col overflow-hidden font-sans">
      {/* Top Navbar */}
      <div className="h-11 w-full bg-[#05080f] border-b-2 border-gray-800 flex items-center justify-between px-5 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/flowmind.svg"
              alt="Flowmind Logo"
              width={15}
              height={15}
              className="rounded shadow-sm"
            />
            <h1 className="text-sm font-bold text-slate-100 tracking-tight ml-1 leading-none pt-0.5">
              FlowMind
            </h1>
            <div className="h-5 w-px bg-gray-800 ml-2" />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="p-1.5 rounded bg-[#1e293b]/30 text-slate-400 hover:text-white border border-gray-800 transition-all cursor-pointer"
              title="Save"
            >
              <Save size={14} />
            </button>
            <button
              className="p-1.5 rounded bg-[#1e293b]/30 text-slate-400 hover:text-white border border-gray-800 transition-all cursor-pointer"
              title="Import"
            >
              <Upload size={14} />
            </button>
          </div>

          <div className="h-5 w-px bg-[#1e293b]/50 mx-1" />

          <div className="flex items-center gap-0.5 bg-[#010204]/50 p-0.5 rounded border border-gray-800/50">
            <button
              onClick={undo}
              disabled={historyLength === 0}
              className="p-1 text-slate-500 hover:text-slate-200 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              className="p-1 text-slate-500 hover:text-slate-200 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-4 flex items-center bg-[#010204] border border-gray-800 rounded px-2 h-7 focus-within:border-blue-500/50 transition-colors">
          <input
            type="text"
            value={generationPrompt}
            onChange={(e) => setGenerationPrompt(e.target.value)}
            placeholder="Describe a workflow to generate... (e.g. Research quantum physics and summarize it)"
            className="w-full bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-600 font-medium"
            onKeyDown={(e) => {
              if (e.key === "Enter") generateAIWorkflow();
            }}
          />
          <button
            onClick={generateAIWorkflow}
            disabled={isGenerating || !generationPrompt.trim()}
            className="text-slate-500 hover:text-blue-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors flex items-center justify-center p-1"
            title="Compile Workflow"
          >
            {isGenerating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
          </button>
        </div>

        <div className="flex items-center">
          <button
            onClick={runWorkflow}
            disabled={nodes.length === 0 || isValidating}
            className="flex items-center gap-2 justify-center p-[6px_12px] rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all font-bold active:scale-[0.98] cursor-pointer"
            title="Execute Workflow"
          >
            {isValidating ? (
              <span className="text-xs uppercase tracking-wider animate-pulse">
                Checking...
              </span>
            ) : (
              <>
                <span className="text-xs uppercase tracking-wider">Run</span>
                <Play size={12} fill="currentColor" />
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Minimal Sidebar - No Header */}
        <div
          className={`${isSidebarOpen ? "w-52  border-r-2" : "w-0  border-r-0"} shrink-0 h-full bg-[#05080f] border-gray-800 flex flex-col z-40 transition-[width] duration-300 relative`}
        >
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-12 bg-[#05080f] border-2 border-l-0 border-gray-800 rounded-r-lg flex items-center justify-center text-slate-400 hover:text-white transition-all z-50 cursor-pointer text-[10px]"
          >
            {isSidebarOpen ? "‹" : "›"}
          </button>

          <div className="overflow-hidden w-full h-full">
            <div className="w-52 flex flex-col h-full p-3 gap-3">
              <div className="flex items-center bg-[#010204] border border-gray-800 rounded py-1.5 px-2 text-xs relative">
                <Search size={12} className="text-slate-500 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search nodes..."
                  value={nodeSearch}
                  onChange={(e) => setNodeSearch(e.target.value)}
                  className="bg-transparent text-slate-300 w-full outline-none placeholder:text-slate-600 pr-5"
                />
                {nodeSearch && (
                  <button
                    onClick={() => setNodeSearch("")}
                    className="absolute right-2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex flex-col overflow-y-auto custom-scrollbar flex-1 pb-4">
                {[
                  {
                    title: "Data Sources",
                    nodes: [
                      {
                        type: "research",
                        label: "Research",
                        description: "Web search and data extraction",
                        icon: <Search size={14} />,
                        color: "#3b82f6",
                      },
                    ],
                  },
                  {
                    title: "AI Models",
                    nodes: [
                      {
                        type: "notebooklm",
                        label: "NotebookLM",
                        description: "Contextual grounding and synthesis",
                        icon: (
                          <Image
                            src={"/notebooklm.svg"}
                            className="bg-white p-0.5 rounded-full"
                            alt="notebooklm"
                            height={14}
                            width={14}
                          />
                        ),
                        color: "#10b981",
                      },
                      {
                        type: "gemini",
                        label: "Gemini AI",
                        description: "Advanced reasoning and generation",
                        icon: (
                          <Image
                            src={"/gemini.svg"}
                            alt="gemini"
                            height={14}
                            width={14}
                          />
                        ),
                        color: "#a855f7",
                      },
                      {
                        type: "chatgpt",
                        label: "ChatGPT",
                        description:
                          "Advanced structural reasoning (LaTeX natively)",
                        icon: (
                          <Image
                            src={"/ChatGPT.svg"}
                            alt="gemini"
                            className="bg-white p-0.5 rounded-full"
                            height={16}
                            width={16}
                          />
                        ),
                        color: "#10a37f",
                      },
                    ],
                  },
                  {
                    title: "Actions",
                    nodes: [
                      {
                        type: "export_file",
                        label: "Export File",
                        description:
                          "Compiles contextual output and renders a physical .pdf or .md file.",
                        icon: <FileDown size={14} />,
                        color: "#f97316",
                      },
                    ],
                  },
                ].map((category) => (
                  <SidebarCategory
                    key={category.title}
                    category={category}
                    onAddNode={addNode}
                    nodeSearch={nodeSearch}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-[#010204] min-h-0 min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            defaultViewport={{ x: 50, y: 50, zoom: 0.9 }}
            minZoom={0.1}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            className="bg-[#010204]"
          >
            <Background
              variant={BackgroundVariant.Lines}
              gap={30}
              size={1}
              color="#334155"
              className="opacity-40"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};
