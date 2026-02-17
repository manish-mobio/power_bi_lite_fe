import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import UniversalLayout from '../../../src/components/layout/Layout';

jest.mock('../../../src/components/layout/Sidebar', () => () => (
  <div>Mocked Sidebar</div>
));
jest.mock('../../../src/components/layout/Header', () => ({ setCollapsed }) => (
  <div>
    <button onClick={() => setCollapsed(true)}>Toggle Collapse</button>
    Mocked Header
  </div>
));

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}));

describe('UniversalLayout Component', () => {
  it('renders the layout with sidebar and header', () => {
    render(
      <UniversalLayout pageTitle='Test Page Title'>
        <div>Child Content</div>
      </UniversalLayout>
    );

    expect(screen.getByText('Mocked Sidebar')).toBeInTheDocument();
    expect(screen.getByText('Mocked Header')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('toggles the collapsed state', () => {
    render(
      <UniversalLayout pageTitle='Test Page Title'>
        <div>Child Content</div>
      </UniversalLayout>
    );

    const toggleButton = screen.getByText('Toggle Collapse');
    fireEvent.click(toggleButton);
    expect(toggleButton).toBeInTheDocument();
  });
});
