"use client";

import React, { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

type Status = "idle" | "loading" | "success" | "failed";

interface ResearchNodeProps {
  data: {
    label?: string;
    status?: Status;
    query?: string;
    maxPages?: number;
    mode?: "surface" | "deep";
    onDataChange?: (patch: Record<string, unknown>) => void;
  };
  selected?: boolean;
}

export const ResearchNode: React.FC<ResearchNodeProps> = ({
  data,
  selected,
}) => {
  const status: Status = data.status ?? "idle";
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState(data.query ?? "");

  const borderColor = {
    idle: selected ? "#f59e0b" : "#333",
    loading: "#f59e0b",
    success: "#22c55e",
    failed: "#ef4444",
  }[status];

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        background: "#111",
        color: "#fff",
        fontSize: 12,
        width: 240,
        transition: "border-color 0.2s",
      }}
    >
      <Handle type="target" position={Position.Left} />

      {/* Header */}
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Search size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 13, flex: 1 }}>
          {data.label ?? "Research"}
        </p>

        {/* Status indicator */}
        {status === "loading" && (
          <div
            style={{
              width: 14,
              height: 14,
              border: "2px solid #555",
              borderTop: "2px solid #f59e0b",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              flexShrink: 0,
            }}
          />
        )}
        {status === "success" && (
          <span style={{ color: "#22c55e", fontSize: 16 }}>✓</span>
        )}
        {status === "failed" && (
          <span style={{ color: "#ef4444", fontSize: 16 }}>✕</span>
        )}
        {status === "idle" && (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#444",
              flexShrink: 0,
            }}
          />
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="nodrag"
          style={{
            background: "none",
            border: "1px solid #333",
            borderRadius: 4,
            color: "#aaa",
            cursor: "pointer",
            fontSize: 11,
            padding: "2px 6px",
          }}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {expanded && (
        <div
          style={{
            borderTop: "1px solid #222",
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Query */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label
              style={{
                color: "#666",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Search Query
            </label>
            <textarea
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                data.onDataChange?.({ query: e.target.value });
              }}
              placeholder="What do you want to research?"
              rows={3}
              className="nodrag"
              style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: 6,
                color: "#fff",
                fontSize: 11,
                padding: "5px 8px",
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
                resize: "none",
              }}
            />
          </div>

          {/* Mode Toggle */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Research Mode
            </label>
            <div style={{ 
              display: "flex", 
              background: "#1a1a1a", 
              borderRadius: 6, 
              padding: "2px", 
              border: "1px solid #2a2a2a" 
            }}>
              <button
                onClick={() => {
                  let nextPages = data.maxPages ?? 3;
                  if (nextPages > 5) nextPages = 5;
                  if (nextPages < 1) nextPages = 1;
                  data.onDataChange?.({ 
                    mode: "surface", 
                    maxPages: nextPages 
                  });
                }}
                className="nodrag"
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  fontSize: 10,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: (data.mode ?? "deep") === "surface" ? "#333" : "transparent",
                  color: (data.mode ?? "deep") === "surface" ? "#fff" : "#666",
                  transition: "all 0.2s"
                }}
              >
                Surface
              </button>
              <button
                onClick={() => {
                  let nextPages = data.maxPages ?? 3;
                  // Snap to nearest multiple of 3 for deep mode
                  nextPages = Math.round(nextPages / 3) * 3;
                  if (nextPages < 3) nextPages = 3;
                  if (nextPages > 15) nextPages = 15;
                  data.onDataChange?.({ 
                    mode: "deep",
                    maxPages: nextPages
                  });
                }}
                className="nodrag"
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  fontSize: 10,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: (data.mode ?? "deep") === "deep" ? "#333" : "transparent",
                  color: (data.mode ?? "deep") === "deep" ? "#fff" : "#666",
                  transition: "all 0.2s"
                }}
              >
                Deep
              </button>
            </div>
          </div>

          {/* Research Depth Slider */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              style={{
                color: "#666",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{ (data.mode ?? "deep") === "surface" ? "Pages" : "Sampling Depth" }</span>
              <span style={{ color: "#f59e0b", fontWeight: "bold" }}>{data.maxPages ?? 3} Pages</span>
            </label>
            <input
              type="range"
              min={(data.mode ?? "deep") === "surface" ? 1 : 3}
              max={(data.mode ?? "deep") === "surface" ? 5 : 15}
              step={(data.mode ?? "deep") === "surface" ? 1 : 3}
              value={data.maxPages ?? 3}
              onChange={(e) => {
                const val = Number(e.target.value);
                data.onDataChange?.({ maxPages: val });
              }}
              className="nodrag"
              style={{ 
                width: "100%", 
                accentColor: "#f59e0b",
                height: "4px",
                cursor: "pointer"
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#444",
                fontSize: 9,
                padding: "0 2px"
              }}
            >
              { (data.mode ?? "deep") === "surface" ? (
                <><span>1</span><span>5</span></>
              ) : (
                [3, 6, 9, 12, 15].map(v => <span key={v}>{v}</span>)
              )}
            </div>
          </div>

          {/* Strategy Info */}
          <div style={{ 
            background: "#1a1a1a", 
            padding: "8px", 
            borderRadius: 6, 
            border: "1px solid #222",
            fontSize: 10,
            color: "#888"
          }}>
            <p style={{ margin: "0 0 5px 0", color: "#f59e0b", fontWeight: "bold" }}>
              {(data.mode ?? "deep") === "surface" ? "Surface Research" : "Deep Strategy Active"}
            </p>
            { (data.mode ?? "deep") === "surface" ? (
              <p style={{ margin: 0 }}>Scraping <b>all links</b> sequentially from the first <b>{data.maxPages ?? 3} pages</b>.</p>
            ) : (
              <>
                <p style={{ margin: 0 }}>Sampling <b>all links</b> from:</p>
                <ul style={{ margin: "5px 0", paddingLeft: "15px" }}>
                  <li>{Math.max(1, (data.maxPages ?? 3) / 3)} pages from <b>Top</b></li>
                  <li>{Math.max(1, (data.maxPages ?? 3) / 3)} pages from <b>Middle</b></li>
                  <li>{Math.max(1, (data.maxPages ?? 3) / 3)} pages from <b>Deep</b></li>
                </ul>
              </>
            )}
            <p style={{ margin: "5px 0 0 0", fontStyle: "italic", color: "#666" }}>
              {(data.mode ?? "deep") === "surface" ? "Best for quick, popular results." : `Total ${(data.maxPages ?? 3)} pages sampled. Uncapped results discovery.`}
            </p>
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Right} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
