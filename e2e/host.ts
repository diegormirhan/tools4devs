import type { Page } from "@playwright/test";

/**
 * A stand-in for the Tauri host, so the real frontend runs end to end in a
 * browser: the same commands, events and plugin calls the Rust side answers,
 * answered here from a script that runs before the app.
 *
 * It does not pretend to run FFmpeg. It does what the host does at the
 * boundary — reports progress, settles a job, refuses a cancelled one with the
 * host's own marker — so everything above the boundary is the shipped code.
 * Every call is recorded in `window.__host.calls`, which the tests read back.
 */
export type HostOptions = {
  /** Tools the host reports as present on this machine. */
  available?: string[];
  /** What the open dialog returns: a path, a list, or null for "cancelled". */
  openDialog?: string | string[] | null;
  /** What the save dialog returns. */
  saveDialog?: string | null;
  /** How execute_operation ends: "succeed" after progress, "fail", or "hold" until cancelled. */
  operation?: "succeed" | "fail" | "hold";
  /** Milliseconds each progress step takes, so a test can watch a job running. */
  stepMs?: number;
  /** How install_component ends. */
  install?: "succeed" | "fail";
  audioSources?: Array<{ id: string; label: string; kind: "microphone" | "playback"; isDefault: boolean }>;
  recognition?: Record<string, unknown>;
};

export async function installHost(page: Page, options: HostOptions = {}) {
  await page.addInitScript((opts: HostOptions) => {
    type Handler = (event: { event: string; id: number; payload: unknown }) => void;
    const callbacks = new Map<number, Handler>();
    const listeners = new Map<string, number[]>();
    const calls: Array<{ cmd: string; args: unknown }> = [];
    const held = new Map<string, (reason: string) => void>();
    let nextId = 1;
    let available = [...(opts.available ?? [])];
    const step = opts.stepMs ?? 150;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    function emit(event: string, payload: unknown) {
      for (const id of listeners.get(event) ?? []) callbacks.get(id)?.({ event, id, payload });
    }

    async function runOperation(request: { jobId: string; toolId: string; operationId: string; outputPath?: string }) {
      const base = { jobId: request.jobId, toolId: request.toolId, operationId: request.operationId };
      emit("operation-progress", { ...base, phase: "starting", progress: 0, message: "Starting" });
      if (opts.operation === "hold") {
        return new Promise((_, reject) => held.set(request.jobId, reject));
      }
      for (const progress of [0.25, 0.5, 0.75]) {
        await wait(step);
        emit("operation-progress", { ...base, phase: "downloading", progress, message: "Working" });
      }
      await wait(step);
      if (opts.operation === "fail") {
        emit("operation-progress", { ...base, phase: "error", progress: null, message: "Failed" });
        throw "The input is not a valid file for this operation.";
      }
      emit("operation-progress", { ...base, phase: "completed", progress: 1, message: "Done" });
      return { stdout: "Finished.", outputPath: request.outputPath ?? "C:/out/result.bin" };
    }

    async function installComponent(toolId: string) {
      for (const phase of ["downloading", "verifying", "installing"] as const) {
        await wait(step);
        emit("component-progress", { toolId, phase, progress: phase === "downloading" ? 0.5 : null, message: phase });
      }
      if (opts.install === "fail") throw "The download did not match its SHA-256.";
      available = [...available, toolId];
      return [toolId];
    }

    const commands: Record<string, (args: Record<string, unknown>) => unknown> = {
      "plugin:event|listen": ({ event, handler }) => {
        const ids = listeners.get(event as string) ?? [];
        ids.push(handler as number);
        listeners.set(event as string, ids);
        return handler;
      },
      "plugin:event|unlisten": ({ event, eventId }) => {
        listeners.set(event as string, (listeners.get(event as string) ?? []).filter((id) => id !== eventId));
      },
      "plugin:dialog|open": () => opts.openDialog ?? null,
      "plugin:dialog|save": () => opts.saveDialog ?? null,
      "plugin:app|version": () => "4.0.0",
      "plugin:updater|check": () => null,
      detect_available_tools: () => available,
      install_component: ({ toolId }) => installComponent(toolId as string),
      execute_operation: ({ request }) => runOperation(request as never),
      cancel_operation: ({ jobId }) => {
        held.get(jobId as string)?.("Stopped before it finished.");
        held.delete(jobId as string);
        return true;
      },
      allow_preview: () => null,
      reveal_path: () => null,
      open_link: () => null,
      image_search_engines: () => [
        { id: "google", label: "Google Lens", uploads: true },
        { id: "bing", label: "Bing", uploads: false },
      ],
      search_by_image: () => "https://lens.google.com/",
      list_audio_sources: () =>
        opts.audioSources ?? [{ id: "speakers", label: "Speakers", kind: "playback", isDefault: true }],
      recognize_music: async () => {
        await wait(step);
        emit("listening-level", { level: 0.5, through: 0.5 });
        await wait(step);
        return (
          opts.recognition ?? {
            matched: true,
            title: "Bohemian Rhapsody",
            artist: "Queen",
            album: "A Night at the Opera",
            released: "1975",
            label: "EMI",
            genre: "Rock",
            links: [{ label: "Spotify", url: "https://open.spotify.com/" }],
            coverUrl: "",
            message: "",
          }
        );
      },
    };

    Object.assign(window, {
      __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => undefined },
      __TAURI_INTERNALS__: {
        metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } },
        transformCallback: (callback: Handler) => {
          const id = nextId++;
          callbacks.set(id, callback);
          return id;
        },
        unregisterCallback: (id: number) => callbacks.delete(id),
        convertFileSrc: (path: string) => `/previews/ffmpeg.jpg?${encodeURIComponent(path)}`,
        invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
          calls.push({ cmd, args });
          const command = commands[cmd];
          if (!command) return null;
          return command(args);
        },
      },
      __host: {
        calls,
        emit,
        /** Simulates dropping files on the window. */
        drop: (paths: string[]) =>
          emit("tauri://drag-drop", { paths, position: { x: 400, y: 300 } }),
      },
    });
  }, options);
}

/** The commands the app sent to the host, in order. */
export async function hostCalls(page: Page, cmd?: string) {
  const calls = await page.evaluate(() => (window as unknown as { __host: { calls: Array<{ cmd: string; args: unknown }> } }).__host.calls);
  return cmd ? calls.filter((call) => call.cmd === cmd) : calls;
}
