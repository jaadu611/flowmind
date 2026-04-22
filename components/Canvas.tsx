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
import { Plus, Play } from "lucide-react";

const nodeTypes = { notebooklm: NotebookLMNode };
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

export const Canvas: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const historyRef = React.useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);

  const dataChangeHandlers = React.useRef(
    new Map<string, (patch: Record<string, unknown>) => void>(),
  );

  const pushHistory = React.useCallback(
    (currentNodes: Node[], currentEdges: Edge[]) => {
      historyRef.current.push({ nodes: currentNodes, edges: currentEdges });
      if (historyRef.current.length > 50) historyRef.current.shift();
    },
    [],
  );

  const undo = React.useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [setNodes, setEdges]);

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

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        pushHistory(nodes, eds);
        return addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: "rgba(255,255,255,0.2)", strokeWidth: 2 },
          },
          eds,
        );
      });
    },
    [setEdges, nodes, pushHistory],
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

  const addNode = (type: "notebooklm") => {
    setNodes((nds) => {
      pushHistory(nds, edges);
      const id = Math.random().toString(36).substr(2, 9);

      // Register a stable handler in the ref map
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
            label: "NotebookLM",
            status: "idle",
            query: "",
            files: [],
            urls: [],
            researchMode: "fast",
            advancedSettings: {},
            // Delegate through the ref so it's always current
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

  const runWorkflow = async () => {
    if (nodes.length === 0) return;

    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, status: "idle" } })),
    );

    const ordered = getExecutionOrder(nodes, edges);

    for (const node of ordered) {
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
              fileData: node.data.fileData ?? [], // ← Include base64 data
              urls: node.data.urls ?? [],
              researchMode: node.data.researchMode ?? "fast",
              advancedSettings: node.data.advancedSettings ?? {},
            },
          }),
        });

        if (!res.ok) throw new Error(`Node ${node.id} failed`);
        setNodeStatus(node.id, "success");
      } catch {
        setNodeStatus(node.id, "failed");
        break;
      }
    }
  };

  // Highlight edges connected to selected nodes
  const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
  const styledEdges = edges.map((edge) => {
    const highlighted =
      selectedNodeIds.includes(edge.source) ||
      selectedNodeIds.includes(edge.target);
    return {
      ...edge,
      animated: highlighted,
      style: {
        stroke: highlighted
          ? "rgba(255,255,255,0.85)"
          : "rgba(255,255,255,0.2)",
        strokeWidth: highlighted ? 3 : 2,
      },
    };
  });

  return (
    <div className="w-full h-screen bg-[#090f1c]">
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl">
        <button
          onClick={() => addNode("notebooklm")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/20 transition-all font-medium text-sm"
        >
          <Plus size={16} /> NotebookLM
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <button
          onClick={runWorkflow}
          disabled={nodes.length === 0}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-lg shadow-emerald-500/20"
        >
          <Play size={14} fill="currentColor" /> Run
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <button
          onClick={undo}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 border border-white/10 transition-all font-medium text-sm"
        >
          ↩ Undo
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-[#0a0a0a]"
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={52}
          lineWidth={0.5}
          color="rgba(148,163,210,0.45)"
        />
      </ReactFlow>
    </div>
  );
};
