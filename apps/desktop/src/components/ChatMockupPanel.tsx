import { useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCheck,
  ChevronLeft,
  Download,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Play,
  Plus,
  Smile,
  Trash2,
  Video,
} from "lucide-react";
import { toPng } from "html-to-image";
import { withTimeout } from "../utilities/mockup";
import type { CatalogTool } from "../catalog/catalog";
import {
  avatarColor,
  CHAT_PLATFORMS,
  defaultTime,
  initials,
  newMessage,
  type ChatPlatform,
  type MockupMessage,
} from "../utilities/mockup";
import { PanelShell } from "./PanelShell";
import { Select } from "./Select";
import { useT } from "../i18n/language";

const PLATFORM_LABELS: Record<ChatPlatform, string> = {
  whatsapp: "WhatsApp",
  imessage: "iMessage",
  "instagram-dm": "Instagram DM",
};

/** Seeded bar heights for a fake audio waveform. */
function waveHeights(id: string): number[] {
  let seed = 0;
  for (const c of id) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: 26 }, (_, i) => {
    const wave = Math.abs(Math.sin(i * 0.9 + (seed % 6)));
    const noise = ((seed >> (i % 16)) & 0x7) / 7;
    return Math.round(4 + (wave * 0.65 + noise * 0.35) * 20);
  });
}

/**
 * A fake chat, built by hand and exported as a picture.
 *
 * Every message is typed in here — there is no import, no connected account
 * and nothing captured from a real conversation. It exists to produce a
 * clean screenshot of a chat interface for a design mockup, a caption graphic
 * or a test fixture, without staging a real conversation to screenshot.
 */
