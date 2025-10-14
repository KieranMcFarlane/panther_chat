'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@/styles/xterm.css';

interface TerminalComponentProps {
  onLog?: (log: any) => void;
  isPaused?: boolean;
}

export default function TerminalComponent({ onLog, isPaused = false }: TerminalComponentProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    const terminal = new Terminal({
      convertEol: true,
      rows: 30,
      cols: 120,
      fontFamily: '"Cascadia Code", "Fira Code", "SF Mono", monospace',
      fontSize: 13,
      allowTransparency: true,
      theme: {
        background: '#0a0a0a',
        foreground: '#e0e0e0',
        cursor: '#0ff',
        selection: '#fff3',
        black: '#000000',
        red: '#ff6b6b',
        green: '#51cf66',
        yellow: '#ffd43b',
        blue: '#339af0',
        magenta: '#ff6ec7',
        cyan: '#20c997',
        white: '#ffffff',
        brightBlack: '#495057',
        brightRed: '#ff8787',
        brightGreen: '#69db7c',
        brightYellow: '#ffe066',
        brightBlue: '#74c0fc',
        brightMagenta: '#f065ff',
        brightCyan: '#3bc9db',
        brightWhite: '#f1f3f5'
      }
    });

    // Add addons
    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();
    
    terminal.loadAddon(fit);
    terminal.loadAddon(webLinks);

    terminal.open(terminalRef.current);
    fit.fit();

    // Write welcome message immediately
    terminal.writeln('\x1b[32m🤖 Claude Agent Logs Terminal\x1b[0m');
    terminal.writeln('\x1b[36mInitializing...\x1b[0m');
    terminal.writeln('');

    // Store instances
    terminalInstance.current = terminal;
    fitAddon.current = fit;

    // Handle window resize
    const handleResize = () => {
      if (fitAddon.current && terminalInstance.current) {
        try {
          fitAddon.current.fit();
        } catch (error) {
          console.log('Terminal resize error:', error);
        }
      }
    };

    // Initial fit after a short delay
    setTimeout(handleResize, 100);

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, []);

  // Function to write to terminal
  const writeToTerminal = (message: string, color = '\x1b[0m') => {
    if (terminalInstance.current && !isPaused) {
      try {
        terminalInstance.current.writeln(`${color}${message}\x1b[0m`);
      } catch (error) {
        console.log('Terminal write error:', error);
      }
    }
  };

  // Function to clear terminal
  const clearTerminal = () => {
    if (terminalInstance.current) {
      try {
        terminalInstance.current.clear();
      } catch (error) {
        console.log('Terminal clear error:', error);
      }
    }
  };

  // Expose write function to parent
  useEffect(() => {
    if (onLog) {
      onLog({
        write: writeToTerminal,
        clear: clearTerminal,
        writeln: (msg: string, color?: string) => writeToTerminal(msg, color),
        writeRaw: (text: string) => {
          if (terminalInstance.current && !isPaused) {
            try {
              terminalInstance.current.write(text);
            } catch (error) {
              console.log('Terminal write error:', error);
            }
          }
        }
      });
    }
  }, [onLog, isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (terminalInstance.current) {
        try {
          terminalInstance.current.dispose();
        } catch (error) {
          console.log('Terminal dispose error:', error);
        }
      }
    };
  }, []);

  return (
    <div 
      ref={terminalRef} 
      className="h-full w-full"
      style={{ minHeight: '400px' }}
    />
  );
}