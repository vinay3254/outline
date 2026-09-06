import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the Cutline workspace', () => {
  render(<App />);
  expect(screen.getByRole('main', { name: 'Cutline editor' })).toBeVisible();
});
