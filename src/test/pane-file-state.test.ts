import { describe, expect, it } from 'vitest';
import { createDefaultPaneFileSnapshot } from '../state/files';

describe('Pane File State', () => {
  it('creates a fully cleared snapshot for the default protocol', () => {
    expect(createDefaultPaneFileSnapshot()).toEqual({
      sessionId: null,
      list: [],
      path: '/',
      loading: false,
      error: '',
      protocol: 'sftp',
      openFilePath: null,
      openFileContent: '',
      dirty: false,
      saving: false,
      transferRunning: false,
    });
  });

  it('preserves the requested protocol while clearing transient file state', () => {
    expect(createDefaultPaneFileSnapshot('sftp')).toMatchObject({
      protocol: 'sftp',
      sessionId: null,
      loading: false,
      saving: false,
      transferRunning: false,
      openFilePath: null,
      openFileContent: '',
    });
  });
});
