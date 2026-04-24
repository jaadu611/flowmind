"use client";

import React, { useState, useRef, useEffect } from "react";
import { Handle, Position, useNodeConnections } from "@xyflow/react";
import { ChevronDown, ChevronUp, Search, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import gsap from "gsap";

type Status = "idle" | "loading" | "success" | "failed";

interface ResearchNodeProps {
  data: {
    label?: string;
    status?: Status;
    query?: string;
    maxPages?: number;
    sites?: string[];
    onDataChange?: (patch: Record<string, unknown>) => void;
  };
  selected?: boolean;
}

export const ResearchNode: React.FC<ResearchNodeProps> = ({
  data,
  selected,
}) => {
  const targetConnections = useNodeConnections({ handleType: "target" });
  const sourceConnections = useNodeConnections({ handleType: "source" });
  
  const isFirst = targetConnections.length === 0;
  const isLast = sourceConnections.length === 0;
  
  const status: Status = data.status ?? "idle";
  const [expanded, setExpanded] = useState(false);

  let roundingClass = "rounded-md";
  if (isFirst && !isLast) roundingClass = "rounded-l-2xl rounded-r-sm";
  else if (!isFirst && isLast) roundingClass = "rounded-r-2xl rounded-l-sm";
  else if (!isFirst && !isLast) roundingClass = "rounded-sm";
  else roundingClass = "rounded-2xl";
  const [query, setQuery] = useState(data.query ?? "");
  const contentRef = useRef<HTMLDivElement>(null);

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
        border
        border-solid
        cursor-grab active:cursor-grabbing
        ${selected ? "border-orange-500" : "border-gray-800"}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        title="Input Context"
        className="bg-[#010204]! border! border-orange-500! w-2.5! h-2.5! top-[27px]! -translate-y-1/2!"
      />

      {/* Header */}
      <div
        className="p-3 flex items-center gap-[10px] cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <Search size={14} className="text-orange-500 shrink-0" />
        <p className="m-0 text-[13px] flex-1">{data.label ?? "Research"}</p>

        {/* Status indicator */}
        {status === "idle" && <Clock size={12} className="text-slate-500 shrink-0" />}
        {status === "loading" && <Loader2 size={12} className="text-orange-500 animate-spin shrink-0" />}
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

      <div ref={contentRef} className="overflow-hidden h-0 opacity-0">
        <div className="border-t border-gray-800 p-3 flex flex-col gap-[10px]">
          {/* Search Query */}
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                data.onDataChange?.({ query: e.target.value });
              }}
              placeholder="Search query..."
              className="nodrag w-full bg-[#05080f] border border-gray-800 rounded p-2 text-[11px] text-[#f8fafc] outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Controls Group */}
          <div className="flex flex-col gap-4 border-t border-gray-800/30 pt-4 mt-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 uppercase font-bold tracking-wider">
                  Depth
                </span>
                <span className="text-orange-400 font-bold">
                  {data.maxPages ?? 3}p
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={data.maxPages ?? 3}
                onChange={(e) =>
                  data.onDataChange?.({ maxPages: parseInt(e.target.value) })
                }
                className="nodrag accent-orange-500 h-1 cursor-pointer w-full"
              />
            </div>

            {/* Specific Sites */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                Specific Sites
              </span>
              <textarea
                value={(data.sites ?? []).join(", ")}
                onChange={(e) => {
                  const val = e.target.value;
                  const sitesArr = val.split(",").map((s) => s.trim()).filter(Boolean);
                  data.onDataChange?.({ sites: sitesArr });
                }}
                placeholder="reuters.com, wikipedia.org..."
                rows={2}
                className="nodrag w-full bg-[#05080f] border border-gray-800 rounded p-2 text-[10px] text-slate-400 outline-none focus:border-orange-500 transition-colors resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        title="Execution Output"
        className="bg-[#010204]! border! border-orange-500! w-2.5! h-2.5! top-[27px]! -translate-y-1/2!"
      />
    </div>
  );
};
