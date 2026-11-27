import { Controller, type DynamicModule, Inject, Injectable, Module, SetMetadata } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, MetadataScanner } from '@nestjs/core';
import { MessagePattern } from '@nestjs/microservices';
import { PATTERN_METADATA } from '@nestjs/microservices/constants';

export const API_DOC_METADATA = 'app:api-doc';

export interface ApiDocOptions {
  /** 接口名称，如「注册用户」 */
  name: string;
  description?: string;
}

/** 描述微服务接口；网关据此展示接口文档与「开通模块」 */
export const ApiDoc = (options: ApiDocOptions) => SetMetadata(API_DOC_METADATA, options);

export interface ServiceApiDoc extends ApiDocOptions {
  /** 去掉 `$share/<group>/` 前缀后的消息 pattern */
  pattern: string;
}

export interface ServiceApiDocs {
  service: string;
  label: string;
  apis: ServiceApiDoc[];
}

export interface ApiDocsModuleOptions {
  service: string;
  /** 模块名称，如「用户模块」 */
  label: string;
  /** 本服务应答文档查询的订阅主题 */
  pattern: string;
}

function stripShare(pattern: string): string {
  return pattern.replace(/^\$share\/[^/]+\//, '');
}

@Injectable()
export class ApiDocsExplorer {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
  ) {}

  collect(): ServiceApiDoc[] {
    const apis: ServiceApiDoc[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      const instance = wrapper.instance as object | undefined;
      if (!instance) continue;
      const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;
      for (const method of this.scanner.getAllMethodNames(proto)) {
        const handler = proto[method] as object;
        const doc = Reflect.getMetadata(API_DOC_METADATA, handler) as ApiDocOptions | undefined;
        if (!doc) continue;
        const raw = Reflect.getMetadata(PATTERN_METADATA, handler) as unknown;
        for (const pattern of Array.isArray(raw) ? raw : [raw]) {
          if (typeof pattern === 'string') {
            apis.push({ pattern: stripShare(pattern), ...doc });
          }
        }
      }
    }
    return apis;
  }
}

@Module({})
export class ApiDocsModule {
  static forService(options: ApiDocsModuleOptions): DynamicModule {
    @Controller()
    class ApiDocsController {
      constructor(@Inject(ApiDocsExplorer) private readonly explorer: ApiDocsExplorer) {}

      @MessagePattern(options.pattern)
      docs(): ServiceApiDocs {
        return { service: options.service, label: options.label, apis: this.explorer.collect() };
      }
    }

    return {
      module: ApiDocsModule,
      imports: [DiscoveryModule],
      controllers: [ApiDocsController],
      providers: [ApiDocsExplorer],
    };
  }
}
