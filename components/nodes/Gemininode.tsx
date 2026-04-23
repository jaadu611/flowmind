"use client";

import React, { useState, useRef } from "react";
import { Handle, Position } from "@xyflow/react";

type Status = "idle" | "loading" | "success" | "failed";

interface GeminiNodeProps {
  data: {
    label?: string;
    status?: Status;
    query?: string;
    files?: string[];
    fileData?: string[];
    onDataChange?: (patch: Record<string, unknown>) => void;
  };
  selected?: boolean;
}

const inputStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  color: "#fff",
  fontSize: 11,
  padding: "5px 8px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label
    style={{
      color: "#666",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    }}
  >
    {children}
  </label>
);

const STATUS_COLOR: Record<Status, string> = {
  idle: "#333",
  loading: "#f59e0b",
  success: "#4285f4",
  failed: "#ef4444",
};

export const GeminiNode: React.FC<GeminiNodeProps> = ({ data, selected }) => {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState(data.query ?? "");
  const [files, setFiles] = useState<string[]>(data.files ?? []);
  const [fileData, setFileData] = useState<string[]>(data.fileData ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const status: Status = data.status ?? "idle";
  const patch = (update: Record<string, unknown>) =>
    data.onDataChange?.(update);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files ?? []);
    if (rawFiles.length === 0) return;

    const names: string[] = [];
    const datas: string[] = [];

    for (const file of rawFiles) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      names.push(file.name);
      datas.push(base64);
    }

    const nextFiles = [...files, ...names];
    const nextData = [...fileData, ...datas];
    setFiles(nextFiles);
    setFileData(nextData);
    patch({ files: nextFiles, fileData: nextData });
  };

  const removeFile = (index: number) => {
    const nextFiles = files.filter((_, i) => i !== index);
    const nextData = fileData.filter((_, i) => i !== index);
    setFiles(nextFiles);
    setFileData(nextData);
    patch({ files: nextFiles, fileData: nextData });
  };

  return (
    <div
      style={{
        border: `1px solid ${selected ? "#4285f4" : "#333"}`,
        borderRadius: 8,
        background: "#111",
        color: "#fff",
        fontSize: 12,
        width: 240,
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
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: STATUS_COLOR[status],
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, flex: 1 }}>{data.label ?? "Gemini"}</span>
        <button
          onClick={() => setExpanded((v) => !v)}
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
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {/* Body */}
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
          {/* Prompt */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Label>Prompt</Label>
            <textarea
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                patch({ query: e.target.value });
              }}
              placeholder="Enter your prompt..."
              rows={3}
              className="nodrag"
              style={{ ...inputStyle, resize: "none" }}
            />
          </div>

          {/* File upload */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Label>Files</Label>
            <label
              className="nodrag"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 8px",
                border: "1px dashed #2a2a2a",
                borderRadius: 6,
                cursor: "pointer",
                color: "#555",
                fontSize: 11,
              }}
            >
              + Upload files
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
            </label>
            {files.map((f, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#1a1a1a",
                  borderRadius: 4,
                  padding: "3px 6px",
                  fontSize: 10,
                  color: "#666",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {f}
                </span>
                <button
                  onClick={() => removeFile(i)}
                  className="nodrag"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#555",
                    cursor: "pointer",
                    marginLeft: 4,
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
};
