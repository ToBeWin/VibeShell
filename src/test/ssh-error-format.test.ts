import { describe, expect, it } from 'vitest';
import { formatSshConnectionError } from '../state/ssh-errors';

describe('SSH Error Formatting', () => {
  it('maps authentication errors to a guided message', () => {
    expect(formatSshConnectionError(new Error('Authentication rejected')))
      .toBe('Authentication was rejected. Check the username, password, or private key settings.');
  });

  it('maps network failures to a connectivity message', () => {
    expect(formatSshConnectionError(new Error('Connection failed: Connection refused')))
      .toBe('The server could not be reached. Check the host, port, and network connectivity.');
  });

  it('preserves unknown messages when no better mapping exists', () => {
    expect(formatSshConnectionError(new Error('Channel open failed: administratively prohibited')))
      .toBe('Channel open failed: administratively prohibited');
  });
});
