import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { App } from './App';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: vi.fn() }));

type DragDropPayload =
  | { type: 'enter'; paths: string[] }
  | { type: 'over' }
  | { type: 'drop'; paths: string[] }
  | { type: 'leave' };

let emitDragDrop: (payload: DragDropPayload) => void;

type ProgressPayload = {
  jobId: string;
  toolId: string;
  operationId: string;
  phase: string;
  progress: number | null;
  message: string;
};

let emitProgress: (payload: ProgressPayload) => void;
const listeners = new Map<string, (event: { payload: unknown }) => void>();
const emitOn = (event: string, payload: unknown) => listeners.get(event)?.({ payload });

beforeEach(() => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  listeners.clear();
  vi.mocked(listen).mockImplementation(async (event, callback) => {
    listeners.set(event as string, callback as (payload: { payload: unknown }) => void);
    if (event === 'operation-progress') {
      emitProgress = payload => (callback as (event: { payload: ProgressPayload }) => void)({ payload });
    }
    return () => {};
  });
  vi.mocked(getCurrentWebview).mockReturnValue({
    onDragDropEvent: async (handler: (event: { payload: DragDropPayload }) => void) => {
      emitDragDrop = payload => handler({ payload });
      return () => {};
    },
  } as unknown as ReturnType<typeof getCurrentWebview>);
});

afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  vi.resetAllMocks();
});

/** Resolves once the runner has sent the operation, so the test can read its job id. */
function pendingOperation() {
  let settle: ((value: { stdout: string; outputPath: string | null }) => void) | undefined;
  vi.mocked(invoke).mockImplementation((command: string) => {
    if (command === 'detect_available_tools') return Promise.resolve(['yt-dlp', 'ffmpeg', 'ffprobe']);
    return new Promise(resolve => {
      settle = resolve as (value: { stdout: string; outputPath: string | null }) => void;
    });
  });
  return {
    jobId: () => {
      const call = vi.mocked(invoke).mock.calls.find(([command]) => command === 'execute_operation');
      return (call?.[1] as { request: { jobId: string } } | undefined)?.request.jobId ?? '';
    },
    finish: (value: { stdout: string; outputPath: string | null }) => settle?.(value),
  };
}

async function startDownload() {
  const operation = pendingOperation();
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /open yt-dlp/i }));
  await user.type(screen.getByLabelText('Media URL'), 'https://example.com/video');
  vi.mocked(save).mockResolvedValue('C:\\videos\\video.mp4');
  await user.click(screen.getByRole('button', { name: 'Run' }));
  return { operation, user };
}

it('keeps a running operation in the queue after its tool page is left', async () => {
  const { operation, user } = await startDownload();

  emitProgress({
    jobId: operation.jobId(),
    toolId: 'yt-dlp',
    operationId: 'download-video',
    phase: 'downloading',
    progress: 0.37,
    message: 'Downloading media…',
  });

  // Leaving the tool's page does not stop what it started.
  await user.click(screen.getByRole('button', { name: /queue, 1 running/i }));
  expect(screen.queryByRole('region', { name: 'Download media' })).not.toBeInTheDocument();

  const row = screen.getByRole('article', { name: /download video/i });
  expect(within(row).getByText(/Running 37%/)).toBeVisible();
  expect(within(row).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '37');
});

it('moves a finished background operation to the history with its output path', async () => {
  const { operation, user } = await startDownload();

  operation.finish({ stdout: '', outputPath: 'C:\\videos\\video.mp4' });

  await user.click(screen.getByRole('button', { name: 'History' }));

  const row = await screen.findByRole('article', { name: /download video/i });
  expect(within(row).getByText('Done')).toBeVisible();
  // The path is not printed in the row — it is what the two buttons act on,
  // and what their tooltip says.
  expect(within(row).queryByText('C:\\videos\\video.mp4')).toBeNull();
  const reveal = within(row).getByRole('button', { name: /show in folder/i });
  expect(reveal).toHaveAttribute('title', 'C:\\videos\\video.mp4');
  expect(within(row).getByRole('button', { name: /copy path/i })).toBeVisible();
});

it('records a failed background operation instead of dropping it', async () => {
  vi.mocked(invoke).mockImplementation((command: string) => {
    if (command === 'detect_available_tools') return Promise.resolve(['yt-dlp']);
    return Promise.reject('yt-dlp.exe failed (exit code: 1)');
  });
  const user = userEvent.setup();
  render(<App />);

  await user.click(await screen.findByRole('button', { name: /open yt-dlp/i }));
  await user.type(screen.getByLabelText('Media URL'), 'https://example.com/video');
  vi.mocked(save).mockResolvedValue('C:\\videos\\video.mp4');
  await user.click(screen.getByRole('button', { name: 'Run' }));

  await user.click(screen.getByRole('button', { name: 'History' }));

  const row = await screen.findByRole('article', { name: /download video/i });
  expect(within(row).getByText('Failed')).toBeVisible();
  expect(within(row).getByText(/yt-dlp.exe failed/)).toBeVisible();
});

