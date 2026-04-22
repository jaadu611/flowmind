"use client";

import React, { useState, useRef } from "react";
import { Handle, Position } from "@xyflow/react";

type Status = "idle" | "loading" | "success" | "failed";
type ResearchMode = "fast" | "deep";
type AudioFormat = "deep-dive" | "brief" | "critique" | "debate";
type AudioLength = "shorter" | "default" | "longer";

interface AdvancedSettings {
  audioOverview: boolean;
  videoOverview: boolean;
  slideDeck: boolean;
  mindMap: boolean;
  reports: boolean;
  flashcards: boolean;
  quiz: boolean;
  infographic: boolean;
  dataTable: boolean;
  audioFormat: AudioFormat;
  audioLanguage: string;
  audioLength: AudioLength;
  audioFocus: string;
}

interface NotebookLMNodeProps {
  data: {
    fileData: string[]; // base64 encoded file contents
    label?: string;
    status?: Status;
    query?: string;
    files?: string[]; // file names
    urls?: string[];
    researchMode?: ResearchMode;
    advancedSettings?: AdvancedSettings;
    onDataChange?: (patch: Record<string, unknown>) => void;
  };
  selected?: boolean;
}

const DEFAULT_ADVANCED: AdvancedSettings = {
  audioOverview: false,
  videoOverview: false,
  slideDeck: false,
  mindMap: false,
  reports: false,
  flashcards: false,
  quiz: false,
  infographic: false,
  dataTable: false,
  audioFormat: "deep-dive",
  audioLanguage: "English",
  audioLength: "default",
  audioFocus: "",
};

const AUDIO_FORMATS: { value: AudioFormat; label: string; desc: string }[] = [
  {
    value: "deep-dive",
    label: "Deep Dive",
    desc: "A lively conversation between two hosts, unpacking and connecting topics in your sources",
  },
  {
    value: "brief",
    label: "Brief",
    desc: "A bite-sized overview to help you grasp the core ideas from your sources quickly",
  },
  {
    value: "critique",
    label: "Critique",
    desc: "An expert review of your sources, offering constructive feedback to help you improve your material",
  },
  {
    value: "debate",
    label: "Debate",
    desc: "A thoughtful debate between two hosts, illuminating different perspectives on your sources",
  },
];

const STUDIO_OUTPUTS: {
  key: keyof AdvancedSettings;
  label: string;
  icon: string;
}[] = [
  { key: "audioOverview", label: "Audio Overview", icon: "🎙️" },
  { key: "videoOverview", label: "Video Overview", icon: "🎬" },
  { key: "slideDeck", label: "Slide Deck", icon: "📊" },
  { key: "mindMap", label: "Mind Map", icon: "🗺️" },
  { key: "reports", label: "Reports", icon: "📄" },
  { key: "flashcards", label: "Flashcards", icon: "🃏" },
  { key: "quiz", label: "Quiz", icon: "❓" },
  { key: "infographic", label: "Infographic", icon: "🖼️" },
  { key: "dataTable", label: "Data Table", icon: "🗃️" },
];

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

const AudioCustomization: React.FC<{
  adv: AdvancedSettings;
  patchAdv: (p: Partial<AdvancedSettings>) => void;
}> = ({ adv, patchAdv }) => (
  <div
    style={{
      background: "#0d0d0d",
      border: "1px solid #1e1e1e",
      borderRadius: 6,
      padding: 10,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      marginTop: 4,
    }}
  >
    <Label>Customize Audio Overview</Label>

    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ color: "#555", fontSize: 10 }}>Format</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {AUDIO_FORMATS.map((f) => {
          const active = adv.audioFormat === f.value;
          return (
            <button
              key={f.value}
              onClick={() => patchAdv({ audioFormat: f.value })}
              className="nodrag"
              style={{
                background: active ? "#2dd4bf18" : "#1a1a1a",
                border: `1px solid ${active ? "#2dd4bf55" : "#2a2a2a"}`,
                borderRadius: 5,
                color: active ? "#2dd4bf" : "#555",
                cursor: "pointer",
                fontSize: 10,
                padding: "6px 8px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  fontWeight: active ? 600 : 400,
                  marginBottom: 2,
                  color: active ? "#2dd4bf" : "#aaa",
                }}
              >
                {f.label}
              </div>
              <div style={{ color: "#555", fontSize: 9, lineHeight: 1.4 }}>
                {f.desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ color: "#555", fontSize: 10 }}>Language</span>
      <input
        value={adv.audioLanguage}
        onChange={(e) => patchAdv({ audioLanguage: e.target.value })}
        placeholder="e.g. English, Spanish..."
        className="nodrag"
        style={inputStyle}
      />
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ color: "#555", fontSize: 10 }}>Length</span>
      <div
        style={{
          display: "flex",
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: 6,
          padding: 2,
          gap: 2,
        }}
      >
        {(["shorter", "default", "longer"] as AudioLength[]).map((l) => (
          <button
            key={l}
            onClick={() => patchAdv({ audioLength: l })}
            className="nodrag"
            style={{
              flex: 1,
              padding: "4px 0",
              fontSize: 10,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              background: adv.audioLength === l ? "#ffffff18" : "transparent",
              color: adv.audioLength === l ? "#ddd" : "#555",
              fontWeight: adv.audioLength === l ? 600 : 400,
              textTransform: "capitalize",
            }}
          >
            {l}
          </button>
        ))}
      </div>
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ color: "#555", fontSize: 10 }}>
        What should the AI hosts focus on?
      </span>
      <textarea
        value={adv.audioFocus}
        onChange={(e) => patchAdv({ audioFocus: e.target.value })}
        placeholder="e.g. Focus on key findings..."
        rows={2}
        className="nodrag"
        style={{ ...inputStyle, resize: "none" }}
      />
    </div>
  </div>
);

