import { describe, expect, it } from 'vitest';
import { formatSftpUploadError } from '../hooks/useSftpDragDrop';

describe('SFTP Drag Drop Error Mapping', () => {
  it('normalizes expired-session upload errors', () => {
    expect(formatSftpUploadError(new Error('SFTP Session not found: sftp-pane-1'), '/tmp/hello.txt'))
      .toBe('SFTP session expired. Please reconnect and try again.');
  });

  it('maps permission errors to the target path', () => {
    expect(formatSftpUploadError(new Error('Permission denied'), '/srv/app/config.yml'))
      .toBe('Permission denied: Cannot upload to /srv/app/config.yml. Check server permissions.');
  });

  it('falls back to the shared remote-file formatter for generic failures', () => {
    expect(formatSftpUploadError(new Error('remote file is not valid UTF-8 text'), '/tmp/file.txt'))
      .toBe('SFTP upload failed: the selected file is not UTF-8 text.');
  });
});
