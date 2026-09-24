import { useState } from 'react';
import { Image, Upload, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { uploadFile } from '../api';

interface Props {
  value?: string[];
  onChange?: (urls: string[]) => void;
  max?: number;
  label?: string;
}

/** 照片上传：调 /api/upload，受控组件，值为图片 URL 数组 */
export default function PhotoUpload({ value = [], onChange, max = 4, label = '上传照片' }: Props) {
  const [uploading, setUploading] = useState(false);

  const fileList: UploadFile[] = value.map((url, i) => ({
    uid: `${i}`, name: url.split('/').pop() || 'photo', status: 'done', url,
  }));

  return (
    <Upload
      listType="picture-card"
      fileList={fileList}
      accept="image/*"
      customRequest={async ({ file, onSuccess, onError }) => {
        setUploading(true);
        try {
          const url = await uploadFile(file as File);
          onChange?.([...value, url]);
          onSuccess?.(url);
        } catch (e: any) {
          message.error(e.message || '上传失败');
          onError?.(e);
        } finally {
          setUploading(false);
        }
      }}
      onRemove={(file) => {
        onChange?.(value.filter(u => u !== file.url));
      }}
      itemRender={(originNode, file) => (
        <Image src={file.url} style={{ width: 104, height: 104, objectFit: 'cover', borderRadius: 6 }} preview={{ mask: '预览' }} />
      )}
    >
      {value.length >= max ? null : (
        <div>
          <PlusOutlined />
          <div style={{ marginTop: 8 }}>{uploading ? '上传中…' : label}</div>
        </div>
      )}
    </Upload>
  );
}
