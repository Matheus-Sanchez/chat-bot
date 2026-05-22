import DOMPurify from 'dompurify';
import { Remarkable } from 'remarkable';

const md = new Remarkable({
  html: false,
  linkTarget: '_blank',
});

function renderMarkdown(content) {
  return { __html: DOMPurify.sanitize(md.render(content)) };
}

function MessageBubble({ role, content }) {
  const isUser = role === 'user';

  if (!content && !isUser) {
    return (
      <div className="message-bubble bot">
        <div className="typing-indicator"><span></span></div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="message-bubble user">
        <div dangerouslySetInnerHTML={renderMarkdown(content)} />
      </div>
    );
  }

  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  const thoughts = [];
  
  const finalContent = content.replace(thinkRegex, (_, thoughtContent) => {
    thoughts.push(thoughtContent.trim());
    return '';
  }).trim();

  return (
    <div className="message-bubble bot">
      {thoughts.length > 0 && (
        <div className="thought-container">
          {thoughts.map((thought, index) => (
            <div key={index} className="thought-content">
              {thought}
            </div>
          ))}
        </div>
      )}

      {finalContent && (
        <div
          className="final-response"
          dangerouslySetInnerHTML={renderMarkdown(finalContent)}
        />
      )}
    </div>
  );
}

export default MessageBubble;
