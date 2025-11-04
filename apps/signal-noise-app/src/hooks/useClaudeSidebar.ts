'use client';

import { useCallback, useEffect, useState } from 'react';

export function useClaudeSidebar() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
    // Trigger a custom event that the toggle button can listen to
    window.dispatchEvent(new CustomEvent('open-claude-sidebar'));
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Trigger a custom event that the toggle button can listen to
    window.dispatchEvent(new CustomEvent('close-claude-sidebar'));
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
    // Trigger a custom event that the toggle button can listen to
    window.dispatchEvent(new CustomEvent('toggle-claude-sidebar'));
  }, []);

  // Listen for keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        const activeElement = document.activeElement;
        const isInputField = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).contentEditable === 'true'
        );
        
        if (!isInputField) {
          e.preventDefault();
          toggle();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [toggle]);

  return {
    isOpen,
    open,
    close,
    toggle
  };
}