import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import helpSource from '../../HELP.md?raw';

/**
 * Wrap each ## block (and content before the first ##) in a section for card-style layout.
 */
function wrapHelpSections(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;
  const wrapper = doc.createElement('div');
  let bucket = doc.createElement('div');
  bucket.className = 'help-section help-section-intro';

  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'H2') {
      if (bucket.childNodes.length) {
        wrapper.appendChild(bucket);
      }
      bucket = doc.createElement('section');
      bucket.className = 'help-section';
      bucket.appendChild(node.cloneNode(true));
    } else {
      bucket.appendChild(node.cloneNode(true));
    }
  }
  if (bucket.childNodes.length) {
    wrapper.appendChild(bucket);
  }
  return wrapper.innerHTML;
}

export default function Help() {
  const html = useMemo(() => {
    const raw = marked.parse(helpSource);
    const rawStr = typeof raw === 'string' ? raw : String(raw);
    const wrapped = wrapHelpSections(rawStr);
    return DOMPurify.sanitize(wrapped);
  }, [helpSource]);

  return (
    <div className="help-page w-full min-w-0 max-w-3xl mx-auto px-2 py-1">
      <article
        className="help-page-article prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-800 prose-a:text-indigo-700"
        data-testid="help-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
