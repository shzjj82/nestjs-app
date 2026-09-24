import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS } from '@app/common';
import { HandleLogInterceptor } from '../common/handle-log.interceptor';
import { docsPattern, optionalString, requiredString, rpcFail } from '../common/rpc';
import {
  isCategoryKind,
  isSiteSkillColor,
  type CategoryKind,
} from '../common/shared';
import { CategoriesService } from './categories.service';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_CATEGORY_FIND_ALL))
  async listCategories() {
    return { categories: await this.categories.list() };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_CATEGORY_FIND_SLUG))
  async categoryBySlug(payload: Record<string, unknown>) {
    const category = await this.categories.findBySlug(
      requiredString(payload.slug, 'slug'),
    );
    if (!category) {
      rpcFail(404, 'NOT_FOUND');
    }
    return { category };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_CATEGORY_CREATE))
  async createCategory(payload: Record<string, unknown>) {
    return { category: await this.categories.create(this.parseCategory(payload)) };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_CATEGORY_UPDATE))
  async updateCategory(payload: Record<string, unknown>) {
    const category = await this.categories.update(
      requiredString(payload.id, 'id'),
      this.parseCategory(payload),
    );
    if (!category) {
      rpcFail(404, 'NOT_FOUND');
    }
    return { category };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_CATEGORY_DELETE))
  async deleteCategory(payload: Record<string, unknown>) {
    if (!(await this.categories.remove(requiredString(payload.id, 'id')))) {
      rpcFail(404, 'NOT_FOUND');
    }
    return null;
  }

  private parseCategory(payload: Record<string, unknown>) {
    const name = requiredString(payload.name, 'name');
    const color = requiredString(payload.color, 'color');
    const kind = requiredString(payload.kind, 'kind');
    if (!isSiteSkillColor(color) || !isCategoryKind(kind)) {
      rpcFail(400, 'INVALID_INPUT');
    }
    return {
      id: optionalString(payload.id),
      name,
      slug: optionalString(payload.slug),
      hint: optionalString(payload.hint) ?? '',
      color,
      kind: kind as CategoryKind,
      nav: payload.nav === false ? false : true,
      sort: typeof payload.sort === 'number' ? payload.sort : undefined,
    };
  }
}
