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
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ isMaximized: async () => false, onResized: async () => () => {}, minimize: vi.fn(), toggleMaximize: vi.fn(), close: vi.fn() }),
}));

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

beforeEach(() => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  vi.mocked(listen).mockImplementation(async (event, callback) => {
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

