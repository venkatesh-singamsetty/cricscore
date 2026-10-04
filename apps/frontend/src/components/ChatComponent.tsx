import React, { useState, useRef } from "react";
import {
  Send,
  Bot,
  User,
  Upload,
  Trash2,
  FileText,
  ChevronDown,
  Copy,
  PlusCircle,
} from "lucide-react";
import { safeSessionStorageSet } from "../utils/storageSafety";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export function FormattedContent({ content }: { content: string }) {
  const lines = content.split("\n");

  const renderInlineText = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return (
          <strong key={pIdx} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        // Source badge chip
        if (trimmed.startsWith("[Source:") && trimmed.endsWith("]")) {
          const docName = trimmed
            .replace(/\[Source:/g, "")
            .replace(/\]/g, "")
            .trim();
          return (
            <div key={i} className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                <FileText size={12} className="text-indigo-400" />
                Source: {docName}
              </span>
            </div>
          );
        }

        // Numbered list item
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1 my-1">
              <span className="font-bold text-indigo-400 shrink-0">
                {numMatch[1]}.
              </span>
              <div>{renderInlineText(numMatch[2])}</div>
            </div>
          );
        }

        // Bullet list item
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const bulletText = trimmed.replace(/^[-•]\s+/, "");
          return (
            <div key={i} className="flex items-start gap-2 pl-3 my-0.5">
              <span className="text-indigo-400 font-bold shrink-0">•</span>
              <div>{renderInlineText(bulletText)}</div>
            </div>
          );
        }

        return <p key={i}>{renderInlineText(line)}</p>;
      })}
    </div>
  );
}

