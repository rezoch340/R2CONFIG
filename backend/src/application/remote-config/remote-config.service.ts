import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, asc, eq, ilike, max, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { containsPattern } from '../../common/db/like-pattern';
import { DbService } from '../../infrastructure/db/db.service';
import { CreateAppDto } from './dto/create-app.dto';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import { CreateParamDto, UpdateParamDto } from './dto/param.dto';
import {
  coerceParamValue,
  computeConfigEtag,
  inferParam,
  normalizeParamValue,
  ParamType,
} from './param-value';
import {
  configApps,
  configEnvironments,
  configParameters,
} from './remote-config.schema';

const DEFAULT_ENVIRONMENTS = ['dev', 'prod'];

const newServerKey = () => randomBytes(32).toString('hex');

@Injectable()
export class RemoteConfigService {
  constructor(private readonly dbService: DbService) {}

  private get database() {
    return this.dbService.database;
  }

  // ---------- 应用 ----------

  // 应用列表连环境一起带出来:两次全表查询在内存里分组,避免前端每个应用再拉一次
  async listApps() {
    const [apps, environments] = await Promise.all([
      this.database.select().from(configApps).orderBy(asc(configApps.id)),
      this.database
        .select()
        .from(configEnvironments)
        .orderBy(asc(configEnvironments.id)),
    ]);
    const environmentsByApp = new Map<number, typeof environments>();
    for (const environment of environments) {
      environmentsByApp.set(environment.appId, [
        ...(environmentsByApp.get(environment.appId) ?? []),
        environment,
      ]);
    }
    return apps.map((app) => ({
      ...app,
      environments: environmentsByApp.get(app.id) ?? [],
    }));
  }

  async createApp(input: CreateAppDto) {
    return this.database.transaction(async (transaction) => {
      const [app] = await transaction
        .insert(configApps)
        .values({
          name: input.name,
          slug: input.slug,
          serverKey: newServerKey(),
        })
        .onConflictDoNothing()
        .returning();
      if (!app) {
        throw new ConflictException('slug 已存在');
      }
      await transaction
        .insert(configEnvironments)
        .values(DEFAULT_ENVIRONMENTS.map((name) => ({ appId: app.id, name })));
      return app;
    });
  }

  async updateApp(appId: number, name: string) {
    const [app] = await this.database
      .update(configApps)
      .set({ name })
      .where(eq(configApps.id, appId))
      .returning();
    if (!app) {
      throw new NotFoundException('应用不存在');
    }
    return app;
  }

  async deleteApp(appId: number) {
    const [app] = await this.database
      .delete(configApps)
      .where(eq(configApps.id, appId))
      .returning({ id: configApps.id });
    if (!app) {
      throw new NotFoundException('应用不存在');
    }
    return { deleted: true as const };
  }

  async rotateServerKey(appId: number) {
    const [app] = await this.database
      .update(configApps)
      .set({ serverKey: newServerKey() })
      .where(eq(configApps.id, appId))
      .returning();
    if (!app) {
      throw new NotFoundException('应用不存在');
    }
    return app;
  }

  // ---------- 环境 ----------

  async listEnvironments(appId: number) {
    await this.requireApp(appId);
    return this.database
      .select()
      .from(configEnvironments)
      .where(eq(configEnvironments.appId, appId))
      .orderBy(asc(configEnvironments.id));
  }

  async createEnvironment(appId: number, input: CreateEnvironmentDto) {
    await this.requireApp(appId);
    const [environment] = await this.database
      .insert(configEnvironments)
      .values({ appId, name: input.name })
      .onConflictDoNothing()
      .returning();
    if (!environment) {
      throw new ConflictException('环境已存在');
    }
    return environment;
  }

  async deleteEnvironment(environmentId: number) {
    const [environment] = await this.database
      .delete(configEnvironments)
      .where(eq(configEnvironments.id, environmentId))
      .returning({ id: configEnvironments.id });
    if (!environment) {
      throw new NotFoundException('环境不存在');
    }
    return { deleted: true as const };
  }

  // ---------- 参数(后台) ----------

  async listParams(environmentId: number, search?: string) {
    await this.requireEnvironment(environmentId);
    const conditions = [eq(configParameters.environmentId, environmentId)];
    if (search) {
      conditions.push(ilike(configParameters.key, containsPattern(search)));
    }
    return this.database
      .select()
      .from(configParameters)
      .where(and(...conditions))
      .orderBy(asc(configParameters.key));
  }

