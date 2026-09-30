import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, DocsHandleLogInterceptor, MQTT_PATTERNS } from '@app/common';
import { resolveAppCode } from '../common/app-code';
import { docsPattern, optionalString, requiredString, rpcFail } from '../common/rpc';
import {
  isCategoryKind,
  isStoredColor,
  type CategoryKind,
} from '../common/shared';
import { CategoriesService } from './categories.service';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_CATEGORY_FIND_ALL))
  @ApiDoc({ name: '分类列表' })
  async listCategories(payload: Record<string, unknown> = {}) {
    const appCode = resolveAppCode(payload);
    return { categories: await this.categories.list(appCode) };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_CATEGORY_FIND_SLUG))
  @ApiDoc({ name: '分类详情' })
  async categoryBySlug(payload: Record<string, unknown>) {
    const category = await this.categories.findBySlug(
      resolveAppCode(payload),
      requiredString(payload.slug, 'slug'),
    );
    if (!category) {
      rpcFail(404, 'NOT_FOUND');
    }
    return { category };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_CATEGORY_CREATE))
  @ApiDoc({ name: '创建分类' })
  async createCategory(payload: Record<string, unknown>) {
    return { category: await this.categories.create(this.parseCategory(payload)) };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_CATEGORY_UPDATE))
  @ApiDoc({ name: '更新分类' })
  async updateCategory(payload: Record<string, unknown>) {
    await this.requireInBiz(payload);
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
  @ApiDoc({ name: '删除分类' })
  async deleteCategory(payload: Record<string, unknown>) {
    await this.requireInBiz(payload);
    if (!(await this.categories.remove(requiredString(payload.id, 'id')))) {
      rpcFail(404, 'NOT_FOUND');
    }
    return null;
  }

  /** 按 id 操作的分类必须属于当前业务，否则按不存在处理 */
  private async requireInBiz(payload: Record<string, unknown>) {
    const category = await this.categories.findById(requiredString(payload.id, 'id'));
    if (!category || category.appCode !== resolveAppCode(payload)) {
      rpcFail(404, 'NOT_FOUND');
    }
    return category;
  }

  private parseCategory(payload: Record<string, unknown>) {
    const name = requiredString(payload.name, 'name');
    const color = requiredString(payload.color, 'color');
    const kind = requiredString(payload.kind, 'kind');
    if (!isStoredColor(color) || !isCategoryKind(kind)) {
      rpcFail(400, 'INVALID_INPUT');
    }
    return {
      appCode: resolveAppCode(payload),
      id: optionalString(payload.id),
      name,
      slug: optionalString(payload.slug),
      hint: optionalString(payload.hint) ?? '',
      color,
      kind: kind as CategoryKind,
      nav: payload.nav === undefined ? undefined : payload.nav === true,
      sort: typeof payload.sort === 'number' ? payload.sort : undefined,
    };
  }
}
