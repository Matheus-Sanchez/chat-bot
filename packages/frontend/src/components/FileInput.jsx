import { useRef } from 'react';
import { Paperclip } from 'lucide-react';

const ACCEPTED_TEXT_FILES = [
  '.txt',
  '.md',
  '.json',
  '.csv',
  '.log',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.java',
  '.cs',
  '.html',
  '.css',
  '.xml',
  '.yaml',
  '.yml',
].join(',');

const ACCEPTED_IMAGE_FILES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
].join(',');

function FileInput({ disabled, onFileSelect }) {
  const fileInputRef = useRef(null);

  const openFilePicker = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={`${ACCEPTED_TEXT_FILES},${ACCEPTED_IMAGE_FILES}`}
        disabled={disabled}
        onChange={(event) => onFileSelect(event.target.files?.[0] || null)}
        hidden
      />
      <button
        className="composer-tool"
        type="button"
        onClick={openFilePicker}
        disabled={disabled}
        title="Anexar arquivo ou imagem"
        aria-label="Anexar arquivo ou imagem"
      >
        <Paperclip size={19} />
      </button>
    </>
  );
}

export default FileInput;
