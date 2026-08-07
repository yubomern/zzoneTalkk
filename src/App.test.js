import { render, screen } from '@testing-library/react';
import App from './App';

test('renders ZoneTalk heading', () => {
  render(<App />);
  const heading = screen.getByText(/zonetalk/i);
  expect(heading).toBeInTheDocument();
});
