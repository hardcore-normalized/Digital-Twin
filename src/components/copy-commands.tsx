"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCommands({ commands }: { commands: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-border bg-[#1f1e1b] p-5 pr-14 font-mono text-[13px] leading-7 text-[#edebe5]">
        {commands.map((c) => (
          <div key={c}>
            <span className="text-[#8a867c] select-none">$ </span>
            {c}
          </div>
        ))}
      </pre>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(commands.join("\n"));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-3 right-3 rounded-md p-2 text-[#b6b2a8] hover:bg-white/10 hover:text-white"
        aria-label={copied ? "Copied" : "Copy commands"}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}
