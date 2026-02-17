// ReduxProvider.test.js
import React from 'react';
import { render, screen } from '@testing-library/react';
import ReduxProvider from '../../src/store/ReduxProvider';
import '@testing-library/jest-dom'; // Import this to use the toBeInTheDocument matcher

describe('ReduxProvider Component', () => {
  it('renders children with the Redux store', () => {
    const ChildComponent = () => <div>Child Component</div>;

    render(
      <ReduxProvider>
        <ChildComponent />
      </ReduxProvider>
    );

    expect(screen.getByText('Child Component')).toBeInTheDocument();
  });
});
