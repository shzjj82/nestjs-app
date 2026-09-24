import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostEntity, SiteEntity } from '../entities';
import {
  DEFAULT_ABOUT,
  isSiteSkillColor,
  normalizeEditorDocument,
  type SiteAbout,
  type SiteSkill,
} from '../common/shared';

@Injectable()
export class SiteService {
  constructor(
    @InjectRepository(SiteEntity)
    private readonly sites: Repository<SiteEntity>,
    @InjectRepository(PostEntity)
    private readonly posts: Repository<PostEntity>,
  ) {}

  async getAbout(): Promise<SiteAbout> {
    const page = await this.posts.findOne({ where: { pageKind: 'about' } });
    if (page) {
      const props = page.props ?? {};
      return {
        name: page.title || DEFAULT_ABOUT.name,
        body: normalizeEditorDocument(page.body),
        avatar:
          typeof props.avatar === 'string' && props.avatar.trim()
            ? props.avatar
            : DEFAULT_ABOUT.avatar,
        skills: this.parseSkills(props.skills ?? DEFAULT_ABOUT.skills),
      };
    }
    const row = await this.sites.findOne({ where: { id: 1 } });
    if (!row) {
      return DEFAULT_ABOUT;
    }
    return {
      name: row.aboutName,
      body: normalizeEditorDocument(row.aboutBody),
      avatar: row.aboutAvatar,
      skills: this.parseSkills(row.skills),
    };
  }

  async saveAbout(input: SiteAbout): Promise<SiteAbout> {
    const page = await this.posts.findOne({ where: { pageKind: 'about' } });
    const now = new Date();
    if (page) {
      page.title = input.name;
      page.body = input.body as unknown as Record<string, unknown>;
      page.props = {
        ...(page.props ?? {}),
        avatar: input.avatar,
        skills: input.skills,
      };
      page.draft = false;
      page.updatedAt = now;
      page.publishedAt = page.publishedAt ?? now;
      await this.posts.save(page);
    }
    await this.mirror(input);
    return this.getAbout();
  }

  async syncFromAboutPage(page: {
    title: string;
    body: unknown;
    props: Record<string, unknown>;
  }) {
    await this.mirror({
      name: page.title || DEFAULT_ABOUT.name,
      body: normalizeEditorDocument(page.body),
      avatar:
        typeof page.props.avatar === 'string' && page.props.avatar.trim()
          ? page.props.avatar
          : DEFAULT_ABOUT.avatar,
      skills: this.parseSkills(page.props.skills ?? DEFAULT_ABOUT.skills),
    });
  }

  async ensureRow() {
    const existing = await this.sites.findOne({ where: { id: 1 } });
    if (existing) {
      return;
    }
    await this.sites.save(
      this.sites.create({
        id: 1,
        aboutName: DEFAULT_ABOUT.name,
        aboutBody: DEFAULT_ABOUT.body as unknown as Record<string, unknown>,
        aboutAvatar: DEFAULT_ABOUT.avatar,
        skills: DEFAULT_ABOUT.skills,
      }),
    );
  }

  private async mirror(about: SiteAbout) {
    await this.ensureRow();
    await this.sites.update(
      { id: 1 },
      {
        aboutName: about.name,
        aboutBody: about.body as never,
        aboutAvatar: about.avatar,
        skills: about.skills as never,
      },
    );
  }

  private parseSkills(raw: unknown): SiteSkill[] {
    if (typeof raw === 'string') {
      try {
        return this.parseSkills(JSON.parse(raw));
      } catch {
        return DEFAULT_ABOUT.skills;
      }
    }
    if (!Array.isArray(raw)) {
      return DEFAULT_ABOUT.skills;
    }
    return raw.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }
      const row = item as { name?: unknown; color?: unknown };
      if (typeof row.name !== 'string' || typeof row.color !== 'string') {
        return [];
      }
      const name = row.name.trim();
      if (!name || !isSiteSkillColor(row.color)) {
        return [];
      }
      return [{ name, color: row.color }];
    });
  }
}
