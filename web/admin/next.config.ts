import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "path";

/** 与 Nest 微服务共用仓库根目录 `.env` / `.env.local`，不在 web/admin 单独维护一份 */
const monorepoRoot = path.join(__dirname, "../..");
loadEnvConfig(monorepoRoot);

const nextConfig: NextConfig = {};

export default nextConfig;
