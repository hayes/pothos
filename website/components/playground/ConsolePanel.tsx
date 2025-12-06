'use client';

import type { ConsoleMessage } from '../../lib/playground/use-playground-compiler';

interface ConsolePanelProps {
  messages: ConsoleMessage[];
}

export function ConsolePanel({ messages }: ConsolePanelProps) {
  /**
   * Format a value for console display with proper handling of special types
   * and circular references
   */
  const formatValue = (value: unknown): string => {
    // Primitives
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
    if (typeof value === 'bigint') {
      return `${value}n`;
    }
    if (typeof value === 'symbol') {
      return value.toString();
    }
    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }

    // Special objects
    if (value instanceof Error) {
      return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (value instanceof RegExp) {
      return value.toString();
    }
    if (value instanceof Map) {
      return `Map(${value.size}) ${JSON.stringify(Array.from(value.entries()))}`;
    }
    if (value instanceof Set) {
      return `Set(${value.size}) ${JSON.stringify(Array.from(value))}`;
    }

    // Complex objects - handle circular references
    try {
      const seen = new WeakSet();
      return JSON.stringify(
        value,
        (_key, val) => {
          // Handle circular references
          if (typeof val === 'object' && val !== null) {
            if (seen.has(val)) {
              return '[Circular]';
            }
            seen.add(val);
          }
          // Handle special types in nested objects
          if (val instanceof Error) {
            return `[Error: ${val.message}]`;
          }
          if (val instanceof Date) {
            return val.toISOString();
          }
          if (val instanceof RegExp) {
            return val.toString();
          }
          if (typeof val === 'bigint') {
            return `${val}n`;
          }
          if (typeof val === 'symbol') {
            return val.toString();
          }
          if (typeof val === 'function') {
            return `[Function: ${val.name || 'anonymous'}]`;
          }
          return val;
        },
        2,
      );
    } catch (err) {
      console.warn('[ConsolePanel] Failed to stringify value:', err);
      // Fallback to Object.prototype.toString for better output than [object Object]
      return Object.prototype.toString.call(value);
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
