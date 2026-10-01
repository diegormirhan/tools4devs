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
  await user.click(screen.getByRole('switch', { name: 'Treat it as a pattern' }));
  await user.type(screen.getByRole('textbox', { name: 'Find' }), '(');

  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByText('Nothing to copy while that is being fixed.')).toBeVisible();
});

it('asks a yes-or-no question with a switch, not a list', async () => {
  const user = userEvent.setup();
  render(<UtilityPanel tool={catalogTool('text-tools')} subId="replace" />);

  const caseSwitch = screen.getByRole('switch', { name: 'Match the case' });
  expect(caseSwitch).toBeChecked();
  await user.click(caseSwitch);
  expect(caseSwitch).not.toBeChecked();
  expect(screen.queryByRole('combobox', { name: 'Match the case' })).not.toBeInTheDocument();
});

describe('a calculator', () => {
  it('takes numbers on the left and leads with the first answer on the right', async () => {
    render(<UtilityPanel tool={catalogTool('math-finance')} subId="financing" />);

    expect(screen.getByRole('heading', { name: 'Your numbers' })).toBeVisible();
    // No text box to type into: a calculator's input is its numbers.
    expect(screen.queryByRole('textbox', { name: 'Your text' })).not.toBeInTheDocument();

    const answer = await screen.findByRole('region', { name: 'Monthly payment' });
    expect(within(answer).getByTestId('headline')).not.toBeEmptyDOMElement();
    expect(within(answer).getByText('Total paid')).toBeVisible();
    expect(within(answer).queryByText('Monthly payment', { selector: 'dt' })).not.toBeInTheDocument();
  });

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

describe('a CSS generator', () => {
  it('sets bounded numbers with sliders that say their value', () => {
    render(<UtilityPanel tool={catalogTool('css-tools')} subId="box-shadow" />);

    const blur = screen.getByRole('slider', { name: 'Blur' });
    expect(blur).toHaveAttribute('aria-valuenow', '24');
    expect(blur).toHaveAttribute('aria-valuemin', '0');
    expect(blur).toHaveAttribute('aria-valuemax', '200');
    expect(screen.getByText('24', { selector: 'output' })).toBeVisible();
  });

  it('moves a slider from the keyboard, and the CSS follows', async () => {
    const user = userEvent.setup();
    render(<UtilityPanel tool={catalogTool('css-tools')} subId="box-shadow" />);
    const css = await screen.findByRole('region', { name: 'CSS' });
    await waitFor(() => expect(within(css).getByText(/box-shadow:/)).toBeVisible());

    screen.getByRole('slider', { name: 'Blur' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('slider', { name: 'Blur' })).toHaveAttribute('aria-valuenow', '25');
    await waitFor(() => expect(within(css).getByText(/25px/)).toBeVisible());
  });

  it('picks the preview surface from a row of choices and copies the CSS', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<UtilityPanel tool={catalogTool('css-tools')} subId="box-shadow" />);

    const surfaces = screen.getByRole('radiogroup', { name: 'Preview on' });
    expect(within(surfaces).getByRole('radio', { name: 'Box' })).toBeChecked();
    await user.click(within(surfaces).getByRole('radio', { name: 'Card' }));
    expect(within(surfaces).getByRole('radio', { name: 'Card' })).toBeChecked();

    const css = screen.getByRole('region', { name: 'CSS' });
    await user.click(within(css).getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('box-shadow:'));
  });
});
