'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { parseApiResponse } from '@/lib/api';

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      await parseApiResponse(res);
      toast.success('登录成功');
      router.replace(search.get('from') || '/');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary lg:block">
        <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-primary-foreground/5 blur-3xl" />
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">欢迎回来</h2>
            <p className="text-sm text-muted-foreground">登录超级管理员账号以继续</p>
          </div>

          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">用户名</FieldLabel>
                <InputGroup className="h-10 bg-background">
                  <InputGroupAddon>
                    <User />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名或手机号"
                    autoComplete="username"
                    autoFocus
                    required
                  />
                </InputGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="password">密码</FieldLabel>
                <InputGroup className="h-10 bg-background">
                  <InputGroupAddon>
                    <Lock />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    required
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>

              <Button className="h-10 w-full" type="submit" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                {loading ? '登录中…' : '登录'}
              </Button>
            </FieldGroup>
          </form>
        </div>
      </main>
    </div>
  );
}
