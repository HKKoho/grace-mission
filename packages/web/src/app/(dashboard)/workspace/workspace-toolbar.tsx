'use client';

import { FilePlus, FolderPlus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT, type Messages } from '@/lib/i18n';

const messages = {
  en: {
    newFile: 'New File',
    newFolder: 'New Folder',
    upload: 'Upload',
    itemCount: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
  },
  'zh-TW': {
    newFile: '新增檔案',
    newFolder: '新增資料夾',
    upload: '上傳',
    itemCount: (n: number) => `${n} 個項目`,
  },
} satisfies Messages<{
  newFile: string;
  newFolder: string;
  upload: string;
  itemCount: (n: number) => string;
}>;

interface WorkspaceToolbarProps {
  readonly entryCount: number;
  readonly onNewFile: () => void;
  readonly onNewFolder: () => void;
  readonly onUpload: () => void;
}

export function WorkspaceToolbar({
  entryCount,
  onNewFile,
  onNewFolder,
  onUpload,
}: WorkspaceToolbarProps) {
  const t = useT(messages);
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onNewFile}>
        <FilePlus className="mr-1.5 size-4" />
        {t.newFile}
      </Button>
      <Button variant="outline" size="sm" onClick={onNewFolder}>
        <FolderPlus className="mr-1.5 size-4" />
        {t.newFolder}
      </Button>
      <Button variant="outline" size="sm" onClick={onUpload}>
        <Upload className="mr-1.5 size-4" />
        {t.upload}
      </Button>
      <div className="flex-1" />
      <span className="text-xs text-muted-foreground">{t.itemCount(entryCount)}</span>
    </div>
  );
}
