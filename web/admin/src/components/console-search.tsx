'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { CONSOLE_NAV_GROUPS } from '@/lib/console-nav';

export function ConsoleSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative h-8 w-full justify-start bg-muted/50 px-2.5 font-normal text-muted-foreground shadow-none sm:w-56 lg:w-72"
      >
        <Search />
        <span className="hidden sm:inline">搜索菜单、功能...</span>
        <span className="sm:hidden">搜索</span>
        <Kbd className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 sm:inline-flex">⌘K</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="全局搜索"
        description="搜索菜单并快速跳转"
      >
        <Command>
          <CommandInput placeholder="输入页面名称或关键词..." />
          <CommandList>
            <CommandEmpty>没有找到匹配的页面</CommandEmpty>
            {CONSOLE_NAV_GROUPS.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${group.label} ${item.label}`}
                    keywords={item.keywords}
                    onSelect={() => go(item.href)}
                  >
                    <item.icon />
                    {item.label}
                    <CommandShortcut>{item.href}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
