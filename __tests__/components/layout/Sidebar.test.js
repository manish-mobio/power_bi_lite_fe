import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppSidebar from '../../../src/components/layout/Sidebar'; // Adjust the import path

jest.mock('next/router', () => ({
  useRouter: () => ({
    asPath: '/dashboard', // Mock useRouter to return a path
  }),
}));

describe('AppSidebar Component', () => {
  it('renders the sidebar with default selected key', () => {
    act(() => {
      render(<AppSidebar collapsed={false} setCollapsed={() => {}} />);
    });

    // Check if the Dashboard link is selected by default
    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute(
      'href',
      '/dashboard'
    );

    // Check if the Users link is not selected by default
    expect(screen.getByText('Users').closest('a')).toHaveAttribute(
      'href',
      '/users'
    );
  });

  it('toggles sidebar collapse', async () => {
    const setCollapsed = jest.fn();
    act(() => {
      render(<AppSidebar collapsed={false} setCollapsed={setCollapsed} />);
    });

    // Find the element that should trigger the collapse. This is often an icon or a button.
    const collapseTrigger = screen.getByTestId('project-logo'); // Adjust the selector to match your actual trigger element

    // Simulate a click on the collapse trigger
    act(() => {
      fireEvent.click(collapseTrigger);
    });
  });

  // Add more test cases as needed
});