  async createParam(environmentId: number, input: CreateParamDto) {
    await this.requireEnvironment(environmentId);
    const [param] = await this.database
      .insert(configParameters)
      .values({
        environmentId,
        key: input.key,
        type: input.type,
        scope: input.scope ?? 'public',
        value: normalizeParamValue(input.type, input.value),
      })
      .onConflictDoNothing()
      .returning();
    if (!param) {
      throw new ConflictException('同名参数已存在');
    }
    return param;
  }

  async updateParam(paramId: number, input: UpdateParamDto) {
    const [existing] = await this.database
      .select()
      .from(configParameters)
      .where(eq(configParameters.id, paramId))
      .limit(1);
    if (!existing) {
      throw new NotFoundException('参数不存在');
    }

    const type = input.type ?? (existing.type as ParamType);
    const rawValue = input.value ?? existing.value;
    const [param] = await this.database
      .update(configParameters)
      .set({
        type,
        scope: input.scope ?? existing.scope,
        value: normalizeParamValue(type, rawValue),
        updatedAt: new Date(),
      })
      .where(eq(configParameters.id, paramId))
      .returning();
    return param;
  }

  async deleteParam(paramId: number) {
    const [param] = await this.database
      .delete(configParameters)
      .where(eq(configParameters.id, paramId))
      .returning({ id: configParameters.id });
    if (!param) {
      throw new NotFoundException('参数不存在');
    }
    return { deleted: true as const };
  }

  // 批量导入:upsert,已存在的保留原 scope
  async importParams(environmentId: number, entries: Record<string, unknown>) {
    await this.requireEnvironment(environmentId);
    const rows = Object.entries(entries).map(([key, raw]) => {
      const inferred = inferParam(raw);
      return { environmentId, key, scope: 'public', ...inferred };
    });
    if (rows.length === 0) {
      return { imported: 0 };
    }
    await this.database
      .insert(configParameters)
      .values(rows)
      .onConflictDoUpdate({
        target: [configParameters.environmentId, configParameters.key],
        set: {
          type: sql`excluded.type`,
          value: sql`excluded.value`,
          updatedAt: new Date(),
        },
      });
    return { imported: rows.length };
  }

  // ---------- 公开拉取 ----------

  // 不带 key 只给 public;带对的 key 给全部;带错的 key 拒绝
  async resolvePublicConfig(
    slug: string,
    environmentName: string,
    serverKey: string | undefined,
  ) {
    const [app] = await this.database
      .select()
      .from(configApps)
      .where(eq(configApps.slug, slug))
      .limit(1);
    if (!app) {
      throw new NotFoundException('应用不存在');
    }
    if (serverKey !== undefined && serverKey !== app.serverKey) {
      throw new UnauthorizedException('server key 无效');
    }
    const [environment] = await this.database
      .select()
      .from(configEnvironments)
      .where(
        and(
          eq(configEnvironments.appId, app.id),
          eq(configEnvironments.name, environmentName),
        ),
      )
      .limit(1);
    if (!environment) {
      throw new NotFoundException('环境不存在');
    }

    const includePrivate = serverKey !== undefined;
    const scopeCondition = includePrivate
      ? undefined
      : eq(configParameters.scope, 'public');
    const whereClause = and(
      eq(configParameters.environmentId, environment.id),
      scopeCondition,
    );

    const [summary] = await this.database
      .select({
        count: sql<number>`count(*)::int`,
        latest: max(configParameters.updatedAt),
      })
      .from(configParameters)
      .where(whereClause);
    const etag = computeConfigEtag(summary.count, summary.latest ?? null);

    return {
      etag,
      load: async () => {
        const rows = await this.database
          .select({
            key: configParameters.key,
            type: configParameters.type,
            value: configParameters.value,
          })
          .from(configParameters)
          .where(whereClause)
          .orderBy(asc(configParameters.key));
        return Object.fromEntries(
          rows.map((row) => [
            row.key,
            coerceParamValue(row.type as ParamType, row.value),
          ]),
        );
      },
    };
  }

  // ---------- 内部 ----------

  private async requireApp(appId: number) {
    const [app] = await this.database
      .select({ id: configApps.id })
      .from(configApps)
      .where(eq(configApps.id, appId))
      .limit(1);
    if (!app) {
      throw new NotFoundException('应用不存在');
    }
  }

  private async requireEnvironment(environmentId: number) {
    const [environment] = await this.database
      .select({ id: configEnvironments.id })
      .from(configEnvironments)
      .where(eq(configEnvironments.id, environmentId))
      .limit(1);
    if (!environment) {
      throw new NotFoundException('环境不存在');
    }
  }
}
