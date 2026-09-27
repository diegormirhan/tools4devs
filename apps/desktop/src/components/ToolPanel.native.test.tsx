import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { open, save } from '@tauri-apps/plugin-dialog';
import { ToolPanel, suggestedOutputName } from './ToolPanel';
import { createCatalogRows } from '../catalog/catalog';
import type { ToolJob } from '../domain/job-queue';

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }));
beforeEach(() => Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} }));
afterEach(() => { Reflect.deleteProperty(window, '__TAURI_INTERNALS__'); vi.resetAllMocks(); });

const jobId = 'job-1';

/**
 * Picks a value from the custom select. The native control is gone — its popup
 * was drawn by Windows, in Windows' own colours — so choosing is now two
 * steps: open the list, then click the option by the label a user would read.
 */
async function choose(combobox: HTMLElement, label: string | RegExp) {
  await userEvent.click(combobox);
  const list = await screen.findByRole('listbox');
  await userEvent.click(within(list).getByRole('option', { name: label }));
}


function catalogTool(toolId: string) {
  const tool = createCatalogRows().flatMap(row => row.tools).find(entry => entry.id === toolId);
  if (!tool) throw new Error(`${toolId} catalog entry missing`);
  return tool;
}

function job(overrides: Partial<ToolJob>): ToolJob {
  return {
    id: jobId,
    toolId: 'yt-dlp',
    toolName: 'Download media',
    operationId: 'download-video',
    operationLabel: 'Download video',
    sourceLabel: 'https://example.com/video',
    status: 'running',
    progress: 0,
    message: 'Preparing the operation…',
    outputPath: null,
    options: {},
    startedAt: 0,
    ...overrides,
  };
}

it('hands the runner the request envelope expected by the native command', async () => {
  vi.mocked(save).mockResolvedValue('C:\\videos\\video.mp4');
  const onRun = vi.fn(() => jobId);
  render(<ToolPanel tool={catalogTool('yt-dlp')} onClose={vi.fn()} onRun={onRun} />);

  await userEvent.type(screen.getByLabelText('Media URL'), 'https://example.com/video');
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  expect(onRun).toHaveBeenCalledWith(expect.objectContaining({
    request: expect.objectContaining({
      toolId: 'yt-dlp',
      operationId: 'download-video',
      inputPaths: [],
      sourceUrl: 'https://example.com/video',
    }),
    operationLabel: 'Download video',
  }));
});

it('mirrors the live progress the queue reports for its own job', async () => {
  vi.mocked(save).mockResolvedValue('video.mp4');
  const running = job({ toolId: 'yt-dlp', operationId: 'download-video', status: 'running', progress: 0.42, message: 'Downloading media…' });
  render(<ToolPanel tool={catalogTool('yt-dlp')} jobs={[running]} onClose={vi.fn()} onRun={() => jobId} />);

  await userEvent.type(screen.getByLabelText('Media URL'), 'https://example.com/video');
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  expect(await screen.findByText('Downloading media…')).toBeVisible();
  expect(screen.getByText('42%')).toBeVisible();
  expect(screen.getByRole('progressbar', { name: 'Operation progress' })).toHaveAttribute('aria-valuenow', '42');
  expect(screen.getByText(/keeps running in the queue/i)).toBeVisible();
});

it('reports a failed job as an error instead of a silent success', async () => {
  vi.mocked(save).mockResolvedValue('C:\\videos\\video.mp4');
  const failed = job({ status: 'failed', message: 'yt-dlp.exe not found' });
  render(<ToolPanel tool={catalogTool('yt-dlp')} jobs={[failed]} onClose={vi.fn()} onRun={() => jobId} />);

  await userEvent.type(screen.getByLabelText('Media URL'), 'https://example.com/video');
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('yt-dlp.exe not found');
  expect(screen.getByText(/the job failed/i)).toBeVisible();
});

