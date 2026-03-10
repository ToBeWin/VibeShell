import { ArrowDownToLine, ArrowLeft, ArrowUpToLine, File as FileIcon, FolderPlus, FolderOpen, Loader2, Pencil, PlugZap, Save, Trash2, X, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useSftpDragDrop } from '../hooks/useSftpDragDrop';

interface FileBrowserPanelProps {
  host: string;
  sessionId: string | null;
  files: string[];
  path: string;
  loading: boolean;
  error: string;
  protocolLabel: string;
  protocol: 'ftp' | 'sftp';
  openFilePath: string | null;
  openFileContent: string;
  fileDirty: boolean;
  fileSaving: boolean;
  transferRunning: boolean;
  onProtocolChange: (protocol: 'ftp' | 'sftp') => void;
  onFileContentChange: (content: string) => void;
  onSaveFile: () => void;
  onUploadFile: (file: globalThis.File) => void;
  onDownloadFile: () => void;
  onCreateDirectory: () => void;
  onRenameEntry: (entry: string) => void;
  onDeleteEntry: (entry: string) => void;
  onClose: () => void;
  onInit: () => void;
  onNavigate: (path: string) => void;
}

export function FileBrowserPanel({
  host,
  sessionId,
  files,
  path,
  loading,
  error,
  protocolLabel,
  protocol,
  openFilePath,
  openFileContent,
  fileDirty,
  fileSaving,
  transferRunning,
  onProtocolChange,
  onFileContentChange,
  onSaveFile,
  onUploadFile,
  onDownloadFile,
  onCreateDirectory,
  onRenameEntry,
  onDeleteEntry,
  onClose,
  onInit,
  onNavigate,
}: FileBrowserPanelProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  
  // SFTP drag-and-drop integration
  const dragDrop = useSftpDragDrop(protocol === 'sftp' ? sessionId : null, path);
  
  // Refresh file list after successful upload
  const handleDrop = async (e: React.DragEvent) => {
    await dragDrop.handleDrop(e);
    // Trigger refresh by navigating to current path
    setTimeout(() => onNavigate('.'), 500);
  };

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 38 }}
      className="bg-[#08080E]/95 backdrop-blur-3xl border-l border-white/[0.04] flex flex-col overflow-hidden shadow-[-4px_0_30px_rgba(0,0,0,0.4)] z-10"
    >
      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onUploadFile(file);
          }
          event.currentTarget.value = '';
        }}
      />
      <div className="h-14 border-b border-white/[0.05] flex items-center px-4 gap-3 shrink-0">
        <FolderOpen size={15} className="text-violet-400" />
        <span className="text-sm font-semibold text-white">Remote Files</span>
        <div className="ml-auto flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
          {(['ftp', 'sftp'] as const).map((item) => (
            <button
              key={item}
              onClick={() => onProtocolChange(item)}
              className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] transition-colors ${
                protocol === item
                  ? 'bg-violet-500/20 text-violet-200'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-white hover:bg-white/5 transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 flex flex-col p-4 w-full">
        {!sessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-4 text-violet-400/50">
              <FolderOpen size={32} />
            </div>
            <p className="text-sm font-medium text-gray-300 mb-2">No remote file session</p>
            <p className="text-xs text-gray-500 mb-6">Connect to {host} to browse remote files in this drawer. Current protocol: {protocolLabel}.</p>

            <button onClick={onInit} disabled={loading} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs font-medium text-white transition-colors shadow-lg flex-shrink-0 flex items-center gap-2">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
              Initialize Connection
            </button>
            {error && <p className="mt-4 text-xs text-red-400 max-w-[240px] truncate">{error}</p>}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3 bg-white/[0.03] p-2 rounded-lg border border-white/[0.05]">
              {path !== '/' && (
                <button onClick={() => onNavigate('..')} disabled={loading} className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                  <ArrowLeft size={14} />
                </button>
              )}
              <span className="text-xs font-mono text-gray-400 truncate flex-1">{path}</span>
              {protocol === 'sftp' && (
                <button
                  onClick={onCreateDirectory}
                  disabled={loading || transferRunning}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-gray-200 disabled:opacity-40"
                >
                  <FolderPlus size={11} />
                  New
                </button>
              )}
              {loading && <Loader2 size={12} className="animate-spin text-violet-400" />}
            </div>
            {error && <div className="text-xs text-red-500 mb-3 bg-red-500/10 p-2 rounded-lg">{error}</div>}
            <div className="grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 flex-1 min-h-0">
              <div 
                className={`overflow-y-auto w-full pr-1 space-y-1 min-h-0 relative rounded-lg transition-all ${
                  protocol === 'sftp' && dragDrop.isDragging 
                    ? 'border-2 border-dashed border-violet-400 bg-violet-500/10' 
                    : ''
                }`}
                onDragEnter={protocol === 'sftp' ? dragDrop.handleDragEnter : undefined}
                onDragLeave={protocol === 'sftp' ? dragDrop.handleDragLeave : undefined}
                onDragOver={protocol === 'sftp' ? dragDrop.handleDragOver : undefined}
                onDrop={protocol === 'sftp' ? handleDrop : undefined}
              >
                {protocol === 'sftp' && dragDrop.isDragging && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10 pointer-events-none">
                    <div className="text-center">
                      <Upload size={32} className="mx-auto mb-2 text-violet-400" />
                      <p className="text-sm font-medium text-white">Drop files to upload</p>
                      <p className="text-xs text-gray-400 mt-1">Folders are not supported</p>
                    </div>
                  </div>
                )}
                
                {/* Upload progress indicators */}
                {Array.from(dragDrop.uploadProgress.values()).map((progress) => (
                  <div key={progress.fileName} className="px-2 py-1.5 bg-white/5 rounded text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-300 truncate flex-1">{progress.fileName}</span>
                      {progress.status === 'uploading' && <Loader2 size={12} className="animate-spin text-violet-400 ml-2" />}
                      {progress.status === 'completed' && <span className="text-green-400 ml-2">✓</span>}
                      {progress.status === 'error' && (
                        <button 
                          onClick={() => dragDrop.clearError(progress.fileName)}
                          className="text-red-400 ml-2 hover:text-red-300"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {progress.status === 'error' && progress.error && (
                      <p className="text-red-400 text-[10px] mt-1">{progress.error}</p>
                    )}
                  </div>
                ))}
                
                {files.length === 0 && !loading && <div className="text-center text-xs text-gray-600 py-6">Empty directory</div>}
                {files.map((file, index) => (
                  <div key={index} className="group flex items-center gap-1 rounded hover:bg-white/5">
                    <button
                      onClick={() => onNavigate(file)}
                      disabled={loading}
                      className="min-w-0 flex-1 flex items-center gap-2 px-2 py-1.5 text-left text-[13px] text-gray-300 hover:text-white transition-colors"
                    >
                      <FileIcon size={13} className="shrink-0 text-gray-500 group-hover:text-violet-400" />
                      <span className="truncate">{file}</span>
                    </button>
                    {protocol === 'sftp' && file !== '..' && (
                      <div className="pr-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onRenameEntry(file)}
                          disabled={loading || transferRunning}
                          className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-40"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => onDeleteEntry(file)}
                          disabled={loading || transferRunning}
                          className="p-1 rounded text-gray-500 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="min-h-0 rounded-xl border border-white/[0.06] bg-black/20 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-gray-500">Editor</span>
                  <span className="text-xs text-gray-400 truncate flex-1">
                    {openFilePath ?? (protocol === 'sftp' ? 'Select a text file to preview or edit' : 'Editing is currently available only over SFTP')}
                  </span>
                  {protocol === 'sftp' && (
                    <button
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={transferRunning || loading}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-gray-200 disabled:opacity-40"
                    >
                      <ArrowUpToLine size={11} />
                      Upload
                    </button>
                  )}
                  {protocol === 'sftp' && openFilePath && (
                    <button
                      onClick={onDownloadFile}
                      disabled={transferRunning || loading}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-gray-200 disabled:opacity-40"
                    >
                      {transferRunning ? <Loader2 size={11} className="animate-spin" /> : <ArrowDownToLine size={11} />}
                      Download
                    </button>
                  )}
                  {protocol === 'sftp' && openFilePath && (
                    <button
                      onClick={onSaveFile}
                      disabled={fileSaving || transferRunning || !fileDirty}
                      className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                    >
                      {fileSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                      Save
                    </button>
                  )}
                </div>
                <textarea
                  value={openFileContent}
                  onChange={(e) => onFileContentChange(e.target.value)}
                  readOnly={protocol !== 'sftp' || !openFilePath || loading}
                  spellCheck={false}
                  className="flex-1 w-full resize-none bg-transparent px-3 py-2 text-xs font-mono text-gray-200 outline-none placeholder:text-gray-600"
                  placeholder={protocol === 'sftp' ? 'Open a file from the list above…' : 'Switch to SFTP to edit remote files.'}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </motion.aside>
  );
}