export const NotebookLMNode: React.FC<NotebookLMNodeProps> = ({
  data,
  selected,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [query, setQuery] = useState(data.query ?? "");
  const [files, setFiles] = useState<string[]>(data.files ?? []);
  const [fileData, setFileData] = useState<string[]>(data.fileData ?? []);
  const [urlInput, setUrlInput] = useState("");
  const [urls, setUrls] = useState<string[]>(data.urls ?? []);
  const [researchMode, setResearchMode] = useState<ResearchMode>(
    data.researchMode ?? "fast",
  );
  const [adv, setAdv] = useState<AdvancedSettings>(
    data.advancedSettings ?? { ...DEFAULT_ADVANCED },
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patch = (update: Record<string, unknown>) =>
    data.onDataChange?.(update);

  const patchAdv = (partial: Partial<AdvancedSettings>) => {
    const next = { ...adv, ...partial };
    setAdv(next);
    patch({ advancedSettings: next });
  };

  const toggleMode = (mode: ResearchMode) => {
    setResearchMode(mode);
    patch({ researchMode: mode });
  };

  const addUrl = () => {
    if (!urlInput.trim()) return;
    const next = [...urls, urlInput.trim()];
    setUrls(next);
    setUrlInput("");
    patch({ urls: next });
  };

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
    <>
      <div
        style={{
          display: "flex",
          border: `1px solid ${selected ? "#2dd4bf" : "#333"}`,
          borderRadius: 8,
          background: "#111",
          color: "#fff",
          fontSize: 12,
        }}
      >
        <Handle type="target" position={Position.Left} />

        <div style={{ width: 240, flexShrink: 0 }}>
          <div
            style={{
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, flex: 1 }}>
              {data.label ?? "NotebookLM"}
            </p>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Label>Research Mode</Label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["fast", "deep"] as ResearchMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => toggleMode(mode)}
                      className="nodrag"
                      style={{
                        background: "none",
                        border: "none",
                        padding: "2px 0",
                        cursor: "pointer",
                        fontSize: 11,
                        color: researchMode === mode ? "#fff" : "#444",
                        fontWeight: researchMode === mode ? 600 : 400,
                        borderBottom: `1px solid ${researchMode === mode ? "#2dd4bf" : "transparent"}`,
                      }}
                    >
                      {mode === "fast" ? "⚡ Fast" : "🔬 Deep"}
                    </button>
                  ))}
                </div>
              </div>

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
                  onClick={() => fileInputRef.current?.click()}
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

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Label>Links</Label>
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addUrl()}
                    placeholder="https://..."
                    className="nodrag"
                    style={{ ...inputStyle, flex: 1, width: "auto" }}
                  />
                  <button
                    onClick={addUrl}
                    className="nodrag"
                    style={{
                      background: "#1a1a1a",
                      border: "1px solid #2a2a2a",
                      borderRadius: 6,
                      color: "#aaa",
                      cursor: "pointer",
                      padding: "5px 8px",
                      fontSize: 11,
                    }}
                  >
                    +
                  </button>
                </div>
                {urls.map((u, i) => (
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
                      {u}
                    </span>
                    <button
                      onClick={() => {
                        const next = urls.filter((_, j) => j !== i);
                        setUrls(next);
                        patch({ urls: next });
                      }}
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

              <button
                onClick={() => setAdvancedOpen((v) => !v)}
                className="nodrag"
                style={{
                  background: advancedOpen ? "#1a1a1a" : "transparent",
                  border: "1px solid #2a2a2a",
                  borderRadius: 6,
                  color: advancedOpen ? "#aaa" : "#555",
                  cursor: "pointer",
                  fontSize: 11,
                  padding: "5px 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <span>⚙️ Advanced Settings</span>
                <span style={{ fontSize: 9 }}>{advancedOpen ? "◀" : "▶"}</span>
              </button>
            </div>
          )}
        </div>

        {expanded && advancedOpen && (
          <div
            style={{
              width: 220,
              flexShrink: 0,
              borderLeft: "1px solid #222",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              overflowY: "auto",
              maxHeight: 500,
            }}
          >
            <Label>Studio Outputs</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {STUDIO_OUTPUTS.map(({ key, label, icon }) => {
                const active = adv[key] as boolean;
                return (
                  <React.Fragment key={key}>
                    <button
                      onClick={() => patchAdv({ [key]: !active })}
                      className="nodrag"
                      style={{
                        background: active ? "#2dd4bf18" : "#1a1a1a",
                        border: `1px solid ${active ? "#2dd4bf55" : "#2a2a2a"}`,
                        borderRadius: 5,
                        color: active ? "#2dd4bf" : "#aaa",
                        cursor: "pointer",
                        fontSize: 11,
                        padding: "6px 8px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        textAlign: "left",
                        width: "100%",
                      }}
                    >
                      <span>{icon}</span>
                      <span>{label}</span>
                      {active && (
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 9,
                            color: "#2dd4bf",
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                    {key === "audioOverview" && active && (
                      <AudioCustomization adv={adv} patchAdv={patchAdv} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        <Handle type="source" position={Position.Right} />
      </div>
    </>
  );
};