it('shows the host result and the produced output path', async () => {
  const succeeded = job({
    toolId: 'libvips',
    operationId: 'upscale',
    status: 'succeeded',
    progress: 1,
    message: 'Image enlarged 2× with Lanczos3.',
    outputPath: 'image-upscale.png',
  });
  vi.mocked(save).mockResolvedValue('image-upscale.png');
  render(<ToolPanel tool={catalogTool('libvips')} initialPath={'C:\\fixtures\\image.png'} jobs={[succeeded]} onClose={vi.fn()} onRun={() => jobId} />);

  await choose(screen.getByRole('combobox', { name: 'Operation' }), 'Enlarge (plain)');
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  expect(await screen.findByText(/image enlarged 2×/i)).toBeVisible();
  expect(screen.getByText(/Output: image-upscale.png/)).toBeVisible();
});

it('selects a directory for project searches', async () => {
  vi.mocked(open).mockResolvedValue('C:\\fixtures');
  const onRun = vi.fn(() => jobId);
  render(<ToolPanel tool={catalogTool('ripgrep')} onClose={vi.fn()} onRun={onRun} />);

  await userEvent.click(screen.getByRole('button', { name: /choose the project folder/i }));
  expect(open).toHaveBeenCalledWith({ directory: true, multiple: false });

  await userEvent.type(screen.getByLabelText('Text or regex'), 'tools4devs');
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  expect(onRun).toHaveBeenCalledWith(expect.objectContaining({
    request: expect.objectContaining({ inputPaths: ['C:\\fixtures'], options: { query: 'tools4devs' } }),
  }));
});

it('passes the file selected in the main workspace to the operation', async () => {
  const onRun = vi.fn(() => jobId);
  render(<ToolPanel tool={catalogTool('jq')} initialPath={'C:\\fixtures\\sample.json'} onClose={vi.fn()} onRun={onRun} />);

  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  expect(onRun).toHaveBeenCalledWith(expect.objectContaining({
    request: expect.objectContaining({ inputPaths: ['C:\\fixtures\\sample.json'] }),
  }));
});

it('stops before running when the destination dialog is dismissed', async () => {
  vi.mocked(save).mockResolvedValue(null);
  const onRun = vi.fn(() => jobId);
  render(<ToolPanel tool={catalogTool('qpdf')} initialPath={'C:\\fixtures\\contrato.pdf'} onClose={vi.fn()} onRun={onRun} />);

  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  expect(onRun).not.toHaveBeenCalled();
  expect(await screen.findByRole('alert')).toHaveTextContent(/choose an output file/i);
});

it.each([
  ['ffmpeg', 'extract-audio', 'video.mp4', 'video-extract-audio.mp3'],
  ['7zip', 'compress', 'sample.txt', 'sample-compress.zip'],
  ['pandoc', 'convert', 'article.md', 'article-convert.html'],
  ['libvips', 'compress', 'image.png', 'image-compress.jpg'],
])('suggests a usable output format for %s/%s', (tool, operation, input, output) => {
  expect(suggestedOutputName(input, operation, tool)).toBe(output);
});

it('never lets a metadata edit touch the original file', async () => {
  vi.mocked(save).mockResolvedValue('C:\fotos\foto-set-title.jpg');
  const onRun = vi.fn(() => jobId);
  render(<ToolPanel tool={catalogTool('exiftool')} initialPath={'C:\fotos\foto.jpg'} onClose={vi.fn()} onRun={onRun} />);

  await choose(screen.getByRole('combobox', { name: 'Operation' }), /set title/i);
  await userEvent.type(screen.getByLabelText('Title'), 'Contrato');
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  expect(onRun).toHaveBeenCalledWith(expect.objectContaining({
    request: expect.objectContaining({
      toolId: 'exiftool',
      operationId: 'set-title',
      inputPaths: ['C:\fotos\foto.jpg'],
      outputPath: 'C:\fotos\foto-set-title.jpg',
      options: { title: 'Contrato' },
    }),
  }));
});

it('asks for page and resolution before rasterising a PDF', async () => {
  render(<ToolPanel tool={catalogTool('poppler')} initialPath={'C:\docs\contrato.pdf'} onClose={vi.fn()} onRun={() => jobId} />);

  await choose(screen.getByRole('combobox', { name: 'Operation' }), /page as image/i);

  expect(screen.getByLabelText('Page')).toHaveValue(1);
  expect(screen.getByLabelText('Resolution (DPI)')).toHaveValue(150);
});

