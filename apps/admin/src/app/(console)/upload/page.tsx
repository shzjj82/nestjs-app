'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { adminFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UploadResult {
  key?: string;
  url?: string;
  publicUrl?: string;
  jobId?: string;
}

interface JobResult {
  id: string;
  status: string;
  result?: UploadResult;
  error?: string;
}

export default function UploadPage() {
  const [prefix, setPrefix] = useState('admin');
  const [file, setFile] = useState<File | null>(null);
  const [last, setLast] = useState<UploadResult | null>(null);
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState<JobResult | null>(null);
  const [objectKey, setObjectKey] = useState('');

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('请选择文件');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    body.append('prefix', prefix);
    try {
      const res = await fetch('/api/proxy/upload', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.message || '上传失败');
      }
      setLast(json.data);
      if (json.data?.key) setObjectKey(json.data.key);
      toast.success('上传成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败');
    }
  }

  async function uploadAsync(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('请选择文件');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    body.append('prefix', prefix);
    try {
      const res = await fetch('/api/proxy/upload/async', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.message || '入队失败');
      }
      const id = json.data?.jobId || json.data?.id;
      setJobId(id || '');
      toast.success(`已入队 ${id || ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '入队失败');
    }
  }

  async function checkJob() {
    if (!jobId) return;
    try {
      const result = await adminFetch<JobResult>(`/upload/jobs/${jobId}`);
      setJob(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '查询失败');
    }
  }

  async function removeObject() {
    if (!objectKey) {
      toast.error('请输入 object key');
      return;
    }
    try {
      await adminFetch('/upload/objects', {
        method: 'DELETE',
        body: JSON.stringify({ key: objectKey }),
      });
      toast.success('已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">上传管理</h1>
        <p className="text-sm text-muted-foreground">
          同步/异步上传与按 key 删除（无对象列表接口）
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>上传文件</CardTitle>
            <CardDescription>走网关 /upload</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3">
              <div className="space-y-1">
                <Label>前缀</Label>
                <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>文件</Label>
                <Input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={upload}>
                  同步上传
                </Button>
                <Button type="button" variant="outline" onClick={uploadAsync}>
                  异步入队
                </Button>
              </div>
            </form>
            {last && (
              <pre className="mt-4 overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(last, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>查询异步任务</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="jobId"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              />
              <Button onClick={checkJob}>查询</Button>
              {job && (
                <pre className="overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(job, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>删除对象</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="object key"
                value={objectKey}
                onChange={(e) => setObjectKey(e.target.value)}
              />
              <Button variant="destructive" onClick={removeObject}>
                删除
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
