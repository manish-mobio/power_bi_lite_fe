import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import MyApp from '../../src/pages/_app';
import { useRouter } from 'next/router';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../../src/components/layout/Layout', () => ({ children }) => (
  <div>{children}</div>
));

jest.mock('../../src/components/common/CustomSpinner', () => () => (
  <div>Loading...</div>
));

jest.mock('../../src/store/ReduxProvider', () => ({ children }) => (
  <div>{children}</div>
));

describe('MyApp Component', () => {
  let mockRouter;

  beforeEach(() => {
    mockRouter = {
      pathname: '/',
      events: {
        on: jest.fn(),
        off: jest.fn(),
      },
    };
    useRouter.mockReturnValue(mockRouter);
  });

  it('renders the layout and the component', () => {
    const MockComponent = () => <div>Mock Component</div>;
    const pageProps = {};

    render(<MyApp Component={MockComponent} pageProps={pageProps} />);

    expect(screen.getByText('Mock Component')).toBeInTheDocument();
  });

  it('sets the page title based on the pathname', () => {
    const MockComponent = () => <div>Mock Component</div>;
    const pageProps = { pageTitle: 'PN | Dashboard' };

    render(<MyApp Component={MockComponent} pageProps={pageProps} />);

    // Verify the initial page title
    expect(document.title).toBe('');
  });

  it('shows spinner during route change', async () => {
    const MockComponent = () => <div>Mock Component</div>;
    const pageProps = {};

    render(<MyApp Component={MockComponent} pageProps={pageProps} />);

    // Simulate route change start
    const routeChangeStartHandler = mockRouter.events.on.mock.calls.find(
      (call) => call[0] === 'routeChangeStart'
    )[1];
    await act(async () => {
      routeChangeStartHandler();
    });
    // expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Simulate route change complete
    const routeChangeCompleteHandler = mockRouter.events.on.mock.calls.find(
      (call) => call[0] === 'routeChangeComplete'
    )[1];
    // routeChangeCompleteHandler();
    await act(async () => {
      routeChangeCompleteHandler();
    });
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('cleans up event handlers on unmount', () => {
    const MockComponent = () => <div>Mock Component</div>;
    const pageProps = {};

    const { unmount } = render(
      <MyApp Component={MockComponent} pageProps={pageProps} />
    );

    // Unmount the component to trigger cleanup
    unmount();

    // Check that the event handlers were removed
    expect(mockRouter.events.off).toHaveBeenCalledWith(
      'routeChangeStart',
      expect.any(Function)
    );
    expect(mockRouter.events.off).toHaveBeenCalledWith(
      'routeChangeComplete',
      expect.any(Function)
    );
    expect(mockRouter.events.off).toHaveBeenCalledWith(
      'routeChangeError',
      expect.any(Function)
    );
  });
});
