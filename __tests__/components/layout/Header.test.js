import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppHeader from '../../../src/components/layout/Header';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('AppHeader Component', () => {
  let setCollapsedMock;

  beforeEach(() => {
    setCollapsedMock = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the AppHeader component with correct elements', () => {
    render(<AppHeader collapsed={false} setCollapsed={setCollapsedMock} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Power BI Lite')).toBeInTheDocument();
  });

  it('toggles the collapsed state when the button is clicked', () => {
    render(<AppHeader collapsed={false} setCollapsed={setCollapsedMock} />);
    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);
    expect(setCollapsedMock).toHaveBeenCalledWith(true);
  });
});