export function ChatMockupPanel({
  tool,
  onDirtyChange,
}: {
  tool: CatalogTool;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = useT();
  const previewRef = useRef<HTMLDivElement>(null);

  const [platform, setPlatform] = useState<ChatPlatform>("whatsapp");
  const [contactName, setContactName] = useState("Alex");
  const [contactStatus, setContactStatus] = useState("typing...");
  const [messages, setMessages] = useState<MockupMessage[]>(() => [
    { ...newMessage("them", defaultTime()), text: t("Hey, are we still on for tomorrow?") },
    { ...newMessage("me", defaultTime()), text: t("Yes! See you at 10.") },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateMessage(id: string, patch: Partial<MockupMessage>) {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, ...patch } : message)));
    onDirtyChange?.(true);
  }

  function addMessage() {
    const lastSender = messages.at(-1)?.from ?? "them";
    setMessages((current) => [...current, newMessage(lastSender === "me" ? "them" : "me", defaultTime())]);
    onDirtyChange?.(true);
  }

  function removeMessage(id: string) {
    setMessages((current) => current.filter((message) => message.id !== id));
    onDirtyChange?.(true);
  }

  async function saveImage() {
    if (!previewRef.current) return;
    setSaving(true);
    setError("");
    try {
      const dataUrl = await withTimeout(
        toPng(previewRef.current, { pixelRatio: 2, skipFonts: true }),
        10_000,
      );
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${platform}-mockup.png`;
      link.click();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("The image could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PanelShell
      title={tool.integrationName}
      wide
      bodyClassName="mockup-panel__body"
    >
      <section className="tool-panel__controls mockup-panel__form">
        <h2 id="tool-panel-title">{t(tool.title)}</h2>
        <p>{t(tool.description)}</p>

        <label className="operation-select">
          <span>{t("App")}</span>
          <Select
            label={t("App")}
            value={platform}
            choices={CHAT_PLATFORMS.map((value) => ({ value, label: PLATFORM_LABELS[value] }))}
            onChange={(value) => setPlatform(value as ChatPlatform)}
          />
        </label>

        <label className="mockup-field">
          <span>{t("Contact name")}</span>
          <input
            type="text"
            value={contactName}
            onChange={(event) => {
              setContactName(event.target.value);
              onDirtyChange?.(true);
            }}
          />
        </label>

        {platform === "whatsapp" && (
          <label className="mockup-field">
            <span>{t("Status")}</span>
            <input
              type="text"
              value={contactStatus}
              onChange={(event) => {
                setContactStatus(event.target.value);
                onDirtyChange?.(true);
              }}
            />
          </label>
        )}

        <div className="mockup-messages">
          {messages.map((message) => (
            <div className="mockup-message-row mockup-message-row--chat" key={message.id}>
              <button
                type="button"
                className={`mockup-sender mockup-sender--${message.from}`}
                onClick={() => updateMessage(message.id, { from: message.from === "me" ? "them" : "me" })}
                aria-label={t(message.from === "me" ? "Sent by you — tap to switch" : "Sent by them — tap to switch")}
              >
                {t(message.from === "me" ? "You" : "Them")}
              </button>
              <button
                type="button"
                className={`mockup-sender mockup-sender--type${message.type === "voice" ? " mockup-sender--active" : ""}`}
                onClick={() =>
                  updateMessage(message.id, {
                    type: message.type === "voice" ? "text" : "voice",
                    duration: message.duration ?? "0:21",
                  })
                }
                aria-label={t("Toggle voice message")}
              >
                <Mic size={11} aria-hidden="true" />
              </button>
              {message.type === "voice" ? (
                <input
                  type="text"
                  className="mockup-message-text"
                  value={message.duration ?? "0:21"}
                  placeholder="0:21"
                  onChange={(event) => updateMessage(message.id, { duration: event.target.value })}
                  aria-label={t("Duration")}
                />
              ) : (
                <input
                  type="text"
                  className="mockup-message-text"
                  value={message.text}
                  placeholder={t("Type a message")}
                  onChange={(event) => updateMessage(message.id, { text: event.target.value })}
                />
              )}
              <input
                type="text"
                className="mockup-message-time"
                value={message.time}
                onChange={(event) => updateMessage(message.id, { time: event.target.value })}
                aria-label={t("Time")}
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => removeMessage(message.id)}
                aria-label={t("Remove this message")}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <button className="button button--light" type="button" onClick={addMessage}>
          <Plus size={15} aria-hidden="true" /> {t("Add a message")}
        </button>

        {error && (
          <p className="run-message run-message--error" role="alert">
            <AlertTriangle size={14} aria-hidden="true" /> {error}
          </p>
        )}
      </section>

      <section className="mockup-panel__preview">
        <div className={`mockup-phone mockup-phone--${platform}`} ref={previewRef}>
          <header className="mockup-phone__header">
            {platform === "whatsapp" && (
              <ChevronLeft size={20} className="mockup-phone__header-back" aria-hidden="true" />
            )}
            <span className="mockup-avatar" style={{ background: avatarColor(contactName) }}>
              {initials(contactName)}
            </span>
            {platform === "whatsapp" ? (
              <div className="mockup-phone__header-info">
                <strong>{contactName || t("Contact")}</strong>
                <span className="mockup-phone__header-status">{contactStatus}</span>
              </div>
            ) : (
              <strong>{contactName || t("Contact")}</strong>
            )}
            {platform === "whatsapp" && (
              <div className="mockup-phone__header-actions">
                <Video size={18} aria-hidden="true" />
                <Phone size={18} aria-hidden="true" />
                <MoreVertical size={18} aria-hidden="true" />
              </div>
            )}
          </header>

          <div className="mockup-phone__messages">
            {platform === "whatsapp" && <span className="mockup-date-sep">Today</span>}
            {messages.map((message) => {
              const isVoice = message.type === "voice";
              const bubble = (
                <div className={`mockup-bubble mockup-bubble--${message.from}${isVoice ? " mockup-bubble--voice" : ""}`}>
                  {isVoice ? (
                    <div className="mockup-voice">
                      <Play size={14} className="mockup-voice__play" fill="currentColor" aria-hidden="true" />
                      <div className="mockup-waveform" aria-hidden="true">
                        {waveHeights(message.id).map((h, i) => (
                          <div key={i} style={{ height: h }} />
                        ))}
                      </div>
                      <span className="mockup-voice__dur">{message.duration ?? "0:21"}</span>
                    </div>
                  ) : (
                    <span className="mockup-bubble__text">{message.text || t("Type a message")}</span>
                  )}
                  <span className="mockup-bubble__meta">
                    <span className="mockup-bubble__time">{message.time}</span>
                    {message.from === "me" && platform === "whatsapp" && (
                      <CheckCheck size={14} className="mockup-bubble__check" aria-hidden="true" />
                    )}
                  </span>
                </div>
              );

              if (platform === "whatsapp" && message.from === "them") {
                return (
                  <div key={message.id} className="mockup-bubble-outer">
                    <span
                      className="mockup-avatar mockup-avatar--xs"
                      style={{ background: avatarColor(contactName) }}
                    >
                      {initials(contactName)}
                    </span>
                    {bubble}
                  </div>
                );
              }
              return (
                <div key={message.id} className="mockup-bubble-outer mockup-bubble-outer--me">
                  {bubble}
                </div>
              );
            })}
          </div>

          {platform === "whatsapp" && (
            <div className="mockup-phone__footer">
              <Smile size={20} className="mockup-phone__footer-icon" aria-hidden="true" />
              <div className="mockup-phone__footer-input">{t("It's between us…")}</div>
              <Paperclip size={18} className="mockup-phone__footer-icon" aria-hidden="true" />
              <Camera size={18} className="mockup-phone__footer-icon" aria-hidden="true" />
              <div className="mockup-phone__footer-mic">
                <Mic size={18} aria-hidden="true" />
              </div>
            </div>
          )}
        </div>

        <button className="button button--primary" type="button" onClick={() => void saveImage()} disabled={saving}>
          <Download size={16} aria-hidden="true" /> {t(saving ? "Saving…" : "Save as image")}
        </button>
      </section>
    </PanelShell>
  );
}
