'use client';

import type { GraphiQLPlugin } from '@graphiql/react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useState, type FC } from 'react';
import { usePlaygroundContext } from './PlaygroundContext';

function useTheme() {
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('vs-dark');

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'vs-dark' : 'light');
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

const SchemaPluginContent: FC = () => {
  const { schemaSDL } = usePlaygroundContext();
  const theme = useTheme();

  if (!schemaSDL) {
    return (
      <div className="graphiql-plugin-content" style={{ height: '100%' }}>
        <p
          style={{
            padding: 'var(--px-16)',
            color: 'hsla(var(--color-neutral), var(--alpha-secondary))',
          }}
        >
          Compiling schema...
        </p>
      </div>
    );
  }

  return (
    <div className="graphiql-plugin-content" style={{ height: '100%' }}>
      <Editor
        height="100%"
        language="graphql"
        value={schemaSDL}
        theme={theme}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          folding: true,
          renderLineHighlight: 'none',
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
};

const SchemaIcon: FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

export const schemaPlugin: GraphiQLPlugin = {
  title: 'Schema SDL',
  icon: SchemaIcon,
  content: SchemaPluginContent,
};

const SourcePluginContent: FC = () => {
  const { source, onSourceChange, readOnly } = usePlaygroundContext();
  const monaco = useMonaco();
  const [typesLoaded, setTypesLoaded] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    if (monaco && !typesLoaded) {
      import('../../lib/playground/setup-monaco').then(({ setupMonacoForPothos }) => {
        setupMonacoForPothos(monaco);
        setTypesLoaded(true);
      });
    }
  }, [monaco, typesLoaded]);

  return (
    <div
      className="graphiql-plugin-content"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div
        style={{
          padding: 'var(--px-8) var(--px-16)',
          borderBottom: '1px solid hsla(var(--color-neutral), var(--alpha-background-heavy))',
          fontSize: 'var(--font-size-hint)',
          color: 'hsla(var(--color-neutral), var(--alpha-secondary))',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--px-8)',
        }}
      >
        <span>schema.ts</span>
        {!readOnly && <span style={{ opacity: 0.6 }}>(editable)</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language="typescript"
          path="file:///playground/schema.ts"
          value={source}
          theme={theme}
          onChange={(value) => {
            if (value !== undefined && onSourceChange) {
              onSourceChange(value);
            }
          }}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            folding: true,
            renderLineHighlight: 'line',
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            padding: { top: 12, bottom: 12 },
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
          }}
        />
      </div>
    </div>
  );
};

const SourceIcon: FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

export const sourcePlugin: GraphiQLPlugin = {
  title: 'Source Code',
  icon: SourceIcon,
  content: SourcePluginContent,
};

export const playgroundPlugins: GraphiQLPlugin[] = [sourcePlugin, schemaPlugin];
