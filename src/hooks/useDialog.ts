import { useState, useCallback } from 'react';
import type { DialogButton } from '../components/ConfirmDialog';

interface DialogState {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: DialogButton[];
}

export function useDialog() {
  const [state, setState] = useState<DialogState>({ visible: false, title: '' });

  const showDialog = useCallback(
    (title: string, message?: string, buttons?: DialogButton[]) => {
      setState({ visible: true, title, message, buttons });
    },
    [],
  );

  const dismiss = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  const wrapButtons = (buttons?: DialogButton[]): DialogButton[] | undefined => {
    if (!buttons) return undefined;
    return buttons.map((btn) => ({
      ...btn,
      onPress: () => {
        dismiss();
        btn.onPress?.();
      },
    }));
  };

  return {
    showDialog,
    dialogProps: {
      visible: state.visible,
      title: state.title,
      message: state.message,
      buttons: wrapButtons(state.buttons),
      onDismiss: dismiss,
    },
  };
}