it('sends a job id so the host can address progress to one queue entry', async () => {
  const { operation } = await startDownload();
  // The id carries the clock as well as a counter, so a history restored
  // from the last run can never collide with a job started in this one.
  expect(operation.jobId()).toMatch(/^yt-dlp-download-video-[a-z0-9]+-\d+$/);
});

it('accepts a file dropped on the window instead of only the picker button', async () => {
  vi.mocked(invoke).mockResolvedValue(['qpdf']);
  render(<App />);
  await screen.findByRole('button', { name: /open qpdf/i });

  act(() => emitDragDrop({ type: 'enter', paths: ['C:\\fixtures\\contrato.pdf'] }));
  expect(await screen.findByText('Drop the file here')).toBeVisible();

  act(() => emitDragDrop({ type: 'drop', paths: ['C:\\fixtures\\contrato.pdf'] }));
  expect(await screen.findByText('contrato.pdf')).toBeVisible();
});

it('suggests the tools made for a dropped file, and opens one with the file in it (UC-13)', async () => {
  vi.mocked(invoke).mockResolvedValue(['qpdf']);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: /open qpdf/i });

  act(() => emitDragDrop({ type: 'drop', paths: ['C:\\fixtures\\contrato.pdf'] }));

  const suggestions = await screen.findByRole('group', { name: 'Tools that read this file' });
  expect(within(suggestions).queryByRole('button', { name: 'Compress files' })).not.toBeInTheDocument();

  // The search offers them too, before anything is typed.
  await user.keyboard('{Control>}k{/Control}');
  const palette = screen.getByRole('dialog', { name: 'Search tools' });
  expect(within(palette).getByRole('group', { name: 'For contrato.pdf' })).toBeVisible();
  await user.keyboard('{Escape}');

  await user.click(within(suggestions).getByRole('button', { name: 'Organise PDFs' }));
  const page = screen.getByRole('region', { name: 'Organise PDFs' });
  expect(within(page).getByText('contrato.pdf')).toBeVisible();
});

it('hands a dropped file to the tool panel that is already open', async () => {
  vi.mocked(invoke).mockResolvedValue(['qpdf']);
  const user = userEvent.setup();
  render(<App />);

  await user.click(await screen.findByRole('button', { name: /open qpdf/i }));
  act(() => emitDragDrop({ type: 'drop', paths: ['C:\\fixtures\\contrato.pdf'] }));

  const panel = screen.getByRole('region', { name: 'Organise PDFs' });
  expect(await within(panel).findByText('contrato.pdf')).toBeVisible();
});

it('does not claim a percentage before the tool reports one', async () => {
  const { user } = await startDownload();

  await user.click(screen.getByRole('button', { name: /queue, 1 running/i }));

  const row = screen.getByRole('article', { name: /download video/i });
  expect(within(row).getByText('Running')).toBeVisible();
  expect(within(row).queryByText(/%/)).not.toBeInTheDocument();
  expect(within(row).getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
});

it('shows the live host message on the queued row', async () => {
  const { operation, user } = await startDownload();

  emitProgress({
    jobId: operation.jobId(),
    toolId: 'yt-dlp',
    operationId: 'download-video',
    phase: 'downloading',
    progress: null,
    message: 'Merging video and audio…',
  });

  await user.click(screen.getByRole('button', { name: /queue, 1 running/i }));

  expect(within(screen.getByRole('article', { name: /download video/i })).getByText('Merging video and audio…')).toBeVisible();
});

it('installs a component from inside the app and shows its progress', async () => {
  let installed = false;
  let finishInstall: (() => void) | undefined;
  vi.mocked(invoke).mockImplementation((command: string) => {
    if (command === 'detect_available_tools') return Promise.resolve(installed ? ['qpdf'] : []);
    if (command === 'install_component') {
      return new Promise<string[]>(resolve => {
        finishInstall = () => { installed = true; resolve(['qpdf']); };
      });
    }
    return Promise.resolve({ stdout: '' });
  });

  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /get qpdf/i }));
  await user.click(screen.getByRole('button', { name: 'Download and install' }));

  expect(invoke).toHaveBeenCalledWith('install_component', { toolId: 'qpdf' });

  act(() => emitOn('component-progress', { toolId: 'qpdf', phase: 'downloading', progress: 0.5, message: 'Baixando…' }));
  const dialog = screen.getByRole('dialog', { name: /install qpdf/i });
  expect(within(dialog).getByText(/Downloading 50%/)).toBeVisible();

  await act(async () => { finishInstall?.(); });
  expect(await screen.findByRole('button', { name: /open qpdf/i })).toBeVisible();
});

it('installs 7-Zip from inside the app, which it could not do before', async () => {
  // It was the last of four tools whose packaging kept it out of the automatic
  // channel. Its installer demands elevation, so what is pinned is the
  // standalone build inside a 7z archive the app now unpacks itself.
  vi.mocked(invoke).mockResolvedValue([]);
  const user = userEvent.setup();
  render(<App />);

  await user.click(await screen.findByRole('button', { name: /get 7-zip/i }));

  const dialog = await screen.findByRole('dialog', { name: /install 7-zip/i });
  expect(within(dialog).getByRole('button', { name: 'Download and install' })).toBeEnabled();
  expect(within(dialog).getAllByText(/1.6 MB/).length).toBeGreaterThan(0);
});