export function ChatComponent({
  matchId,
  apiUrl,
  isAdmin = false,
  setAlertMessage,
}: {
  matchId: string | null;
  apiUrl: string;
  isAdmin?: boolean;
  setAlertMessage: (msg: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("cricscore-chat-memory");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        role: "assistant",
        content: "Hi! Ask me anything about the live match!",
      },
    ];
  });

  React.useEffect(() => {
    localStorage.setItem("cricscore-chat-memory", JSON.stringify(messages));
  }, [messages]);

  const handleNewChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Hi! Ask me anything about the live match!",
      },
    ]);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setAlertMessage("✅ Copied to clipboard");
  };
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUploadingRules, setIsUploadingRules] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [showDocsDropdown, setShowDocsDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  React.useEffect(() => {
    if (isAdmin) {
      fetchDocs();
    }
  }, [isAdmin, apiUrl]);

  const fetchDocs = async () => {
    try {
      const res = await fetch(`${apiUrl}/rules`);
      if (res.ok) {
        const data = await res.json();
        setUploadedDocs(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to fetch documents", err);
    }
  };

  const handleDeleteDoc = async (docName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${docName}?`)) return;
    try {
      const res = await fetch(
        `${apiUrl}/rules?documentName=${encodeURIComponent(docName)}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        setAlertMessage(`✅ Deleted ${docName}`);
        fetchDocs();
      } else {
        const data = await res.json();
        setAlertMessage(`❌ Failed to delete: ${data.error}`);
      }
    } catch (err: any) {
      setAlertMessage(`❌ Failed to delete: ${err.message}`);
    }
  };

  const handleRulesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingRules(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const response = await fetch(`${apiUrl}/rules/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileBase64: reader.result,
            fileName: file.name,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Upload failed");
        setAlertMessage(
          `✅ Rules uploaded! Processed ${data.chunksProcessed} sections.`,
        );
        fetchDocs();
      } catch (err: any) {
        setAlertMessage(`❌ Upload failed: ${err.message}`);
      } finally {
        setIsUploadingRules(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputText = input.trim();
    if (!inputText || loading) return;

    if (inputText.startsWith("/login ")) {
      const pin = inputText.split(" ")[1];
      const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || "2403";
      if (pin === ADMIN_PIN) {
        safeSessionStorageSet("auth_admin", "true");
        window.location.reload();
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: inputText },
          { role: "assistant", content: "❌ Invalid Admin PIN." },
        ]);
        setInput("");
      }
      return;
    }

    const userMsg = { role: "user" as const, content: inputText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Send chat history minus the initial greeting if it's the only one
      const history = messages.filter((m) => m.role !== "system");

      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          matchId,
          history,
          isAdmin,
        }),
      });
      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error: " + data.error },
        ]);
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network Error: " + error.message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-4xl mx-auto bg-slate-900 rounded-xl border border-white/10 shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
      <div className="shrink-0 p-3 sm:p-4 bg-slate-800/95 backdrop-blur-sm border-b border-white/10 flex items-center justify-between gap-2 relative z-20 sticky top-0 shadow-md">
        <h3 className="text-sm sm:text-xl font-bold text-white flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Bot className="text-indigo-400 shrink-0" size={18} />
          <span>
            <span className="hidden sm:inline">Live Match </span>AI Assistant
          </span>
        </h3>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 bg-slate-700/60 hover:bg-slate-700/90 text-slate-200 text-xs font-bold rounded-lg transition-colors border border-slate-600/50 shrink-0"
            title="Start a new chat"
          >
            <PlusCircle size={14} className="text-emerald-400 shrink-0" />
            <span>New Chat</span>
          </button>
          {isAdmin && (
            <>
              <div className="relative">
                <button
                  onClick={() => setShowDocsDropdown(!showDocsDropdown)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700/60 hover:bg-slate-700/90 text-slate-200 text-xs font-bold rounded-lg transition-colors border border-slate-600/50"
                >
                  <FileText size={14} className="shrink-0" />
                  <span>Docs ({uploadedDocs.length})</span>
                  <ChevronDown size={14} className="shrink-0" />
                </button>

                {showDocsDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-slate-700">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Uploaded Rulebooks
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {uploadedDocs.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">
                          No docs uploaded
                        </div>
                      ) : (
                        uploadedDocs.map((doc, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2 hover:bg-slate-700/50 group"
                          >
                            <span className="text-sm text-slate-300 truncate pr-2">
                              {doc}
                            </span>
                            <button
                              onClick={() => handleDeleteDoc(doc)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                              title="Delete this rulebook"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={handleRulesUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingRules}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-bold rounded-lg transition-colors border border-indigo-500/30 disabled:opacity-50 shrink-0"
              >
                <Upload size={14} className="shrink-0" />
                <span className="hidden sm:inline">
                  {isUploadingRules ? "Uploading..." : "Upload Rules"}
                </span>
                <span className="sm:hidden">
                  {isUploadingRules ? "..." : "Upload"}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-2.5 sm:gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-indigo-500" : "bg-slate-700"}`}
            >
              {msg.role === "user" ? (
                <User size={14} className="text-white sm:w-4 sm:h-4" />
              ) : (
                <Bot size={14} className="text-indigo-300 sm:w-4 sm:h-4" />
              )}
            </div>
            <div
              className={`p-3 rounded-2xl max-w-[85%] sm:max-w-[80%] shadow-md relative group ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-500/20" : "bg-slate-800 text-slate-200 rounded-tl-none border border-white/5 pr-8"}`}
            >
              <FormattedContent content={msg.content} />

              {msg.role === "assistant" &&
                msg.content !== "Hi! Ask me anything about the live match!" && (
                  <button
                    onClick={() => handleCopy(msg.content)}
                    className="absolute right-2 bottom-2 p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/20 rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                    title="Copy response"
                  >
                    <Copy size={14} />
                  </button>
                )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5 sm:gap-3 flex-row">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
              <Bot
                size={14}
                className="text-indigo-300 animate-pulse sm:w-4 sm:h-4"
              />
            </div>
            <div className="p-3 rounded-2xl bg-slate-800 text-slate-400 rounded-tl-none border border-white/5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce"></div>
              <div
                className="w-2 h-2 rounded-full bg-slate-500 animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className="w-2 h-2 rounded-full bg-slate-500 animate-bounce"
                style={{ animationDelay: "0.4s" }}
              ></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 p-3 sm:p-4 bg-slate-800 border-t border-white/10">
        <form onSubmit={sendMessage} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the match, score, or players..."
            className="w-full bg-slate-900 border border-white/10 rounded-full py-2.5 sm:py-3 px-4 sm:px-6 pr-12 sm:pr-14 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-1.5 sm:right-2 p-1.5 sm:p-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors"
          >
            <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </form>
      </div>
    </div>
  );
}
