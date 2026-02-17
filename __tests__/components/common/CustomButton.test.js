import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CustomButton from '../../../src/components/common/CustomButton';

// Mock antd Button to ensure proper testing without relying on its implementation
jest.mock('antd', () => ({
  Button: jest.fn((props) => (
    <button {...props} onClick={props.onClick}>
      {props.iconPosition === 'start' && props.icon}
      {props.children}
      {props.iconPosition === 'end' && props.icon}
    </button>
  )),
}));

describe('CustomButton Component', () => {
  it('renders with default props', () => {
    const buttonText = 'Click Me';
    render(<CustomButton buttonText={buttonText} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent(buttonText);
    expect(button).toHaveClass('btn-primary');
    expect(button).toBeEnabled();
  });

  it('applies given props correctly', () => {
    const buttonText = 'Submit';
    const className = 'custom-class';
    const onClick = jest.fn();

    render(
      <CustomButton
        size='large'
        type='primary'
        className={className}
        disabled={true}
        onClick={onClick}
        buttonText={buttonText}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent(buttonText);
    expect(button).toHaveClass(className);
    expect(button).toBeDisabled();
  });

  it('renders with icon correctly', () => {
    const buttonText = 'Upload';
    const icon = <span data-testid='icon'>Icon</span>;

    render(<CustomButton icon={icon} buttonText={buttonText} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent(buttonText);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders icon in the correct position', () => {
    const buttonText = 'Upload';
    const icon = <span data-testid='icon'>Icon</span>;

    render(
      <CustomButton icon={icon} buttonText={buttonText} iconPosition='end' />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent(buttonText);
    expect(button.firstChild).not.toBe(screen.getByTestId('icon'));
    expect(button.lastChild).toBe(screen.getByTestId('icon'));
  });

  it('handles click events', () => {
    const buttonText = 'Click Me';
    const onClick = jest.fn();

    render(<CustomButton buttonText={buttonText} onClick={onClick} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
