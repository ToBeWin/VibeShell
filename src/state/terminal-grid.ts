import { useEffect, useState } from 'react';
import { PaneConfig, SplitDirection } from '../components/TerminalGrid';

function arePaneListsEqual(left: PaneConfig[], right: PaneConfig[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((pane, index) => {
    const other = right[index];
    return (
      pane.id === other.id &&
      pane.serverId === other.serverId &&
      pane.sessionId === other.sessionId &&
      pane.sessionKey === other.sessionKey &&
      pane.label === other.label &&
      pane.host === other.host &&
      pane.user === other.user &&
      pane.connected === other.connected &&
      pane.connecting === other.connecting
    );
  });
}

interface UseTerminalGridStateOptions {
  defaultPane: PaneConfig;
  availablePanes?: PaneConfig[];
  activePaneId?: string;
  onActivePaneChange?: (paneId: string) => void;
  onCreatePane?: (direction: SplitDirection) => void;
  onRemovePane?: (paneId: string) => void;
}

export function useTerminalGridState({
  defaultPane,
  availablePanes,
  activePaneId,
  onActivePaneChange,
  onCreatePane,
  onRemovePane,
}: UseTerminalGridStateOptions) {
  const [panes, setPanes] = useState<PaneConfig[]>(
    availablePanes && availablePanes.length > 0 ? availablePanes : [defaultPane]
  );
  const [split, setSplit] = useState<SplitDirection>('none');
  const [activeId, setActiveId] = useState(activePaneId ?? defaultPane.id);

  useEffect(() => {
    if (availablePanes && availablePanes.length > 0) {
      setPanes(prev => (arePaneListsEqual(prev, availablePanes) ? prev : availablePanes));
      setSplit(availablePanes.length > 1 ? prev => (prev === 'none' ? 'horizontal' : prev) : 'none');
    }
  }, [availablePanes]);

  useEffect(() => {
    if (activePaneId) {
      setActiveId(activePaneId);
    }
  }, [activePaneId]);

  useEffect(() => {
    setPanes(prev => {
      let changed = false;
      const next = prev.map(pane => {
        if (pane.id !== defaultPane.id) {
          return pane;
        }

        const updatedPane = {
          ...pane,
          serverId: defaultPane.serverId,
          connected: defaultPane.connected,
          connecting: defaultPane.connecting,
          sessionId: defaultPane.sessionId,
          sessionKey: defaultPane.sessionKey,
          label: defaultPane.label,
          host: defaultPane.host,
          user: defaultPane.user,
        };

        const paneChanged =
          pane.serverId !== updatedPane.serverId ||
          pane.connected !== updatedPane.connected ||
          pane.connecting !== updatedPane.connecting ||
          pane.sessionId !== updatedPane.sessionId ||
          pane.sessionKey !== updatedPane.sessionKey ||
          pane.label !== updatedPane.label ||
          pane.host !== updatedPane.host ||
          pane.user !== updatedPane.user;

        if (paneChanged) {
          changed = true;
          return updatedPane;
        }

        return pane;
      });

      return changed ? next : prev;
    });
  }, [
    defaultPane.connected,
    defaultPane.connecting,
    defaultPane.host,
    defaultPane.id,
    defaultPane.label,
    defaultPane.serverId,
    defaultPane.sessionId,
    defaultPane.sessionKey,
    defaultPane.user,
  ]);

  const addPane = (direction: SplitDirection) => {
    if (onCreatePane) {
      onCreatePane(direction);
      if (split === 'none') setSplit(direction);
      return;
    }

    const id = `pane-${Date.now()}`;
    const newPane: PaneConfig = {
      ...defaultPane,
      id,
      label: `${defaultPane.user}@${defaultPane.host}`,
    };
    setPanes(prev => [...prev, newPane]);
    setSplit(direction);
    setActiveId(id);
    onActivePaneChange?.(id);
  };

  const removePane = (id: string) => {
    onRemovePane?.(id);
    setPanes(prev => {
      const next = prev.filter(pane => pane.id !== id);
      if (next.length === 1) setSplit('none');
      if (activeId === id) {
        const nextId = next[0]?.id ?? '';
        setActiveId(nextId);
        onActivePaneChange?.(nextId);
      }
      return next;
    });
  };

  const activatePane = (paneId: string) => {
    setActiveId(paneId);
    onActivePaneChange?.(paneId);
  };

  return {
    panes,
    split,
    activeId,
    addPane,
    removePane,
    activatePane,
  };
}
