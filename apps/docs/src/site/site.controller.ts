import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS } from '@app/common';
import { HandleLogInterceptor } from '../common/handle-log.interceptor';
import { resolveAppCode } from '../common/app-code';
import { asRecord, docsPattern, optionalString, requiredString, rpcFail } from '../common/rpc';
import {
  isEditorJsDocument,
  isSiteSkillColor,
  type SiteAbout,
  type SiteSkill,
} from '../common/shared';
import { SiteService } from './site.service';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class SiteController {
  constructor(private readonly site: SiteService) {}

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_SITE_GET))
  async getSite(payload: Record<string, unknown> = {}) {
    const appCode = resolveAppCode(optionalString(payload.appCode));
    return { about: await this.site.getAbout(appCode) };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_SITE_SAVE))
  async saveSite(payload: Record<string, unknown>) {
    const appCode = resolveAppCode(optionalString(payload.appCode));
    return { about: await this.site.saveAbout(appCode, this.parseAbout(payload)) };
  }

  private parseAbout(payload: Record<string, unknown>): SiteAbout {
    const raw = optionalString(payload.name) ? payload : asRecord(payload.about);
    const name = requiredString(raw.name, 'name');
    const avatar = optionalString(raw.avatar) ?? '';
    if (!isEditorJsDocument(raw.body)) {
      rpcFail(400, 'INVALID_INPUT');
    }
    const skills: SiteSkill[] = [];
    if (Array.isArray(raw.skills)) {
      for (const item of raw.skills.slice(0, 12)) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        const row = item as { name?: unknown; color?: unknown };
        if (
          typeof row.name !== 'string' ||
          typeof row.color !== 'string' ||
          !isSiteSkillColor(row.color)
        ) {
          continue;
        }
        const skillName = row.name.trim();
        if (skillName) {
          skills.push({ name: skillName, color: row.color });
        }
      }
    }
    return { name, avatar, body: raw.body, skills };
  }
}
