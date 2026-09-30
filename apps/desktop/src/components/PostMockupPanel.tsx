import { useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart2,
  Bookmark,
  Download,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Upload,
} from "lucide-react";
import { toPng } from "html-to-image";
import { withTimeout } from "../utilities/mockup";
import type { CatalogTool } from "../catalog/catalog";
import { avatarColor, initials, POST_PLATFORMS, type PostPlatform } from "../utilities/mockup";
import { PanelShell } from "./PanelShell";
import { Select } from "./Select";
import { useT } from "../i18n/language";

const PLATFORM_LABELS: Record<PostPlatform, string> = {
  tweet: "Tweet",
  "instagram-post": "Instagram post",
};

/**
 * A fake post, built by hand and exported as a picture — the same idea as
 * the chat mockup, for the other shape a screenshot fixture or a design
 * mockup needs: one post rather than a conversation.
 */
export function PostMockupPanel({
  tool,
  onDirtyChange,
}: {
  tool: CatalogTool;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = useT();
  const previewRef = useRef<HTMLDivElement>(null);

  const [platform, setPlatform] = useState<PostPlatform>("tweet");
  const [name, setName] = useState("Alex Rivera");
  const [handle, setHandle] = useState("alexrivera");
  const [text, setText] = useState(t("Just shipped a new feature — small change, but it took the whole afternoon to get right."));
  const [likes, setLikes] = useState("91k");
  const [comments, setComments] = useState("82k");
  const [shares, setShares] = useState("45k");
  const [bookmarks, setBookmarks] = useState("78k");
  const [views, setViews] = useState("87K");
  const [time, setTime] = useState("2h");
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function mark(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      onDirtyChange?.(true);
    };
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
            choices={POST_PLATFORMS.map((value) => ({ value, label: PLATFORM_LABELS[value] }))}
            onChange={(value) => setPlatform(value as PostPlatform)}
          />
        </label>

        <label className="mockup-field">
          <span>{t("Display name")}</span>
          <input type="text" value={name} onChange={(event) => mark(setName)(event.target.value)} />
        </label>

        <label className="mockup-field">
          <span>{t("Username")}</span>
          <input type="text" value={handle} onChange={(event) => mark(setHandle)(event.target.value)} />
        </label>

        {platform === "tweet" && (
          <label className="mockup-checkbox">
            <input
              type="checkbox"
              checked={verified}
              onChange={(event) => {
                setVerified(event.target.checked);
                onDirtyChange?.(true);
              }}
            />
            <span>{t("Verified badge")}</span>
          </label>
        )}

        <label className="mockup-field">
          <span>{t("Post text")}</span>
          <textarea
            className="utility-input"
            value={text}
            onChange={(event) => mark(setText)(event.target.value)}
          />
        </label>

        <div className="mockup-message-row mockup-message-row--stats">
          <label className="mockup-field">
            <span>{platform === "tweet" ? t("Replies") : t("Comments")}</span>
            <input type="text" value={comments} onChange={(event) => mark(setComments)(event.target.value)} />
          </label>
          {platform === "tweet" && (
            <label className="mockup-field">
              <span>{t("Reposts")}</span>
              <input type="text" value={shares} onChange={(event) => mark(setShares)(event.target.value)} />
            </label>
          )}
          <label className="mockup-field">
            <span>{t("Likes")}</span>
            <input type="text" value={likes} onChange={(event) => mark(setLikes)(event.target.value)} />
          </label>
          {platform === "tweet" && (
            <label className="mockup-field">
              <span>{t("Bookmarks")}</span>
              <input type="text" value={bookmarks} onChange={(event) => mark(setBookmarks)(event.target.value)} />
            </label>
          )}
          {platform === "tweet" && (
            <label className="mockup-field">
              <span>{t("Views")}</span>
              <input type="text" value={views} onChange={(event) => mark(setViews)(event.target.value)} />
            </label>
          )}
          {platform === "tweet" && (
            <label className="mockup-field">
              <span>{t("Time")}</span>
              <input type="text" value={time} onChange={(event) => mark(setTime)(event.target.value)} />
            </label>
          )}
        </div>

        {error && (
          <p className="run-message run-message--error" role="alert">
            <AlertTriangle size={14} aria-hidden="true" /> {error}
          </p>
        )}
      </section>

      <section className="mockup-panel__preview">
        {platform === "tweet" ? (
          <div className="mockup-post mockup-post--tweet" ref={previewRef}>
            <div className="mockup-tweet__grid">
              <span className="mockup-avatar mockup-avatar--tweet" style={{ background: avatarColor(name) }}>
                {initials(name)}
              </span>
              <div className="mockup-tweet__col">
                <div className="mockup-tweet__meta">
                  <strong>{name || t("Name")}</strong>
                  {verified && (
                    <BadgeCheck size={17} className="mockup-tweet__verified" fill="#1d9bf0" aria-hidden="true" />
                  )}
                  <span className="mockup-tweet__muted">
                    @{handle || "handle"} · {time}
                  </span>
                  <MoreHorizontal size={17} className="mockup-tweet__more" aria-hidden="true" />
                </div>
                <p className="mockup-tweet__text">{text || t("Post text")}</p>
                <div className="mockup-tweet__actions">
                  <span>
                    <MessageCircle size={17} aria-hidden="true" /> {comments}
                  </span>
                  <span>
                    <Repeat2 size={17} aria-hidden="true" /> {shares}
                  </span>
                  <span className="mockup-tweet__action--like">
                    <Heart size={17} fill="currentColor" aria-hidden="true" /> {likes}
                  </span>
                  <span>
                    <Bookmark size={17} aria-hidden="true" /> {bookmarks}
                  </span>
                  <span>
                    <BarChart2 size={17} aria-hidden="true" /> {views}
                  </span>
                  <span className="mockup-tweet__action--share">
                    <Upload size={17} aria-hidden="true" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mockup-post mockup-post--instagram-post" ref={previewRef}>
            <div className="mockup-post__header">
              <span className="mockup-avatar" style={{ background: avatarColor(name) }}>
                {initials(name)}
              </span>
              <span className="mockup-post__identity">
                <strong>{name || t("Name")}</strong>
                <small>@{handle || "handle"}</small>
              </span>
            </div>
            <p className="mockup-post__text">{text || t("Post text")}</p>
            <div className="mockup-post__stats">
              <span>
                <Heart size={14} aria-hidden="true" /> {likes}
              </span>
              <span>
                <MessageCircle size={14} aria-hidden="true" /> {comments}
              </span>
            </div>
          </div>
        )}

        <button className="button button--primary" type="button" onClick={() => void saveImage()} disabled={saving}>
          <Download size={16} aria-hidden="true" /> {t(saving ? "Saving…" : "Save as image")}
        </button>
      </section>
    </PanelShell>
  );
}
