import React from 'react';

const PaperclipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
  </svg>
);

/**
 * Componente para lidar com a seleção e remoção de ficheiros.
 */
function FileInput({ onFileChange, disabled }) {
  const fileInputRef = React.useRef(null);

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
        <PaperclipIcon />
      </button>
    </>
  );
}

export default FileInput;
