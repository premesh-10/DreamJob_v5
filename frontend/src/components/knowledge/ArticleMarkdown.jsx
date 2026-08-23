import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

function ArticleMarkdown({ content }) {
    return (
        <div className="article-prose">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Headings
                    h1: ({ children }) => <h1 className="text-3xl font-bold text-slate-900 mt-8 mb-4 leading-tight" id={toId(children)}>{children}</h1>,
                    h2: ({ children }) => <h2 className="text-2xl font-bold text-slate-900 mt-7 mb-3 leading-tight" id={toId(children)}>{children}</h2>,
                    h3: ({ children }) => <h3 className="text-xl font-semibold text-slate-800 mt-6 mb-3" id={toId(children)}>{children}</h3>,
                    h4: ({ children }) => <h4 className="text-lg font-semibold text-slate-800 mt-5 mb-2" id={toId(children)}>{children}</h4>,
                    // Paragraph
                    p: ({ children }) => <p className="text-slate-700 leading-relaxed text-[16px] mb-4">{children}</p>,
                    // Strong / em
                    strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                    em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
                    // Links
                    a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700 underline underline-offset-2 font-medium transition-colors">
                            {children}
                        </a>
                    ),
                    // Lists
                    ul: ({ children }) => <ul className="list-disc list-outside pl-6 space-y-1.5 mb-4 text-slate-700">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside pl-6 space-y-1.5 mb-4 text-slate-700">{children}</ol>,
                    li: ({ children }) => <li className="text-[16px] leading-relaxed">{children}</li>,
                    // Blockquote
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-primary-400 pl-5 py-1 my-5 bg-primary-50/50 rounded-r-lg">
                            <div className="text-slate-600 italic text-[15px]">{children}</div>
                        </blockquote>
                    ),
                    // Code block
                    code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const lang = match ? match[1] : '';
                        if (!inline && lang) {
                            return (
                                <div className="my-5 rounded-xl overflow-hidden border border-slate-700 shadow-lg">
                                    <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
                                        <span className="text-xs font-mono text-slate-400 font-medium">{lang}</span>
                                        <CopyButton code={String(children).replace(/\n$/, '')} />
                                    </div>
                                    <SyntaxHighlighter
                                        language={lang}
                                        style={oneDark}
                                        customStyle={{ margin: 0, borderRadius: 0, fontSize: '13.5px', padding: '1.25rem' }}
                                        showLineNumbers={String(children).split('\n').length > 5}
                                        wrapLongLines
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                </div>
                            );
                        }
                        if (!inline) {
                            return (
                                <div className="my-5 rounded-xl overflow-hidden border border-slate-700">
                                    <SyntaxHighlighter
                                        style={oneDark}
                                        customStyle={{ margin: 0, fontSize: '13.5px', padding: '1.25rem' }}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                </div>
                            );
                        }
                        return (
                            <code className="px-1.5 py-0.5 bg-slate-100 text-primary-700 rounded-md text-[13.5px] font-mono border border-slate-200" {...props}>
                                {children}
                            </code>
                        );
                    },
                    // Horizontal rule
                    hr: () => <hr className="border-0 border-t border-slate-200 my-8" />,
                    // Tables
                    table: ({ children }) => (
                        <div className="my-5 overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                            <table className="w-full text-[14.5px] text-left">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
                    tbody: ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
                    tr: ({ children }) => <tr className="hover:bg-slate-50 transition-colors">{children}</tr>,
                    th: ({ children }) => <th className="px-4 py-3 font-semibold text-slate-700">{children}</th>,
                    td: ({ children }) => <td className="px-4 py-3 text-slate-600">{children}</td>,
                    // Images
                    img: ({ src, alt }) => (
                        <span className="block my-6">
                            <img src={src} alt={alt} className="rounded-xl max-w-full mx-auto shadow-md border border-slate-100" loading="lazy" />
                            {alt && <span className="block text-center text-xs text-slate-400 mt-2 italic">{alt}</span>}
                        </span>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

// Convert heading text to a slug id for anchor links
function toId(children) {
    const text = Array.isArray(children)
        ? children.map(c => (typeof c === 'string' ? c : '')).join('')
        : String(children || '');
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function CopyButton({ code }) {
    const [copied, setCopied] = React.useState(false);
    const copy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button onClick={copy} className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded">
            {copied ? 'Copied!' : 'Copy'}
        </button>
    );
}

import React from 'react';
export default ArticleMarkdown;
