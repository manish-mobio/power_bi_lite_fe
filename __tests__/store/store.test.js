// store.test.js
import store from '../../src/store/store';
import { loginSuccess, logout } from '../../src/store/reducers/authReducer';

describe('Redux Store', () => {
  it('should configure the store with the rootReducer', () => {
    const initialState = store.getState();
    expect(initialState).toEqual({
      auth: {
        isLoggedIn: false,
        user: null,
        error: null,
        loading: false,
      },
    });
  });

  it('should handle loginSuccess action', () => {
    store.dispatch(loginSuccess());

    const state = store.getState();
    expect(state.auth).toEqual({
      isLoggedIn: true,
      user: null,
      error: null,
      loading: false,
    });
  });

  it('should handle logoutSuccess action', () => {
    // Ensure user is logged in first
    store.dispatch(loginSuccess({ id: 1, name: 'Test User' }));

    // Dispatch logout action
    store.dispatch(logout());

    const state = store.getState();
    expect(state.auth).toEqual({
      isLoggedIn: false,
      user: null,
      error: null,
      loading: false,
    });
  });
});
