import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { ImageSearchPanel } from './ImageSearchPanel';
import { MusicPanel } from './MusicPanel';
import { createCatalogRows } from '../catalog/catalog';

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), convertFileSrc: (path: string) => `asset://${path}` }));

// One listener at a time is all the panel registers, and holding it lets a test
// push a level through the same path the host uses.
let listeners: ((event: { payload: unknown }) => void)[] = [];
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    listeners.push(handler);
    (named[name] ??= []).push(handler);
    return () => {
      listeners = listeners.filter((entry) => entry !== handler);
      named[name] = (named[name] ?? []).filter((entry) => entry !== handler);
    };
  }),
}));
// The panel registers one listener per event, in the order the effects run.
const named: Record<string, ((event: { payload: unknown }) => void)[]> = {};
function emit(name: string, payload: unknown) {
  for (const handler of named[name] ?? []) handler({ payload });
}
function emitLevel(payload: { level: number; through: number }) {
  emit('listening-level', payload);
}

beforeEach(() => Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} }));
afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  listeners = [];
  for (const key of Object.keys(named)) delete named[key];
  vi.resetAllMocks();
});

function catalogTool(toolId: string) {
  const tool = createCatalogRows().flatMap(row => row.tools).find(entry => entry.id === toolId);
  if (!tool) throw new Error(`${toolId} catalog entry missing`);
  return tool;
}

async function choose(combobox: HTMLElement, label: string | RegExp) {
  await userEvent.click(combobox);
  const list = await screen.findByRole('listbox');
  await userEvent.click(within(list).getByRole('option', { name: label }));
}

const engines = [
  { id: 'google', label: 'Google Lens', uploads: true },
  { id: 'yandex', label: 'Yandex', uploads: false },
  { id: 'bing', label: 'Bing', uploads: false },
  { id: 'tineye', label: 'TinEye', uploads: false },
];

const allSources = [
  { id: 'dev-speakers', label: 'Speakers (Realtek)', kind: 'playback', isDefault: true },
  { id: 'dev-hdmi', label: 'Display (HDMI)', kind: 'playback', isDefault: false },
  { id: 'dev-mic', label: 'Microphone (Blue Yeti)', kind: 'microphone', isDefault: true },
];

// ── Reverse image search ────────────────────────────────────────────────

it('offers every engine once an address is typed, because none of them needs the file', async () => {
  vi.mocked(invoke).mockImplementation(async (command: string) => {
    if (command === 'image_search_engines') return engines;
    return 'https://yandex.com/images/search';
  });

  render(<ImageSearchPanel tool={catalogTool('image-search')} initialPath="C:/pictures/cat.png" />);
  await screen.findByRole('combobox', { name: 'Search with' });

  // With a local file chosen, only the uploading engine is on offer.
  await userEvent.click(screen.getByRole('combobox', { name: 'Search with' }));
  expect(within(await screen.findByRole('listbox')).getAllByRole('option')).toHaveLength(1);
  await userEvent.keyboard('{Escape}');

  await userEvent.type(screen.getByLabelText('Picture address'), 'https://example.test/cat.jpg');
  await choose(screen.getByRole('combobox', { name: 'Search with' }), 'Yandex');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));

  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith('search_by_image', {
      request: { engine: 'yandex', path: null, imageUrl: 'https://example.test/cat.jpg' },
    }),
  );
});

it('refuses a file the search cannot read, and says which kinds it takes', async () => {
  vi.mocked(invoke).mockResolvedValue(engines);
  vi.mocked(open).mockResolvedValue('C:/documents/report.pdf');

  render(<ImageSearchPanel tool={catalogTool('image-search')} />);
  await userEvent.click(screen.getByRole('button', { name: 'Choose a picture' }));

  expect(await screen.findByText(/not something this tool reads/i)).toBeInTheDocument();
  expect(invoke).not.toHaveBeenCalledWith('search_by_image', expect.anything());
});

it('reports a refusal from the host instead of pretending the browser opened', async () => {
  vi.mocked(invoke).mockImplementation(async (command: string) => {
    if (command === 'image_search_engines') return engines;
    throw 'Google Lens refused the upload (HTTP 429). Try again in a moment.';
  });

  render(<ImageSearchPanel tool={catalogTool('image-search')} initialPath="C:/pictures/cat.png" />);
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));

  expect(await screen.findByText(/HTTP 429/)).toBeInTheDocument();
  expect(screen.queryByText('Opened in your browser.')).not.toBeInTheDocument();
});

// ── Music recognition ───────────────────────────────────────────────────

const match = {
  matched: true,
  title: 'Bohemian Rhapsody',
  artist: 'Queen',
  album: 'A Night at the Opera',
  released: '1975',
  label: 'Hollywood Records',
  genre: 'Rock',
  links: [
    { label: 'Apple Music', url: 'https://music.apple.com/us/album/bohemian-rhapsody/1' },
    { label: 'Spotify', url: 'https://open.spotify.com/search/Bohemian%20Rhapsody%20Queen' },
    { label: 'YouTube Music', url: 'https://music.youtube.com/search?q=Bohemian+Rhapsody' },
  ],
  coverUrl: 'https://images.test/large.jpg',
  message: 'Matched: Bohemian Rhapsody — Queen.',
};

