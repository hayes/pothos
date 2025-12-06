'use client';

import type { ConsoleMessage } from '../../lib/playground/use-playground-compiler';

interface ConsolePanelProps {
  messages: ConsoleMessage[];
}

export function ConsolePanel({ messages }: ConsolePanelProps) {
  const formatValue = (value: unknown): string => {
    if (value === undefined) {
      return 'undefined';
    }
    if (value === null) {
      return 'null';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const getTypeColor = (type: ConsoleMessage['type']): string => {
    switch (type) {
      case 'error':
        return 'text-red-500';
      case 'warn':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-fd-foreground';
    }
  };

  const getTypeIcon = (type: ConsoleMessage['type']): string => {
    switch (type) {
      case 'error':
        return '✗';
      case 'warn':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '›';
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-fd-background p-2 font-mono text-xs">
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center text-fd-muted-foreground">
          No console output
        </div>
      ) : (
        <div className="space-y-1">
          {messages.map((message) => (
            <div
              key={`${message.timestamp}-${message.type}-${message.args[0]}`}
              className={`flex gap-2 py-1 ${getTypeColor(message.type)}`}
            >
              <span className="shrink-0">{getTypeIcon(message.type)}</span>
              <div className="flex-1 wrap-break-word">
                {message.args.map((arg, argIndex) => (
                  <span key={`${message.timestamp}-arg-${argIndex}`}>
                    {argIndex > 0 && ' '}
                    {formatValue(arg)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
