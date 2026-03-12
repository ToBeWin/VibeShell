import { describe, expect, it } from 'vitest';
import { formatRemoteFileError } from '../state/file-actions';

describe('Remote File Error Formatting', () => {
  it('maps auth failures to an actionable message', () => {
    expect(formatRemoteFileError('ftp', 'connection', new Error('FTP Login failed: 530 Login incorrect.')))
      .toBe('FTP connection failed: authentication was rejected. Check username, password, or key settings.');
  });

  it('maps host key failures for sftp', () => {
    expect(formatRemoteFileError('sftp', 'connection', new Error('Failed to receive host key during SSH handshake')))
      .toBe('SFTP connection failed: host key verification did not complete. Trust the host key and retry.');
  });

  it('maps missing text decode errors cleanly', () => {
    expect(formatRemoteFileError('ftp', 'navigation', new Error('FTP READ failed: remote file is not valid UTF-8 text')))
      .toBe('FTP navigation failed: the selected file is not UTF-8 text.');
  });

  it('explains ftp connection timeouts as an unavailable ftp service', () => {
    expect(formatRemoteFileError('ftp', 'connection', new Error('operation timed out')))
      .toBe('FTP connection failed: the server did not respond on the FTP service port. Verify that FTP is enabled and the port is reachable.');
  });
});
