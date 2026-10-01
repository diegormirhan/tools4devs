import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UtilityPanel } from './UtilityPanel';
import { createCatalogRows } from '../catalog/catalog';

function catalogTool(toolId: string) {
  const tool = createCatalogRows().flatMap(row => row.tools).find(entry => entry.id === toolId);
  if (!tool) throw new Error(`${toolId} catalog entry missing`);
  return tool;
}

afterEach(() => vi.restoreAllMocks());

const input = () => screen.getByRole('textbox', { name: 'Your text' });

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

describe('a calculator', () => {
  it('follows a changed number and copies every answer', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<UtilityPanel tool={catalogTool('math-finance')} subId="financing" />);
    const answer = await screen.findByRole('region', { name: 'Monthly payment' });
    const before = within(answer).getByTestId('headline').textContent;

    const months = screen.getByRole('spinbutton', { name: 'Months' });
    await user.clear(months);
    await user.type(months, '12');
    await waitFor(() => expect(within(answer).getByTestId('headline').textContent).not.toBe(before));

    await user.click(within(answer).getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^Monthly payment: .+\nTotal paid: /));
  });

  it('shows a calculator without named answers as one result', async () => {
    render(<UtilityPanel tool={catalogTool('math-finance')} subId="rule-of-three" />);

    const answer = await screen.findByRole('region', { name: 'Result' });
    await waitFor(() => expect(within(answer).getByTestId('headline')).not.toBeEmptyDOMElement());
    expect(within(answer).queryByRole('term')).not.toBeInTheDocument();
  });
});
