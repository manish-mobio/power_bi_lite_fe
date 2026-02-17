import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CustomSpinner from '../../../src/components/common/CustomSpinner';

describe('CustomSpinner Component', () => {
  it('renders the spinner with the correct class and fullscreen prop', () => {
    render(<CustomSpinner />);

    // Find the Spin component by its role (if applicable) or by class
    const spinElement = document.querySelector('.custom-spinner-style-gloabl');

    // Ensure the spinElement exists and has the correct attributes
    expect(spinElement).toBeInTheDocument();
    // expect(spinElement).toHaveAttribute('spinning', 'true');
    // Check if the spinElement is fullscreen
    const { width, height, top, left } = getComputedStyle(spinElement);
    expect(width).toBe('100vw');
    expect(height).toBe('100vh');
    expect(top).toBe('');
    expect(left).toBe('');
  });
});
