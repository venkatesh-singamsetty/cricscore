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
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  safeSessionStorageSet,
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
} from "../utils/storageSafety";

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
    const saved = safeLocalStorageGet("cricscore-chat-memory");
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
  const [isListening, setIsListening] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [isUploadingRules, setIsUploadingRules] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [showDocsDropdown, setShowDocsDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRulesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Stub for now, can implement later
    console.log("Upload rules clicked", e.target.files);
  };

  const handleDeleteDoc = (doc: string) => {
    // Stub for now
    setUploadedDocs(uploadedDocs.filter((d) => d !== doc));
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    safeLocalStorageSet("cricscore-chat-memory", JSON.stringify(messages));
  }, [messages]);

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

    if (trimmed.startsWith("/login ")) {
      const pin = trimmed.split(" ")[1];
      const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || "2403";
      if (pin === ADMIN_PIN) {
        safeSessionStorageSet("auth_admin", "true");
        window.location.reload();
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: trimmed },
          { role: "assistant", content: "❌ Invalid Admin PIN." },
        ]);
        setInput("");
      }
      return;
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

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setAlertMessage("Voice recognition is not supported on this browser.");
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {}
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      // Use false for interimResults on mobile for better compatibility
      recognition.interimResults = false;
      recognition.lang = "en-US";

      let spokenText = "";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentText = "";
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        setInput(currentText);
        spokenText = currentText;
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);

        let errorMsg = event.error;
        if (event.error === "not-allowed") {
          errorMsg =
            "Microphone permission denied. Please allow microphone access.";
        } else if (event.error === "network") {
          errorMsg =
            "Network error. Note: Voice recognition on mobile often requires an HTTPS connection.";
        } else if (event.error === "no-speech") {
          // Don't alert for no-speech, just stop listening silently
          return;
        }

        setAlertMessage(`Voice Error: ${errorMsg}`);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (spokenText.trim()) {
          // Delay submission slightly to allow UI to update
          setTimeout(() => {
            submitText(spokenText.trim(), true);
          }, 100);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.error("Failed to start recognition:", e);
      setIsListening(false);
      setAlertMessage(
        "Failed to start voice recognition: " + (e.message || "Unknown error"),
      );
    }
  };

  const handleNewChat = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    safeLocalStorageRemove("cricscore-chat-memory");
    setMessages([
      {
        role: "assistant",
        content: "Hi! Ask me anything about the live match!",
      },
    ]);
  };

  const handleCopy = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setAlertMessage("✅ Copied to clipboard");
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    submitText(input, false);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-4xl mx-auto bg-slate-900 rounded-none sm:rounded-xl border-0 sm:border border-white/10 shadow-2xl overflow-hidden relative">
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
                  // Unlock audio context on user interaction
                  const unlock = new SpeechSynthesisUtterance("");
                  unlock.volume = 0;
                  window.speechSynthesis.speak(unlock);
                }
              }
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors border text-xs font-bold ${
              isSpeechEnabled
                ? "bg-indigo-600/40 border-indigo-500/50 text-indigo-300"
                : "bg-slate-700/60 border-slate-600/50 text-slate-400 hover:text-slate-200"
            }`}
            title={
              isSpeechEnabled
                ? "Voice response enabled"
                : "Enable voice response"
            }
          >
            {isSpeechEnabled ? (
              <Volume2 size={14} className="text-indigo-400 shrink-0" />
            ) : (
              <VolumeX size={14} className="shrink-0" />
            )}
            <span className="hidden sm:inline">
              {isSpeechEnabled ? "Voice On" : "Voice Off"}
            </span>
          </button>
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

      <div className="shrink-0 p-2.5 sm:p-4 bg-slate-800 border-t border-white/10 sticky bottom-0 z-30">
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            type="text"
            name="cric_chat_query"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the match, score, or players..."
            className="flex-1 min-w-0 bg-slate-900 border border-white/10 rounded-2xl py-2.5 sm:py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 sm:p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl disabled:opacity-50 transition-colors shrink-0 shadow-lg shadow-indigo-600/20"
            title="Send message"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
