"use client";

import React, { useState, useRef, useEffect } from "react";
import { Handle, Position, useNodeConnections } from "@xyflow/react";
import { CheckCircle2, XCircle, Loader2, Clock, ChevronDown, Save } from "lucide-react";
import gsap from "gsap";

type Status = "idle" | "loading" | "success" | "failed";

interface ExportNodeProps {
  data: {
    label?: string;
    status?: Status;
    filename?: string;
    onDataChange?: (patch: Record<string, unknown>) => void;
  };
  selected?: boolean;
}

export const ExportNode: React.FC<ExportNodeProps> = ({ data, selected }) => {
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
  
  const [filename, setFilename] = useState(data.filename ?? "report.pdf");
  const contentRef = useRef<HTMLDivElement>(null);

  const status: Status = data.status ?? "idle";
  const patch = (update: Record<string, unknown>) =>
    data.onDataChange?.(update);

  useEffect(() => {
    if (data.filename !== undefined && data.filename !== filename) {
      setFilename(data.filename);
    }
  }, [data.filename, filename]);

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
        ${selected ? "border border-blue-500" : "border border-gray-800"}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        title="Input Context"
        className="bg-[#010204]! border! border-blue-500! w-2.5! h-2.5! top-[27px]! -translate-y-1/2!"
      />

      {/* Header */}
      <div
        className="p-[10px_12px] flex items-center gap-1.5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <Save size={14} className="text-orange-400" />
        <span className="text-[13px] flex-1">{data.label ?? "Export File"}</span>
        
        {status === "idle" && <Clock size={12} className="text-slate-500 shrink-0" />}
        {status === "loading" && <Loader2 size={12} className="text-blue-500 animate-spin shrink-0" />}
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
          {/* Filename */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Filename</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => {
                setFilename(e.target.value);
                patch({ filename: e.target.value });
              }}
              placeholder="e.g., report.pdf"
              className="nodrag w-full bg-[#05080f] border border-gray-800 rounded p-2 text-[11px] text-[#f8fafc] outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="text-[10px] text-slate-500 italic">
            Saves upstream data to a formatted file.
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        title="Execution Output"
        className="bg-[#010204]! border! border-blue-500! w-2.5! h-2.5! top-[27px]! -translate-y-1/2!"
      />
    </div>
  );
};
