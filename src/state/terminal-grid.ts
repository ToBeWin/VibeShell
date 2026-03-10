import { useEffect, useState } from 'react';
import { PaneConfig, SplitDirection } from '../components/TerminalGrid';

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
      setPanes(availablePanes);
      setSplit(availablePanes.length > 1 ? prev => (prev === 'none' ? 'horizontal' : prev) : 'none');
    }
  }, [availablePanes]);

  useEffect(() => {
    if (activePaneId) {
      setActiveId(activePaneId);
    }
  }, [activePaneId]);

  useEffect(() => {
    setPanes(prev =>
      prev.map(pane =>
        pane.id === defaultPane.id
          ? {
              ...pane,
              connected: defaultPane.connected,
              sessionId: defaultPane.sessionId,
              sessionKey: defaultPane.sessionKey,
              label: defaultPane.label,
              host: defaultPane.host,
              user: defaultPane.user,
            }
          : pane
      )
    );
  }, [defaultPane]);

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
