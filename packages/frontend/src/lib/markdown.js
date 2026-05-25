import createDOMPurify from 'dompurify';
import { Remarkable } from 'remarkable';

const DOMPurify = createDOMPurify(window);

const md = new Remarkable({
  html: false,
  breaks: true,
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function linkifyBareUrls(content) {
  let insideFence = false;

  return content.split('\n').map((line) => {
    if (line.trimStart().startsWith('```')) {
      insideFence = !insideFence;
      return line;
    }

    if (insideFence || /\[[^\]]+\]\([^)]+\)/.test(line)) {
      return line;
    }

    return line.replace(/(^|[\s([{"'])((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,!?;:'")\]}])/g, (_, prefix, url) => {
      const href = url.startsWith('www.') ? `https://${url}` : url;
      return `${prefix}[${url}](${href})`;
    });
  }).join('\n');
}

export function renderMarkdown(content) {
  const html = md.render(linkifyBareUrls(content || ''));
  return { __html: DOMPurify.sanitize(html) };
}
