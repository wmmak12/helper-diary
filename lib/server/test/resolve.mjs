const root = new URL("../../../", import.meta.url);

export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) spec = new URL(spec.slice(2), root).href;
  try {
    return await next(spec, ctx);
  } catch (e) {
    if (/\.[cm]?[jt]sx?$/.test(spec)) throw e;
    for (const ext of [".ts", ".js"]) {
      try {
        return await next(spec + ext, ctx);
      } catch {}
    }
    throw e;
  }
}
