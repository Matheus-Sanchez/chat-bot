import React, { useRef } from 'react';

/**
 * Componente para lidar com a seleção e remoção de ficheiros.
 */
function FileInput({ selectedFile, onFileChange, onFileRemove }) {
  const fileInputRef = useRef(null);

  return (
    <>
      {selectedFile && (
        <div className="text-sm text-slate-600 mb-2 px-1 flex justify-between items-center">
          <span>Anexado: <strong>{selectedFile.name}</strong></span>
          <button onClick={onFileRemove} className="font-bold text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}
      <button
        type="button"
        onClick={() => fileInputRef.current.click()}
        className="p-3 border border-slate-300 rounded-lg hover:bg-slate-100 transition"
        title="Anexar ficheiro"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        className="hidden"
      />
    </>
  );
}

export default FileInput;
