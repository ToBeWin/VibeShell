import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REMOTE_FILE_PROTOCOLS,
  remoteFilesConnect,
} from '../lib/tauri';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  Channel: class {
    onmessage = vi.fn();
  },
}));

describe('Remote File Protocol Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should expose only the supported remote file protocols', () => {
    expect(REMOTE_FILE_PROTOCOLS).toEqual(['sftp']);
  });

  it('should invoke SFTP remote file connect with SSH key material when provided', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(undefined);
    (await import('@tauri-apps/api/core')).invoke = mockInvoke;

    await remoteFilesConnect(
      'sftp',
      'sftp-pane-1',
      'sftp.example.com',
      22,
      'root',
      '',
      'PRIVATE KEY',
      'passphrase'
    );

    expect(mockInvoke).toHaveBeenCalledWith('remote_files_connect', {
      protocol: 'sftp',
      sessionId: 'sftp-pane-1',
      host: 'sftp.example.com',
      port: 22,
      user: 'root',
      password: '',
      privateKey: 'PRIVATE KEY',
      privateKeyPassphrase: 'passphrase',
    });
  });
});
