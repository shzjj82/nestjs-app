/**
 * 工作区按 id 是否可读。
 * 私有文需要登录。作者、尚无作者的旧文，以及这篇或祖先属于当前用户所在团队的文章，都可以读。
 * 有父页面的子文档会被存成 public，不能因此把同团队的人挡在外面。
 */
export function canReadWorkspacePost(opts: {
  visibility: string;
  authorId?: string | null;
  actorId?: string;
  lineageTeamIds: readonly string[];
  readableTeamIds: readonly string[];
}): boolean {
  const readable = new Set(opts.readableTeamIds);
  const inTeam = opts.lineageTeamIds.some((id) => readable.has(id));
  if (opts.visibility === 'private') {
    if (!opts.actorId) {
      return false;
    }
    return !opts.authorId || opts.authorId === opts.actorId || inTeam;
  }
  if (opts.actorId && opts.authorId && opts.authorId !== opts.actorId && !inTeam) {
    return false;
  }
  return true;
}
