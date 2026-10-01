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
import { PageCard, PageResult, ToolPage } from "./ToolPage";
import { Select } from "./Select";
import { useT } from "../i18n/language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
    <ToolPage tool={tool} showEngine={false}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-4">
          <PageCard>
            <div className="grid gap-1">
              <h2 className="font-heading text-lg font-semibold">{t("Conversation")}</h2>
              <p className="text-sm text-muted-foreground">{t("Who is talking, and what they say.")}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium">{t("App")}</span>
                <Select
                  label={t("App")}
                  value={platform}
                  choices={CHAT_PLATFORMS.map((value) => ({ value, label: PLATFORM_LABELS[value] }))}
                  onChange={(value) => setPlatform(value as ChatPlatform)}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">{t("Contact name")}</span>
                <Input
                  value={contactName}
                  onChange={(event) => {
                    setContactName(event.target.value);
                    onDirtyChange?.(true);
                  }}
                />
              </label>
              {platform === "whatsapp" && (
                <label className="grid gap-2">
                  <span className="text-sm font-medium">{t("Status")}</span>
                  <Input
                    value={contactStatus}
                    onChange={(event) => {
                      setContactStatus(event.target.value);
                      onDirtyChange?.(true);
                    }}
                  />
                </label>
              )}
            </div>

            <div className="grid gap-2.5">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  role="group"
                  aria-label={t("Message {number}", { number: index + 1 })}
                  className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[auto_auto_minmax(0,1fr)_6.5rem_auto]"
                >
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    aria-label={t("Who sent it")}
                    value={message.from}
                    onValueChange={(from) => {
                      if (from) updateMessage(message.id, { from: from as MockupMessage["from"] });
                    }}
                  >
                    <ToggleGroupItem value="me" className="px-2.5 text-xs">{t("You")}</ToggleGroupItem>
                    <ToggleGroupItem value="them" className="px-2.5 text-xs">{t("Them")}</ToggleGroupItem>
                  </ToggleGroup>
                  <Toggle
                    variant="outline"
                    size="sm"
                    aria-label={t("Toggle voice message")}
                    pressed={message.type === "voice"}
                    onPressedChange={(voice) =>
                      updateMessage(message.id, {
                        type: voice ? "voice" : "text",
                        duration: message.duration ?? "0:21",
                      })
                    }
                  >
                    <Mic aria-hidden="true" />
                  </Toggle>
                  {message.type === "voice" ? (
                    <Input
                      value={message.duration ?? "0:21"}
                      placeholder="0:21"
                      onChange={(event) => updateMessage(message.id, { duration: event.target.value })}
                      aria-label={t("Duration")}
                    />
                  ) : (
                    <Input
                      value={message.text}
                      placeholder={t("Type a message")}
                      onChange={(event) => updateMessage(message.id, { text: event.target.value })}
                      aria-label={t("Message")}
                    />
                  )}
                  <Input
                    className="col-start-3 font-mono sm:col-start-auto"
                    value={message.time}
                    onChange={(event) => updateMessage(message.id, { time: event.target.value })}
                    aria-label={t("Time")}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMessage(message.id)}
                    aria-label={t("Remove this message")}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>

            <Button variant="outline" className="justify-self-start" onClick={addMessage}>
              <Plus aria-hidden="true" /> {t("Add a message")}
            </Button>
          </PageCard>

          {error && (
            <PageResult error icon={<AlertTriangle aria-hidden="true" />}>
              {error}
            </PageResult>
          )}
        </div>

        <div className="grid justify-items-center gap-4 lg:sticky lg:top-4">
          {/* The phone imitates each app, and app.css still draws it. */}
          <div data-legacy>
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

          </div>
          <Button className="w-full max-w-[300px]" onClick={() => void saveImage()} disabled={saving}>
            <Download aria-hidden="true" /> {t(saving ? "Saving…" : "Save as image")}
          </Button>
        </div>
      </div>
    </ToolPage>
  );
}
