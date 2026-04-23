"use client";

import React, { useState, useRef, useEffect } from "react";
import { Handle, Position, useNodeConnections } from "@xyflow/react";
import { CheckCircle2, XCircle, Loader2, Clock, ChevronDown } from "lucide-react";
import gsap from "gsap";

type Status = "idle" | "loading" | "success" | "failed";

interface NotebookLMNodeProps {
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

export const NotebookLMNode: React.FC<NotebookLMNodeProps> = ({
  data,
  selected,
}) => {
  const targetConnections = useNodeConnections({ handleType: "target" });
  const sourceConnections = useNodeConnections({ handleType: "source" });
  
  const isFirst = targetConnections.length === 0;
  const isLast = sourceConnections.length === 0;
  
  const [expanded, setExpanded] = useState(false);

  let roundingClass = "rounded-md";
  if (isFirst && !isLast) roundingClass = "rounded-l-2xl rounded-r-sm";
  else if (!isFirst && isLast) roundingClass = "rounded-r-2xl rounded-l-sm";
  else if (!isFirst && !isLast) roundingClass = "rounded-sm";
  else roundingClass = "rounded-2xl";
  const [query, setQuery] = useState(data.query ?? "");
  const [files, setFiles] = useState<string[]>(data.files ?? []);
  const [fileData, setFileData] = useState<string[]>(data.fileData ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const status: Status = data.status ?? "idle";
  const patch = (update: Record<string, unknown>) =>
    data.onDataChange?.(update);

  useEffect(() => {
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
      className={`
        w-[240px] 
        bg-[#010204] 
        text-[#f8fafc] 
        text-[12px] 
        ${roundingClass} 
        transition-colors 
        duration-200 
        border-solid
        border
        cursor-grab active:cursor-grabbing
        ${selected ? "border-[#8b4513]" : "border-gray-800"}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        title="Input Context"
        className="bg-[#010204]! border! border-[#8b4513]! w-2.5! h-2.5! top-[27px]! -translate-y-1/2!"
      />

      {/* Header */}
      <div
        className="p-[10px_12px] flex items-center gap-1.5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <img src="/notebooklm.svg" width={14} height={14} alt="NotebookLM" />
        <span className="text-[13px] flex-1">{data.label ?? "NotebookLM"}</span>
        
        {status === "idle" && <Clock size={12} className="text-slate-500 shrink-0" />}
        {status === "loading" && <Loader2 size={12} className="text-[#8b4513] animate-spin shrink-0" />}
        {status === "success" && <CheckCircle2 size={12} className="text-green-500 shrink-0" />}
        {status === "failed" && <XCircle size={12} className="text-red-500 shrink-0" />}

        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="nodrag bg-none border border-gray-800 rounded flex items-center justify-center p-0.5 text-slate-400 cursor-pointer hover:text-slate-200 hover:border-slate-600 transition-colors"
        >
          <ChevronDown size={14} className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Body */}
      <div ref={contentRef} className="overflow-hidden h-0 opacity-0">
        <div className="border-t border-gray-800 p-[10px_12px] flex flex-col gap-[10px]">
          {/* Prompt */}
          <div className="flex flex-col gap-2">
            <textarea
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                patch({ query: e.target.value });
              }}
              placeholder="System prompt or query..."
              rows={3}
              className="nodrag w-full bg-[#05080f] border border-gray-800 rounded p-2 text-[11px] text-[#f8fafc] outline-none focus:border-[#8b4513] transition-colors resize-none"
            />
          </div>

          {/* Files */}
          <div className="flex flex-col gap-3 border-t border-gray-800/30 pt-4 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                Context
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition-all cursor-pointer"
              >
                + UPLOAD
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
              {files.length === 0 && (
                <span className="text-[10px] text-slate-600 italic px-1">
                  No files attached
                </span>
              )}
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center bg-[#05080f] rounded p-[4px_8px] text-[10px] text-slate-400 border border-gray-800/30"
                >
                  <span className="truncate flex-1">{f}</span>
                  <button
                    onClick={() => removeFile(i)}
                    className="nodrag ml-2 text-slate-600 hover:text-red-400 transition-all cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        title="Execution Output"
        className="bg-[#010204]! border! border-[#8b4513]! w-2.5! h-2.5! top-[27px]! -translate-y-1/2!"
      />
    </div>
  );
};