function hosts(sources: typeof allSources, answer: unknown = match) {
  vi.mocked(invoke).mockImplementation(async (command: string) => {
    if (command === 'list_audio_sources') return sources;
    if (command === 'open_link') return undefined;
    return answer;
  });
}

it('listens to what the machine is playing, and asks for nothing else first', async () => {
  hosts(allSources);
  render(<MusicPanel tool={catalogTool('songrec')} />);

  // One question at the start, and the answer that matters is already chosen.
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Listen to' })).toHaveTextContent(/playing/i));

  // Nothing to configure about the clip: the length is the app's business.
  expect(screen.queryByLabelText(/clip length/i)).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /listen and identify/i }));

  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith('recognize_music', { request: { deviceId: 'dev-speakers' } }),
  );
});

it('asks which device only when there is more than one of that kind', async () => {
  hosts(allSources);
  render(<MusicPanel tool={catalogTool('songrec')} />);
  await screen.findByRole('combobox', { name: 'Listen to' });

  // Two speakers, so which one is a real question.
  expect(await screen.findByRole('combobox', { name: 'Sound source' })).toBeInTheDocument();

  // One microphone, so it is not.
  await choose(screen.getByRole('combobox', { name: 'Listen to' }), /microphone/i);
  await waitFor(() =>
    expect(screen.queryByRole('combobox', { name: 'Sound source' })).not.toBeInTheDocument(),
  );
});

it('records the microphone once that is what was chosen', async () => {
  hosts(allSources);
  render(<MusicPanel tool={catalogTool('songrec')} />);
  await screen.findByRole('combobox', { name: 'Listen to' });

  await choose(screen.getByRole('combobox', { name: 'Listen to' }), /microphone/i);
  await userEvent.click(screen.getByRole('button', { name: /listen and identify/i }));

  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith('recognize_music', { request: { deviceId: 'dev-mic' } }),
  );
});

it('shows every field of a match, with the cover art described for a screen reader', async () => {
  hosts(allSources);
  render(<MusicPanel tool={catalogTool('songrec')} />);
  await screen.findByRole('combobox', { name: 'Listen to' });
  await userEvent.click(screen.getByRole('button', { name: /listen and identify/i }));

  const card = await screen.findByLabelText('What was recognised');
  expect(within(card).getByRole('heading', { name: 'Bohemian Rhapsody' })).toBeInTheDocument();
  expect(within(card).getByText('Queen')).toBeInTheDocument();
  expect(within(card).getByText('A Night at the Opera')).toBeInTheDocument();
  expect(within(card).getByAltText('Cover art for Bohemian Rhapsody')).toBeInTheDocument();
});

it('says so when nothing matched, rather than showing an empty card', async () => {
  hosts(allSources, { ...match, matched: false, title: '', artist: '', message: 'No match. Turn it up.' });
  render(<MusicPanel tool={catalogTool('songrec')} />);
  await screen.findByRole('combobox', { name: 'Listen to' });
  await userEvent.click(screen.getByRole('button', { name: /listen and identify/i }));

  expect(await screen.findByText('No match. Turn it up.')).toBeInTheDocument();
  expect(screen.queryByLabelText('What was recognised')).not.toBeInTheDocument();
});

it('draws the sound the host reports while it is still recording', async () => {
  hosts(allSources);
  const { container } = render(<MusicPanel tool={catalogTool('songrec')} />);
  await screen.findByRole('combobox', { name: 'Listen to' });

  const bars = () =>
    Array.from(container.querySelectorAll<HTMLElement>('[data-meter-bar]')).map(
      (bar) => bar.style.getPropertyValue('--level'),
    );

  // Flat until something arrives.
  expect(bars().every((level) => level === '0')).toBe(true);

  await act(async () => {
    emitLevel({ level: 0.64, through: 0.25 });
  });

  // The newest value is appended, so it is the last bar that moves.
  expect(bars().at(-1)).toBe('0.8');
  expect(bars().at(-2)).toBe('0');
});

it('says it is still going after a lookup came back empty', async () => {
  // The recognition stays in flight, which is the state this is about.
  vi.mocked(invoke).mockImplementation(async (command: string) => {
    if (command === 'list_audio_sources') return allSources;
    return new Promise(() => {});
  });
  render(<MusicPanel tool={catalogTool('songrec')} />);
  await screen.findByRole('combobox', { name: 'Listen to' });
  await userEvent.click(screen.getByRole('button', { name: /listen and identify/i }));

  expect(await screen.findByText('Listening…')).toBeInTheDocument();

  // It looks as soon as it has enough rather than waiting for the whole clip,
  // so a first miss is normal and worth saying out loud.
  await act(async () => {
    emit('listening-attempt', { seconds: 4, matched: false, took: 750 });
  });

  expect(screen.getByText('Still listening…')).toBeInTheDocument();
});
