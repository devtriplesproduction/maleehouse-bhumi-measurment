'use client';

import React from 'react';
import { Download, FileText, Image, FileCode, Archive, File } from 'lucide-react';

interface FileMetadata {
  id: string;
  file_name: string;
  file_url: string;
  category: string;
  file_size: number | null;
  uploaded_at: string;
  mime_type: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

interface ProjectFileGalleryProps {
  files: FileMetadata[];
}

const CATEGORY_LABELS: Record<string, string> = {
  receipt: 'Receipts',
  requirements: 'Project Requirements',
  survey_data: 'Survey Data',
  final_file: 'Final Deliverables',
};

export function ProjectFileGallery({ files }: ProjectFileGalleryProps) {
  const groupedFiles = files.reduce((acc: any, file: any) => {
    const cat = file.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(file);
    return acc;
  }, {} as Record<string, FileMetadata[]>);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="w-6 h-6" />;
    if (mimeType.includes('image')) return <Image className="w-6 h-6 text-blue-400" />;
    if (mimeType.includes('pdf')) return <FileText className="w-6 h-6 text-red-400" />;
    if (mimeType.includes('zip') || mimeType.includes('rar')) return <Archive className="w-6 h-6 text-yellow-400" />;
    if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('html')) return <FileCode className="w-6 h-6 text-green-400" />;
    return <File className="w-6 h-6 text-gray-400" />;
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {Object.entries(groupedFiles).length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-gray-500 border-dashed border-white/10">
          <File className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-lg font-medium">No files uploaded yet</p>
          <p className="text-sm">Project documents and data will appear here.</p>
        </div>
      ) : (
        Object.entries(groupedFiles).map(([category, catFiles]: [string, any]) => (
          <div key={category} className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 px-2 flex items-center gap-2">
              <span className="w-1 h-4 bg-indigo-500 rounded-full" />
              {CATEGORY_LABELS[category] || category}
              <span className="text-xs font-normal lowercase text-gray-400 ml-1">({catFiles.length} files)</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catFiles.map((file: any) => (
                <div 
                  key={file.id} 
                  className="glass-card group hover:bg-white/5 transition-all duration-300 border-white/10 p-5 flex flex-col justify-between h-full relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/0 group-hover:bg-indigo-500/50 transition-all duration-300" />
                  
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      {getFileIcon(file.mime_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={file.file_name}>
                        {file.file_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Uploaded by {file.profiles?.first_name || 'System'} • {new Date(file.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-xs nums text-gray-500">
                      {formatFileSize(file.file_size)}
                    </span>
                    <a 
                      href={file.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all text-xs font-medium"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
