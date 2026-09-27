import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useOperationRunner, type OperationRequest } from './useOperationRunner';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }));

afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  vi.resetAllMocks();
});

const request: OperationRequest = {
  toolId: 'ffmpeg',
  operationId: 'extract-audio',
  inputPaths: ['C:\\clips\\clip.mp4'],
  outputPath: 'C:\\clips\\clip.mp3',
  options: {},
  sourceUrl: null,
};

const meta = { toolName: 'Convert media', operationLabel: 'Extract audio', sourceLabel: 'clip.mp4', options: {} };

function useNativeHost() {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
}

it('refuses to claim success in the browser preview and records the failure', async () => {
  const { result } = renderHook(() => useOperationRunner());

  act(() => {
    result.current.runOperation(request, meta);
  });

  await waitFor(() => expect(result.current.finishedJobs).toHaveLength(1));
  expect(invoke).not.toHaveBeenCalled();
  expect(result.current.finishedJobs[0]).toMatchObject({ status: 'failed' });
  expect(result.current.finishedJobs[0]!.message).toMatch(/open the tools4devs app/i);
});

it('settles a native operation with the message and output path the host returned', async () => {
  useNativeHost();
  vi.mocked(invoke).mockResolvedValue({ stdout: '', message: 'Operation finished.', outputPath: 'C:\\clips\\clip.mp3' });
  const { result } = renderHook(() => useOperationRunner());

  act(() => {
    result.current.runOperation(request, meta);
  });

  await waitFor(() => expect(result.current.finishedJobs).toHaveLength(1));
  expect(invoke).toHaveBeenCalledWith('execute_operation', {
    request: {
      ...request,
      // Chosen in Settings and applied by the host, so what the queue reports
      // as the output is the file that was actually written.
      conflictPolicy: 'keep-both',
      jobId: expect.stringContaining('ffmpeg-extract-audio-'),
    },
  });
  expect(result.current.finishedJobs[0]).toMatchObject({
    status: 'succeeded',
    message: 'Operation finished.',
    outputPath: 'C:\\clips\\clip.mp3',
    progress: 1,
  });
});

it('routes host progress to the job it belongs to and ignores every other job', async () => {
  useNativeHost();
  let emit: ((event: { payload: unknown }) => void) | undefined;
  vi.mocked(listen).mockImplementation(async (_event, callback) => {
    emit = callback as (event: { payload: unknown }) => void;
    return () => {};
  });
  vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useOperationRunner());

  let jobId = '';
  act(() => {
    jobId = result.current.runOperation(request, meta);
  });
  await waitFor(() => expect(emit).toBeDefined());

  act(() => {
    emit?.({ payload: { jobId: 'another-job', toolId: 'ffmpeg', operationId: 'extract-audio', phase: 'downloading', progress: 0.9, message: 'Outra tarefa' } });
    emit?.({ payload: { jobId, toolId: 'ffmpeg', operationId: 'extract-audio', phase: 'downloading', progress: 0.25, message: 'Convertendo…' } });
  });

  expect(result.current.runningJobs).toHaveLength(1);
  expect(result.current.runningJobs[0]).toMatchObject({ progress: 0.25, message: 'Convertendo…' });
});

it('holds work back once the machine is already busy, and says it is waiting', async () => {
  useNativeHost();
  let release: ((value: unknown) => void) | undefined;
  vi.mocked(invoke).mockImplementation(
    () => new Promise((resolve) => { release = resolve; }),
  );
  const { result } = renderHook(() => useOperationRunner({ concurrency: 1 }));

  act(() => { result.current.runOperation(request, meta); });
  act(() => { result.current.runOperation(request, meta); });

  // One is on the host, the other is visibly waiting rather than silently late.
  await waitFor(() => expect(result.current.runningJobs).toHaveLength(2));
  const statuses = result.current.runningJobs.map((job) => job.status).sort();
  expect(statuses).toEqual(['queued', 'running']);
  expect(invoke).toHaveBeenCalledTimes(1);

  await act(async () => {
    release?.({ stdout: '', message: 'Operation finished.' });
  });

  // The free slot is taken by the one that was waiting.
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
});

it('stops a job that is still waiting without asking the host about it', async () => {
  useNativeHost();
  vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useOperationRunner({ concurrency: 1 }));

  let queuedId = '';
  act(() => { result.current.runOperation(request, meta); });
  act(() => { queuedId = result.current.runOperation(request, meta); });

  await waitFor(() => expect(result.current.runningJobs).toHaveLength(2));
  act(() => { result.current.cancelOperation(queuedId); });

  await waitFor(() => expect(result.current.finishedJobs).toHaveLength(1));
  expect(result.current.finishedJobs[0]).toMatchObject({ status: 'cancelled' });
  // Nothing was running for it, so the host was never troubled.
  expect(invoke).not.toHaveBeenCalledWith('cancel_operation', expect.anything());
});

it('asks the host to stop a job that is actually running', async () => {
  useNativeHost();
  let fail: ((reason: unknown) => void) | undefined;
  vi.mocked(invoke).mockImplementation((command: string) => {
    if (command === 'cancel_operation') return Promise.resolve(true);
    return new Promise((_resolve, reject) => { fail = reject; });
  });
  const { result } = renderHook(() => useOperationRunner());

  let jobId = '';
  act(() => { jobId = result.current.runOperation(request, meta); });
  await waitFor(() => expect(result.current.runningJobs).toHaveLength(1));

  act(() => { result.current.cancelOperation(jobId); });
  expect(invoke).toHaveBeenCalledWith('cancel_operation', { jobId });

  // The host then fails the operation in its own words, and the queue reads
  // that back as stopped rather than as one more red row.
  await act(async () => {
    fail?.('Stopped before it finished.');
  });
  await waitFor(() => expect(result.current.finishedJobs).toHaveLength(1));
  expect(result.current.finishedJobs[0]).toMatchObject({ status: 'cancelled', message: 'Stopped.' });
});
