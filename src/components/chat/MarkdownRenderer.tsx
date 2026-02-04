'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useThemeStore, getEffectiveTheme } from '@/stores/themeStore';
import { useState, useCallback } from 'react';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface CodeProps {
  node?: unknown;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
      aria-label="Copy code"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const { theme } = useThemeStore();
  const isDark = getEffectiveTheme(theme) === 'dark';

  const components: Components = {
    // Code blocks and inline code
    code({ inline, className: codeClassName, children, ...props }: CodeProps) {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const language = match ? match[1] : '';
      const codeString = String(children).replace(/\n$/, '');

      if (!inline && (match || codeString.includes('\n'))) {
        return (
          <div className="relative group my-4">
            {language && (
              <div className="absolute top-0 left-0 px-2 py-1 text-xs text-gray-400 bg-gray-800 rounded-tl rounded-br">
                {language}
              </div>
            )}
            <CopyButton text={codeString} />
            <SyntaxHighlighter
              style={isDark ? oneDark : oneLight}
              language={language || 'text'}
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: '0.5rem',
                paddingTop: language ? '2rem' : '1rem',
              }}
              {...props}
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        );
      }

      // Inline code
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-red-600 dark:text-red-400 text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    },

    // Headers
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-white">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-bold mt-3 mb-2 text-gray-900 dark:text-white">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="text-sm font-bold mt-3 mb-1 text-gray-900 dark:text-white">
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className="text-sm font-semibold mt-3 mb-1 text-gray-700 dark:text-gray-300">
        {children}
      </h6>
    ),

    // Paragraphs
    p: ({ children }) => (
      <p className="my-2 leading-relaxed">{children}</p>
    ),

    // Lists
    ul: ({ children }) => (
      <ul className="list-disc list-inside my-2 space-y-1 ml-2">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside my-2 space-y-1 ml-2">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed">{children}</li>
    ),

    // Blockquote
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-blue-500 dark:border-blue-400 pl-4 my-4 italic text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 py-2 rounded-r">
        {children}
      </blockquote>
    ),

    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        {children}
      </a>
    ),

    // Images
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt || ''}
        className="max-w-full h-auto rounded-lg my-4"
        loading="lazy"
      />
    ),

    // Tables
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-100 dark:bg-gray-700">{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr className="border-b border-gray-300 dark:border-gray-600">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
        {children}
      </td>
    ),

    // Horizontal rule
    hr: () => (
      <hr className="my-6 border-gray-300 dark:border-gray-600" />
    ),

    // Strong (bold)
    strong: ({ children }) => (
      <strong className="font-bold text-gray-900 dark:text-white">{children}</strong>
    ),

    // Emphasis (italic)
    em: ({ children }) => (
      <em className="italic">{children}</em>
    ),

    // Strikethrough
    del: ({ children }) => (
      <del className="line-through text-gray-500">{children}</del>
    ),

    // Checkbox (task list)
    input: ({ type, checked, ...props }) => {
      if (type === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="mr-2 rounded"
            {...props}
          />
        );
      }
      return <input type={type} {...props} />;
    },
  };

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
