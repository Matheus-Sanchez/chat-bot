import { useRef } from 'react';
import { Paperclip } from 'lucide-react';

function FileInput({ onFileChange, disabled }) {
  const fileInputRef = useRef(null);

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Permite selecionar o mesmo arquivo novamente
    }
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        accept=".txt,.md,.json,.csv,.log,.js,.jsx,.ts,.tsx,.py,.java,.cs,.html,.css,.xml,.yaml,.yml"
        style={{ display: 'none' }}
        disabled={disabled}
      />
      <button 
        onClick={handleButtonClick} 
        className="file-attach-button" 
        type="button" 
        disabled={disabled} 
        title="Anexar arquivo"
      >
        <Paperclip size={20} />
      </button>
    </>
  );
}

export default FileInput;
