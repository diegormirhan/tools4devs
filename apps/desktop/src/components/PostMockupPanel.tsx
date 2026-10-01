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
import { PageCard, PageResult, ToolPage } from "./ToolPage";
import { Select } from "./Select";
import { useT } from "../i18n/language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

  const stat = (label: string, value: string, setter: (value: string) => void) => (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <Input value={value} onChange={(event) => mark(setter)(event.target.value)} />
    </label>
  );

  return (
    <ToolPage tool={tool} showEngine={false}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-4">
          <PageCard title={t("Post")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-sm font-medium">{t("App")}</span>
                <Select
                  label={t("App")}
                  value={platform}
                  choices={POST_PLATFORMS.map((value) => ({ value, label: PLATFORM_LABELS[value] }))}
                  onChange={(value) => setPlatform(value as PostPlatform)}
                />
              </label>
              {stat(t("Display name"), name, setName)}
              {stat(t("Username"), handle, setHandle)}
            </div>

            {platform === "tweet" && (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={verified}
                  onChange={(event) => {
                    setVerified(event.target.checked);
                    onDirtyChange?.(true);
                  }}
                />
                {t("Verified badge")}
              </label>
            )}

            <label className="grid gap-2">
              <span className="text-sm font-medium">{t("Post text")}</span>
              <Textarea className="min-h-28" value={text} onChange={(event) => mark(setText)(event.target.value)} />
            </label>
          </PageCard>

          <PageCard title={t("Numbers")}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {stat(platform === "tweet" ? t("Replies") : t("Comments"), comments, setComments)}
              {platform === "tweet" && stat(t("Reposts"), shares, setShares)}
              {stat(t("Likes"), likes, setLikes)}
              {platform === "tweet" && stat(t("Bookmarks"), bookmarks, setBookmarks)}
              {platform === "tweet" && stat(t("Views"), views, setViews)}
              {platform === "tweet" && stat(t("Time"), time, setTime)}
            </div>
          </PageCard>

          {error && (
            <PageResult error icon={<AlertTriangle aria-hidden="true" />}>
              {error}
            </PageResult>
          )}
        </div>

        <div className="grid justify-items-center gap-4 lg:sticky lg:top-4">
          {/* The post imitates each app, and app.css still draws it. */}
          <div data-legacy className="grid w-full justify-items-center">
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

          </div>
          <Button className="w-full max-w-[340px]" onClick={() => void saveImage()} disabled={saving}>
            <Download aria-hidden="true" /> {t(saving ? "Saving…" : "Save as image")}
          </Button>
        </div>
      </div>
    </ToolPage>
  );
}
