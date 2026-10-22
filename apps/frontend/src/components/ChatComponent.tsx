import React, { useState, useRef, useEffect, useCallback } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Send,
  Bot,
  User,
  Upload,
  Trash2,
  FileText,
  ChevronDown,
  Copy,
  Check,
  PlusCircle,
  Volume2,
  VolumeX,
  Sparkles,
} from "lucide-react";
import {
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
  CHAT_MEMORY_KEY,
} from "../utils/storageSafety";

export { CHAT_MEMORY_KEY };

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

function sanitizeSafeHttpUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    // Malformed or invalid URL
  }
  return null;
}

export function FormattedContent({ content }: { content: string }) {
  const lines = content.split("\n");

  const renderInlineText = (str: string) => {
    const parts = str.split(
      /(\*\*.*?\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g,
    );
    return parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return (
          <strong key={pIdx} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      const mdLinkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (mdLinkMatch) {
        const safeHref = sanitizeSafeHttpUrl(mdLinkMatch[2]);
        if (!safeHref) return part;
        return (
          <a
            key={pIdx}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-300 underline hover:text-indigo-200 break-all"
          >
            {mdLinkMatch[1]}
          </a>
        );
      }
      if (/^https?:\/\/[^\s)]+$/.test(part)) {
        const safeHref = sanitizeSafeHttpUrl(part);
        if (!safeHref) return part;
        return (
          <a
            key={pIdx}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-300 underline hover:text-indigo-200 break-all"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // Group lines into blocks (handling Markdown tables natively)
  const renderedBlocks: React.ReactNode[] = [];
  let lineIdx = 0;

  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();

    // Check for Markdown table block
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (
        lineIdx < lines.length &&
        lines[lineIdx].trim().startsWith("|") &&
        lines[lineIdx].trim().endsWith("|")
      ) {
        tableLines.push(lines[lineIdx].trim());
        lineIdx++;
      }

      const parseCells = (row: string) =>
        row
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());

      const headerCells = parseCells(tableLines[0]);
      // Skip delimiter line if present (e.g. |---|---|)
      let dataRows = tableLines.slice(1);
      if (dataRows.length > 0 && /^\|?\s*[-:]+[-|\s:]*\|?$/.test(dataRows[0])) {
        dataRows = dataRows.slice(1);
      }

      renderedBlocks.push(
        <div
          key={`table-${lineIdx}`}
          className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60 shadow-inner"
        >
          <table className="w-full text-left text-xs sm:text-sm text-slate-200 border-collapse">
            <thead className="bg-slate-900/90 text-indigo-300 uppercase tracking-wider text-[11px] sm:text-xs font-bold border-b border-white/10">
              <tr>
                {headerCells.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="py-2.5 px-3 sm:px-4 font-semibold whitespace-nowrap"
                  >
                    {renderInlineText(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {dataRows.map((row, rIdx) => {
                const cells = parseCells(row);
                return (
                  <tr
                    key={rIdx}
                    className="hover:bg-white/[0.03] transition-colors"
                  >
                    {cells.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="py-2 px-3 sm:px-4 whitespace-nowrap text-slate-300 font-medium"
                      >
                        {renderInlineText(cell)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (!trimmed) {
      renderedBlocks.push(<div key={`empty-${lineIdx}`} className="h-1" />);
      lineIdx++;
      continue;
    }

    // Source badge chip
    if (trimmed.startsWith("[Source:") && trimmed.endsWith("]")) {
      const docName = trimmed
        .replace(/\[Source:/g, "")
        .replace(/\]/g, "")
        .trim();
      renderedBlocks.push(
        <div key={`src-${lineIdx}`} className="pt-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
            <FileText size={12} className="text-indigo-400" />
            Source: {docName}
          </span>
        </div>,
      );
      lineIdx++;
      continue;
    }

    // Heading item (### or ##)
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.*)/);
    if (headerMatch) {
      renderedBlocks.push(
        <h4
          key={`h-${lineIdx}`}
          className="font-bold text-white tracking-wide pt-1 pb-0.5 text-sm sm:text-base"
        >
          {renderInlineText(headerMatch[2])}
        </h4>,
      );
      lineIdx++;
      continue;
    }

    // Numbered list item
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      renderedBlocks.push(
        <div
          key={`num-${lineIdx}`}
          className="flex items-start gap-2 pl-1 my-1"
        >
          <span className="font-bold text-indigo-400 shrink-0">
            {numMatch[1]}.
          </span>
          <div>{renderInlineText(numMatch[2])}</div>
        </div>,
      );
      lineIdx++;
      continue;
    }

    // Bullet list item
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      const bulletText = trimmed.replace(/^[-•]\s+/, "");
      renderedBlocks.push(
        <div
          key={`bullet-${lineIdx}`}
          className="flex items-start gap-2 pl-3 my-0.5"
        >
          <span className="text-indigo-400 font-bold shrink-0">•</span>
          <div>{renderInlineText(bulletText)}</div>
        </div>,
      );
      lineIdx++;
      continue;
    }

    renderedBlocks.push(
      <p key={`p-${lineIdx}`}>{renderInlineText(rawLine)}</p>,
    );
    lineIdx++;
  }

  return (
    <div className="space-y-1.5 text-sm leading-relaxed">{renderedBlocks}</div>
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
    const saved = safeLocalStorageGet(CHAT_MEMORY_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      {
        role: "assistant",
        content: "Hi! Ask me anything about the live match!",
      },
    ];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const QUICK_PROMPTS = [
    "What are the Powerplay rules?",
    "Wide vs No-Ball: Which takes precedence?",
    "How many fielders are allowed outside the circle?",
    "Can you analyze the current match details?",
    "Who won Player of the Match in the last match?",
    "Can you check the weather report for our match?",
    "I want to report a bug or request a new feature",
  ];

  const cleanApiUrl = apiUrl ? apiUrl.replace(/\/$/, "") : "";
  const [isUploadingRules, setIsUploadingRules] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [showDocsDropdown, setShowDocsDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    if (!isAdmin || !apiUrl) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return;
      const res = await fetch(`${cleanApiUrl}/rules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.documents)) {
          setUploadedDocs(data.documents);
        }
      }
    } catch (err) {
      console.warn("Could not fetch uploaded rulebooks:", err);
    }
  }, [isAdmin, apiUrl, cleanApiUrl]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleRulesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !apiUrl) return;
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setAlertMessage("Only PDF files are supported");
      return;
    }
    setIsUploadingRules(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await fetch(`${cleanApiUrl}/rules/upload`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              fileName: file.name,
              fileBase64: base64,
            }),
          });
          if (res.ok) {
            await fetchDocs();
            setAlertMessage(`Uploaded and embedded ${file.name}`);
          } else {
            const errData = await res.json().catch(() => ({}));
            setAlertMessage(
              `Upload failed: ${errData.error || res.statusText}`,
            );
          }
        } catch (err: any) {
          setAlertMessage(`Upload failed: ${err.message}`);
        } finally {
          setIsUploadingRules(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsUploadingRules(false);
      setAlertMessage(`Upload failed: ${err.message}`);
    }
  };

  const handleDeleteDoc = async (doc: string) => {
    if (!apiUrl) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const res = await fetch(
        `${cleanApiUrl}/rules?documentName=${encodeURIComponent(doc)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        setUploadedDocs((prev) => prev.filter((d) => d !== doc));
        setAlertMessage(`Deleted ${doc}`);
      } else {
        const errData = await res.json().catch(() => ({}));
        setAlertMessage(`Delete failed: ${errData.error || res.statusText}`);
      }
    } catch (err: any) {
      setAlertMessage(`Delete failed: ${err.message}`);
    }
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    safeLocalStorageSet(CHAT_MEMORY_KEY, JSON.stringify(messages));
  }, [messages]);

  React.useEffect(() => {
    if (messages.length > 1 || loading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    } else if (messageListRef.current) {
      messageListRef.current.scrollTop = 0;
    }
  }, [messages, loading]);

  React.useEffect(() => {
    // Relying strictly on CSS h-dvh for viewport resizing on iOS.
    // The previous visualViewport padding offset broke fixed headers.
    if (typeof window !== "undefined" && window.visualViewport) {
      const handleResize = () => {
        // Just ensure active element is in view without changing body layout
        if (document.activeElement?.tagName === "INPUT") {
          setTimeout(() => {
            document.activeElement?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }, 50);
        }
      };
      window.visualViewport.addEventListener("resize", handleResize);
      return () =>
        window.visualViewport?.removeEventListener("resize", handleResize);
    }
  }, []);

  const speakText = (text: string, force: boolean = false) => {
    if (
      (!isSpeechEnabled && !force) ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }
    const cleanText = text
      .replace(/\*\*/g, "")
      .replace(/\[Source:.*?\]/g, "")
      .replace(/[-•]/g, "");

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onerror = (e) => console.error("TTS Error:", e);
    window.speechSynthesis.speak(utterance);
  };

  const submitText = async (
    textToSend: string,
    isVoiceRequest: boolean = false,
  ) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    // Unlock speech synthesis during the synchronous click event
    if (
      isSpeechEnabled &&
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      const unlockUtterance = new SpeechSynthesisUtterance("");
      unlockUtterance.volume = 0;
      window.speechSynthesis.speak(unlockUtterance);
    }

    const userMsg = { role: "user" as const, content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
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
        speakText(data.reply, isVoiceRequest);
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

  const handleNewChat = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    safeLocalStorageRemove(CHAT_MEMORY_KEY);
    setMessages([
      {
        role: "assistant",
        content: "Hi! Ask me anything about the live match!",
      },
    ]);
  };

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      setCopiedIdx(idx);
      setToastMessage("Copied to clipboard!");
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedIdx(null);
        setToastMessage(null);
      }, 1800);
    } catch (e) {
      console.error("Clipboard copy failed", e);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    submitText(input, false);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full max-w-5xl mx-auto bg-slate-900 rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
      <div className="shrink-0 p-3 sm:p-4 bg-slate-800/95 backdrop-blur-sm border-b border-white/10 flex items-center justify-between gap-2 relative z-20 sticky top-0 shadow-md">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-sm font-bold rounded-xl transition-colors border border-indigo-500/30 shrink-0"
            title="Start a new chat"
          >
            <PlusCircle size={16} className="text-emerald-400 shrink-0" />
            <span>New Chat</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
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

      {/* Floating Copy Toast */}
      {toastMessage && (
        <div className="absolute top-16 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div className="px-4 py-2 bg-emerald-500 text-slate-950 font-black text-xs rounded-full shadow-2xl flex items-center gap-1.5 fade-in">
            <Check size={14} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col relative">
        <div
          ref={messageListRef}
          className="flex-1 overflow-y-auto p-2.5 sm:p-3 overscroll-contain touch-pan-y flex flex-col"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {messages.length > 1 && (
            <div className="flex-1 min-h-[1rem] shrink-0"></div>
          )}

          {/* Welcome & Default Questions (One-by-one list fitted cleanly to screen without wasted space) */}
          {messages.length <= 1 && (
            <div className="flex flex-col items-center justify-start pt-1 sm:pt-1.5 pb-1 sm:pb-1.5 px-3 sm:px-4 text-center w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto animate-in fade-in duration-300">
              <div className="auth-hero-brand mb-1 sm:mb-1.5">
                <div
                  className="auth-logo"
                  style={{ width: 38, height: 38, fontSize: "1.25rem" }}
                >
                  🤖
                </div>
                <h2 className="auth-title text-xl sm:text-2xl font-black">
                  Cric<span>Score AI Assistant</span>
                </h2>
              </div>
              <p className="auth-subtitle mb-2 sm:mb-2.5 text-[10px] sm:text-xs font-semibold tracking-wider">
                MATCH STATS &middot; TOURNAMENT RULES &middot; WEATHER &middot;
                BUG REPORT
              </p>

              <div className="w-full space-y-1.5 sm:space-y-2 text-left">
                <span className="text-[11px] sm:text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5 px-1 mb-1 sm:mb-1.5">
                  <Sparkles size={13} className="text-amber-400" />
                  Suggested Questions
                </span>
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => submitText(prompt, false)}
                      disabled={loading}
                      aria-label={prompt}
                      className="w-full text-left py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 hover:border-indigo-500/40 text-slate-200 hover:text-white transition-all text-xs sm:text-sm font-semibold flex items-center justify-between group active:scale-[0.98] shadow-sm"
                    >
                      <span className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span className="leading-snug">{prompt}</span>
                      </span>
                      <Send
                        size={14}
                        className="text-slate-500 group-hover:text-indigo-400 shrink-0 ml-2 transition-colors"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 sm:space-y-4 flex flex-col shrink-0">
            {messages.length > 1 &&
              messages.map((msg, idx) => (
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
                      <Bot
                        size={14}
                        className="text-indigo-300 sm:w-4 sm:h-4"
                      />
                    )}
                  </div>
                  <div
                    className={`p-3 rounded-2xl max-w-[85%] sm:max-w-[80%] shadow-md relative group pr-8 ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-500/20" : "bg-slate-800 text-slate-200 rounded-tl-none border border-white/5"}`}
                  >
                    <FormattedContent content={msg.content} />

                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, idx)}
                      className="absolute right-2 bottom-2 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all active:scale-90"
                      title="Copy message"
                    >
                      {copiedIdx === idx ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
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
        </div>
      </div>

      {/* Quick Prompt Suggestion Chips (Visible during active chat) */}
      {messages.length > 1 && (
        <div className="shrink-0 px-3 py-2 overflow-x-auto scrollbar-none flex items-center gap-2 border-t border-white/5 bg-slate-900/95 z-20">
          <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles size={12} className="text-amber-400" />
            Quick:
          </span>
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => submitText(prompt, false)}
              disabled={loading}
              className="px-3 py-1 rounded-full bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-white/10 hover:border-indigo-500/40 text-[11px] font-bold whitespace-nowrap transition-all active:scale-95 shrink-0 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div
        className="shrink-0 p-2.5 sm:p-4 bg-slate-800 border-t border-white/10 z-30 sticky bottom-0"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.625rem)" }}
      >
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            type="text"
            name="search-chat-input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => {
              setTimeout(() => {
                if (messageListRef.current) {
                  messageListRef.current.scrollTop =
                    messageListRef.current.scrollHeight;
                }
              }, 300);
            }}
            onBlur={() => {
              // iOS Safari bug: force viewport back to origin when keyboard hides
              window.scrollTo(0, 0);
            }}
            placeholder="Ask about the match, score, or players..."
            className="flex-1 min-w-0 bg-slate-900 border border-white/10 rounded-2xl py-2.5 sm:py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-500"
            readOnly={loading}
            enterKeyHint="send"
          />
          <button
            type="submit"
            // Keep focus on the input so the first tap sends instead of just
            // dismissing the mobile keyboard.
            onMouseDown={(e) => e.preventDefault()}
            disabled={!input.trim() || loading}
            className="p-2.5 sm:p-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl disabled:opacity-50 transition-all shrink-0 shadow-lg shadow-indigo-600/30 hover:shadow-[0_0_12px_rgba(99,102,241,0.5)] active:scale-95"
            title="Send message"
          >
            <Send size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !isSpeechEnabled;
              setIsSpeechEnabled(next);
              if (
                typeof window !== "undefined" &&
                "speechSynthesis" in window
              ) {
                if (!next) {
                  window.speechSynthesis.cancel();
                } else {
                  const unlock = new SpeechSynthesisUtterance("");
                  unlock.volume = 0;
                  window.speechSynthesis.speak(unlock);
                }
              }
            }}
            className={`p-2.5 sm:p-3 rounded-2xl transition-all shrink-0 shadow-lg active:scale-95 ${
              isSpeechEnabled
                ? "bg-gradient-to-r from-indigo-600 to-amber-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.6)] border border-amber-400/50"
                : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/10"
            }`}
            title={
              isSpeechEnabled
                ? "Voice response enabled"
                : "Enable voice response"
            }
          >
            {isSpeechEnabled ? (
              <Volume2 size={18} className="text-white shrink-0" />
            ) : (
              <VolumeX size={18} className="shrink-0" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
