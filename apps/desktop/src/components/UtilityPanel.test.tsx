import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { UtilityPanel } from './UtilityPanel';
import { createCatalogRows } from '../catalog/catalog';

function catalogTool(toolId: string) {
  const tool = createCatalogRows().flatMap(row => row.tools).find(entry => entry.id === toolId);
  if (!tool) throw new Error(`${toolId} catalog entry missing`);
  return tool;
}

afterEach(() => vi.restoreAllMocks());

const input = () => screen.getByRole('textbox', { name: 'Your text' });
const result = () => screen.getByRole('textbox', { name: 'Result' });

it('is a page named after the utility, and takes the focus', () => {
  render(<UtilityPanel tool={catalogTool('text-tools')} />);

  const page = screen.getByRole('region', { name: 'Change case' });
  expect(page).toHaveFocus();
  expect(within(page).getByText('Upper, lower, title or sentence case.')).toBeVisible();
  // The other utilities of the group are in the sidebar tree, not in a row of tabs.
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
});

it('answers as you type, with no button to press', async () => {
  render(<UtilityPanel tool={catalogTool('text-tools')} />);

  await userEvent.type(input(), 'hello');

  await waitFor(() => expect(result()).toHaveValue('HELLO'));
  expect(screen.getByText('It runs here, as you type.')).toBeVisible();
});

it('copies the result', async () => {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  render(<UtilityPanel tool={catalogTool('text-tools')} />);

  expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
  await user.type(input(), 'hello');
  await waitFor(() => expect(result()).toHaveValue('HELLO'));
  await user.click(screen.getByRole('button', { name: 'Copy' }));

  expect(writeText).toHaveBeenCalledWith('HELLO');
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeVisible();
});

it('clears what was typed', async () => {
  render(<UtilityPanel tool={catalogTool('text-tools')} />);

  expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  await userEvent.type(input(), 'hello');
  await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

  expect(input()).toHaveValue('');
});

it('lists facts as names and values', async () => {
  render(<UtilityPanel tool={catalogTool('text-tools')} subId="count" />);

  await userEvent.type(input(), 'two words');

  const words = await screen.findByText('Words');
  expect(words.tagName).toBe('DT');
  expect(words.nextElementSibling).toHaveTextContent('2');
});

it('follows the utility chosen in the sidebar without losing the text', async () => {
  const { rerender } = render(<UtilityPanel tool={catalogTool('text-tools')} subId="case" />);
  await userEvent.type(input(), 'hello');

  rerender(<UtilityPanel tool={catalogTool('text-tools')} subId="reverse" />);

  expect(screen.getByRole('region', { name: 'Reverse text' })).toBeVisible();
  expect(input()).toHaveValue('hello');
});

it('draws a picture result and offers to save it', async () => {
  render(<UtilityPanel tool={catalogTool('qr-barcode')} subId="qr-text" />);

  expect(screen.getByRole('button', { name: 'Save image' })).toBeDisabled();
  await userEvent.type(screen.getByRole('textbox', { name: 'A link or some text' }), 'https://example.test');

  expect(await screen.findByRole('img', { name: 'QR code' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save image' })).toBeEnabled();
});

it('reports an answer that cannot be worked out, and holds the copy', async () => {
  const user = userEvent.setup();
  render(<UtilityPanel tool={catalogTool('text-tools')} subId="replace" />);

  await user.type(input(), 'abc');
  await user.click(screen.getByRole('combobox', { name: 'Treat it as a pattern' }));
  await user.click(await screen.findByRole('option', { name: 'Yes' }));
  await user.type(screen.getByRole('textbox', { name: 'Find' }), '(');

  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByText('Nothing to copy while that is being fixed.')).toBeVisible();
});