it('does not ask for a destination when the operation only reads', async () => {
  render(<ToolPanel tool={catalogTool('imagemagick')} initialPath={'C:\fotos\foto.png'} onClose={vi.fn()} onRun={() => jobId} />);

  expect(screen.getByText(/the extension decides the format/i)).toBeVisible();
  await choose(screen.getByRole('combobox', { name: 'Operation' }), /inspect/i);
  expect(screen.queryByText(/the extension decides the format/i)).not.toBeInTheDocument();
});

it.each([
  ['poppler', 'extract-text', 'contrato.pdf', 'contrato-extract-text.txt'],
  ['poppler', 'rasterize', 'contrato.pdf', 'contrato-rasterize.png'],
  ['oxipng', 'optimize', 'foto.png', 'foto-optimize.png'],
  ['mkvtoolnix', 'remux', 'video.mp4', 'video-remux.mkv'],
  ['exiftool', 'strip', 'foto.jpg', 'foto-strip.jpg'],
])('suggests a usable output format for %s/%s', (tool, operation, input, output) => {
  expect(suggestedOutputName(input, operation, tool)).toBe(output);
});

it('waits for both files before a structural comparison can run', async () => {
  vi.mocked(open).mockResolvedValue(['C:\src\antes.ts', 'C:\src\depois.ts']);
  const onRun = vi.fn(() => jobId);
  render(<ToolPanel tool={catalogTool('difftastic')} onClose={vi.fn()} onRun={onRun} />);

  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();

  await userEvent.click(screen.getByRole('button', { name: /choose both files/i }));
  expect(open).toHaveBeenCalledWith({ directory: false, multiple: true });

  await userEvent.click(screen.getByRole('button', { name: 'Run' }));
  expect(onRun).toHaveBeenCalledWith(expect.objectContaining({
    request: expect.objectContaining({ inputPaths: ['C:\src\antes.ts', 'C:\src\depois.ts'] }),
  }));
});

it.each(['tokei', 'dust'])('asks %s for a folder instead of a file', async toolId => {
  vi.mocked(open).mockResolvedValue('C:\projeto');
  render(<ToolPanel tool={catalogTool(toolId)} onClose={vi.fn()} onRun={() => jobId} />);

  await userEvent.click(screen.getByRole('button', { name: /choose the project folder/i }));

  expect(open).toHaveBeenCalledWith({ directory: true, multiple: false });
});

it('never offers a destination for a read-only dev tool', () => {
  render(<ToolPanel tool={catalogTool('miller')} initialPath={'C:\dados\vendas.csv'} onClose={vi.fn()} onRun={() => jobId} />);

  expect(screen.queryByRole('button', { name: 'Choose destination' })).not.toBeInTheDocument();
});

it('sends the chosen browser as the cookie source, and nothing else', async () => {
  const onRun = vi.fn(() => jobId);
  vi.mocked(save).mockResolvedValue('C:\videos\video.mp4');
  render(<ToolPanel tool={catalogTool('yt-dlp')} onClose={vi.fn()} onRun={onRun} />);

  await userEvent.type(screen.getByLabelText('Media URL'), 'https://example.com/watch');
  await choose(screen.getByRole('combobox', { name: 'Sign in' }), /cookies from firefox/i);
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  expect(onRun).toHaveBeenCalledWith(expect.objectContaining({
    request: expect.objectContaining({
      toolId: 'yt-dlp',
      // The host rejects both sources at once, so the unused one must be empty.
      options: expect.objectContaining({ cookiesFrom: 'firefox', cookieFile: '' }),
    }),
  }));
});

it('asks for the cookie file only once that method is chosen', async () => {
  render(<ToolPanel tool={catalogTool('yt-dlp')} onClose={vi.fn()} onRun={() => jobId} />);

  expect(screen.queryByLabelText('Cookie file')).not.toBeInTheDocument();
  await choose(screen.getByRole('combobox', { name: 'Sign in' }), /cookie file/i);
  expect(screen.getByLabelText('Cookie file')).toBeVisible();
  // Picking a file must not leave a browser name behind next to it.
  await choose(screen.getByRole('combobox', { name: 'Sign in' }), /cookies from firefox/i);
  expect(screen.queryByLabelText('Cookie file')).not.toBeInTheDocument();
});

