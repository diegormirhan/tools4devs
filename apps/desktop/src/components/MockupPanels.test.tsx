import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ChatMockupPanel } from './ChatMockupPanel';
import { PostMockupPanel } from './PostMockupPanel';
import { createCatalogRows } from '../catalog/catalog';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));

function catalogTool(toolId: string) {
  const tool = createCatalogRows().flatMap(row => row.tools).find(entry => entry.id === toolId);
  if (!tool) throw new Error(`${toolId} catalog entry missing`);
  return tool;
}

const rows = () => screen.getAllByRole('group', { name: /^Message \d+$/ });

it('is a page named after the tool, and takes the focus', () => {
  render(<ChatMockupPanel tool={catalogTool('chat-mockup')} />);

  expect(screen.getByRole('region', { name: 'Chat mockup' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Save as image' })).toBeEnabled();
});

it('adds, edits and removes messages, and the phone follows', async () => {
  const user = userEvent.setup();
  const dirty = vi.fn();
  render(<ChatMockupPanel tool={catalogTool('chat-mockup')} onDirtyChange={dirty} />);
  expect(rows()).toHaveLength(2);

  await user.click(screen.getByRole('button', { name: 'Add a message' }));
  expect(rows()).toHaveLength(3);
  const third = rows()[2]!;
  await user.type(within(third).getByRole('textbox', { name: 'Message' }), 'Bring the files');
  expect(screen.getByText('Bring the files')).toBeVisible();
  expect(dirty).toHaveBeenLastCalledWith(true);

  await user.click(within(third).getByRole('button', { name: 'Remove this message' }));
  expect(rows()).toHaveLength(2);
  expect(screen.queryByText('Bring the files')).not.toBeInTheDocument();
});

it('says who sent each message, and switches it', async () => {
  const user = userEvent.setup();
  render(<ChatMockupPanel tool={catalogTool('chat-mockup')} />);
  const first = rows()[0]!;

  expect(within(first).getByRole('radio', { name: 'Them' })).toBeChecked();
  await user.click(within(first).getByRole('radio', { name: 'You' }));

  expect(within(first).getByRole('radio', { name: 'You' })).toBeChecked();
  expect(within(first).getByRole('radio', { name: 'Them' })).not.toBeChecked();
});

it('turns a message into a voice note with a duration', async () => {
  const user = userEvent.setup();
  render(<ChatMockupPanel tool={catalogTool('chat-mockup')} />);
  const first = rows()[0]!;

  await user.click(within(first).getByRole('button', { name: 'Toggle voice message' }));

  expect(within(first).getByRole('button', { name: 'Toggle voice message' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(first).getByRole('textbox', { name: 'Duration' })).toHaveValue('0:21');
});

it('asks for the status only where the app shows one', async () => {
  const user = userEvent.setup();
  render(<ChatMockupPanel tool={catalogTool('chat-mockup')} />);
  expect(screen.getByRole('textbox', { name: 'Status' })).toBeVisible();

  await user.click(screen.getByRole('combobox', { name: 'App' }));
  await user.click(await screen.findByRole('option', { name: 'iMessage' }));

  expect(screen.queryByRole('textbox', { name: 'Status' })).not.toBeInTheDocument();
});

it('offers the badge and the counts a tweet has, and fewer for an Instagram post', async () => {
  const user = userEvent.setup();
  render(<PostMockupPanel tool={catalogTool('post-mockup')} />);
  expect(screen.getByRole('region', { name: 'Post mockup' })).toHaveFocus();

  const badge = screen.getByRole('checkbox', { name: 'Verified badge' });
  expect(badge).not.toBeChecked();
  await user.click(badge);
  expect(badge).toBeChecked();
  expect(screen.getByRole('textbox', { name: 'Views' })).toBeVisible();

  await user.click(screen.getByRole('combobox', { name: 'App' }));
  await user.click(await screen.findByRole('option', { name: 'Instagram post' }));

  expect(screen.queryByRole('checkbox', { name: 'Verified badge' })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Views' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Comments' })).toBeVisible();
});

it('shows the post text in the picture as it is typed', async () => {
  const user = userEvent.setup();
  render(<PostMockupPanel tool={catalogTool('post-mockup')} />);
  const text = screen.getByRole('textbox', { name: 'Post text' });

  await user.clear(text);
  await user.type(text, 'Hello there');

  expect(screen.getByText('Hello there', { selector: 'p' })).toBeVisible();
});
