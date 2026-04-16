import { useState, useCallback } from 'react';
import { Upload, FileArchive, X } from 'lucide-react';

export default function DropZone({ onFileSelected, disabled }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      alert('Please upload a .zip GTFS feed file.');
      return;
    }
    setSelectedFile(file);
    onFileSelected(file);
  }, [onFileSelected]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e) => handleFile(e.target.files[0]);

  const clearFile = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
  };

  return (
    <div
      id="dropzone-area"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      style={{
        position: 'relative',
        border: `2px dashed ${isDragging ? 'oklch(0.623 0.214 259.815)' : 'oklch(1 0 0 / 15%)'}`,
        borderRadius: 'var(--radius)',
        padding: '3rem 2rem',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        background: isDragging
          ? 'linear-gradient(135deg, oklch(0.623 0.214 259.815 / 10%), oklch(0.623 0.214 259.815 / 5%))'
          : 'linear-gradient(135deg, oklch(1 0 0 / 4%), oklch(1 0 0 / 1%))',
        opacity: disabled ? 0.5 : 1,
        animation: isDragging ? 'pulse-glow 1.5s ease infinite' : 'none',
      }}
      onClick={() => !disabled && !selectedFile && document.getElementById('gtfs-file-input').click()}
    >
      <input
        id="gtfs-file-input"
        type="file"
        accept=".zip"
        style={{ display: 'none' }}
        onChange={onInputChange}
        disabled={disabled}
      />

      {selectedFile ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, oklch(0.723 0.219 149.579 / 20%), oklch(0.723 0.219 149.579 / 10%))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid oklch(0.723 0.219 149.579 / 30%)',
          }}>
            <FileArchive size={26} style={{ color: 'oklch(0.723 0.219 149.579)' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--foreground)' }}>{selectedFile.name}</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          {!disabled && (
            <button
              onClick={clearFile}
              style={{
                background: 'oklch(0.396 0.141 25.768 / 20%)',
                border: '1px solid oklch(0.396 0.141 25.768 / 40%)',
                borderRadius: '0.5rem',
                padding: '0.35rem 0.85rem',
                color: 'oklch(0.637 0.237 25.331)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                fontSize: '0.8rem',
              }}
            >
              <X size={12} /> Remove
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, oklch(0.623 0.214 259.815 / 15%), oklch(0.623 0.214 259.815 / 5%))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid oklch(0.623 0.214 259.815 / 25%)',
            transition: 'transform 0.2s ease',
          }}>
            <Upload size={28} style={{ color: 'oklch(0.623 0.214 259.815)' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '1.05rem', color: 'var(--foreground)' }}>
              Drop your GTFS feed here
            </p>
            <p style={{ margin: '6px 0 0', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
              or <span style={{ color: 'oklch(0.623 0.214 259.815)', textDecoration: 'underline', cursor: 'pointer' }}>browse files</span> · ZIP format required
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