it('offers no sign-in or quality controls for tools that have no account', async () => {
  render(<ToolPanel tool={catalogTool('oxipng')} initialPath={'C:\fotos\foto.png'} onClose={vi.fn()} onRun={() => jobId} />);
  expect(screen.queryByRole('combobox', { name: 'Sign in' })).not.toBeInTheDocument();
});

it.each([
  ['compatible', 'video.mp4'],
  ['best', 'video.mkv'],
])('suggests a container the chosen quality can actually hold (%s)', (quality, expected) => {
  expect(suggestedOutputName(undefined, 'download-video', 'yt-dlp', { quality })).toBe(expected);
});

it('drives gallery-dl from a URL and writes into a folder', async () => {
  const onRun = vi.fn(() => jobId);
  vi.mocked(open).mockResolvedValue('C:\galerias');
  render(<ToolPanel tool={catalogTool('gallery-dl')} onClose={vi.fn()} onRun={onRun} />);

  // A URL-driven tool offers no file picker at all.
  expect(screen.queryByRole('button', { name: /choose file/i })).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Media URL'), 'https://example.com/user/gallery');
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  // A gallery is a set of files, so the destination is a directory.
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ directory: true }));
  expect(onRun).toHaveBeenCalledWith(expect.objectContaining({
    request: expect.objectContaining({
      toolId: 'gallery-dl',
      operationId: 'download-gallery',
      sourceUrl: 'https://example.com/user/gallery',
      outputPath: 'C:\galerias',
    }),
  }));
});

it('offers gallery-dl the same sign-in, but no quality mode', async () => {
  render(<ToolPanel tool={catalogTool('gallery-dl')} onClose={vi.fn()} onRun={() => jobId} />);

  expect(screen.getByRole('combobox', { name: 'Sign in' })).toBeVisible();
  // Quality is yt-dlp's: gallery-dl takes whatever the site serves.
  expect(screen.queryByRole('combobox', { name: 'Quality' })).not.toBeInTheDocument();
});

it('opens the save dialog in the folder chosen in settings', async () => {
  vi.mocked(save).mockResolvedValue('D:\\saida\\foto-optimize.png');
  render(
    <ToolPanel
      tool={catalogTool('oxipng')}
      initialPath={'C:\\fotos\\foto.png'}
      defaultFolder={'D:\\saida'}
      onClose={vi.fn()}
      onRun={() => jobId}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Choose destination' }));

  // The folder is replaced but the suggested name survives, because its
  // extension is what decides the output format.
  expect(save).toHaveBeenCalledWith({ defaultPath: 'D:\\saida\\foto-optimize.png' });
});

it('saves into the folder chosen in settings without asking again', async () => {
  const onRun = vi.fn(() => jobId);
  render(
    <ToolPanel
      tool={catalogTool('oxipng')}
      initialPath={'C:\\fotos\\foto.png'}
      defaultFolder={'D:\\saida'}
      onClose={vi.fn()}
      onRun={onRun}
    />,
  );

  // The destination is settled before the run, and it says where.
  expect(screen.getByText('D:\\saida\\foto-optimize.png')).toBeInTheDocument();
  expect(screen.getByText(/your default folder, from settings/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  // A default folder means the setting decides; no dialog is opened at all.
  expect(save).not.toHaveBeenCalled();
  expect(onRun).toHaveBeenCalledWith(
    expect.objectContaining({
      request: expect.objectContaining({ outputPath: 'D:\\saida\\foto-optimize.png' }),
    }),
  );
});

it('still asks where to save when no default folder is set', async () => {
  const onRun = vi.fn(() => jobId);
  vi.mocked(save).mockResolvedValue('C:\\fotos\\foto-optimize.png');
  render(
    <ToolPanel
      tool={catalogTool('oxipng')}
      initialPath={'C:\\fotos\\foto.png'}
      onClose={vi.fn()}
      onRun={onRun}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  expect(save).toHaveBeenCalled();
});

it('sends a gallery straight to the default folder rather than a file inside it', async () => {
  const onRun = vi.fn(() => jobId);
  render(
    <ToolPanel
      tool={catalogTool('gallery-dl')}
      defaultFolder={'D:\\saida'}
      onClose={vi.fn()}
      onRun={onRun}
    />,
  );

  await userEvent.type(screen.getByLabelText('Media URL'), 'https://example.test/gallery');
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  expect(onRun).toHaveBeenCalledWith(
    expect.objectContaining({
      request: expect.objectContaining({ outputPath: 'D:\\saida' }),
    }),
  );
});

it('falls back to the suggested path when no default folder is set', async () => {
  vi.mocked(save).mockResolvedValue('C:\\fotos\\foto-optimize.png');
  render(<ToolPanel tool={catalogTool('oxipng')} initialPath={'C:\\fotos\\foto.png'} onClose={vi.fn()} onRun={() => jobId} />);

  await userEvent.click(screen.getByRole('button', { name: 'Choose destination' }));

  expect(save).toHaveBeenCalledWith({ defaultPath: 'C:\\fotos\\foto-optimize.png' });
});

it('only reports work worth a confirmation once there is some', async () => {
  const onDirtyChange = vi.fn();
  vi.mocked(open).mockResolvedValue('C:\fotos\foto.png');
  render(<ToolPanel tool={catalogTool('libvips')} onClose={vi.fn()} onRun={() => jobId} onDirtyChange={onDirtyChange} />);

  // Opening a tool changes nothing, so closing it should ask nothing.
  expect(onDirtyChange).toHaveBeenLastCalledWith(false);

  await userEvent.click(screen.getByRole('button', { name: /choose files/i }));

  expect(onDirtyChange).toHaveBeenLastCalledWith(true);
});

it('counts a typed URL as work, even with no file chosen', async () => {
  const onDirtyChange = vi.fn();
  render(<ToolPanel tool={catalogTool('yt-dlp')} onClose={vi.fn()} onRun={() => jobId} onDirtyChange={onDirtyChange} />);

  expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  await userEvent.type(screen.getByLabelText('Media URL'), 'https://example.com/watch');
  expect(onDirtyChange).toHaveBeenLastCalledWith(true);
});

it('says why a file was refused instead of quietly ignoring it', async () => {
  // The refusal used to be wiped by the feedback reset that ran straight
  // after it, so the file vanished and nothing explained why.
  vi.mocked(open).mockResolvedValue('C:\fotos\foto.png');
  render(<ToolPanel tool={catalogTool('qpdf')} onClose={vi.fn()} onRun={() => jobId} />);

  await userEvent.click(screen.getByRole('button', { name: /choose files/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/\.png file is not something this tool reads/i);
  expect(screen.queryByText('foto.png')).not.toBeInTheDocument();
});

it('sends the factor the panel offered, which the host turns into a second pass', async () => {
  const onRun = vi.fn(() => jobId);
  vi.mocked(save).mockResolvedValue('C:\fotos\foto-upscale-model.png');
  render(
    <ToolPanel
      tool={catalogTool('libvips')}
      initialPath={'C:\fotos\foto.png'}
      onClose={vi.fn()}
      onRun={onRun}
    />,
  );

  await choose(screen.getByRole('combobox', { name: 'Operation' }), 'Enlarge (model)');
  // Four times is what the model does; the panel opens on it.
  expect(screen.getByRole('combobox', { name: 'Enlarge by' })).toHaveTextContent('4x');

  await choose(screen.getByRole('combobox', { name: 'Enlarge by' }), '2x');
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));

  expect(onRun).toHaveBeenCalledWith(
    expect.objectContaining({
      request: expect.objectContaining({
        toolId: 'libvips',
        operationId: 'upscale-model',
        options: expect.objectContaining({ scale: '2' }),
      }),
    }),
  );
});

it('refuses a TIFF for the model but takes it for every other image operation', async () => {
  vi.mocked(open).mockResolvedValue('C:\scans\scan.tiff');
  render(<ToolPanel tool={catalogTool('libvips')} onClose={vi.fn()} onRun={() => jobId} />);

  await choose(screen.getByRole('combobox', { name: 'Operation' }), 'Enlarge (model)');
  await userEvent.click(screen.getByRole('button', { name: /choose files/i }));
  expect(await screen.findByText(/not something this operation reads/i)).toBeInTheDocument();

  await choose(screen.getByRole('combobox', { name: 'Operation' }), 'Resize');
  await userEvent.click(screen.getByRole('button', { name: /choose files/i }));
  expect(await screen.findByRole('button', { name: /scan\.tiff/i })).toBeInTheDocument();
});
