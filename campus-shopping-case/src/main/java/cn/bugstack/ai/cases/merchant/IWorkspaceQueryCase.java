package cn.bugstack.ai.cases.merchant;

import cn.bugstack.ai.cases.merchant.model.WorkspaceSnapshot;

/** 跨 Identity / Merchant 的工作台查询入口。 */
public interface IWorkspaceQueryCase {
    WorkspaceSnapshot workspace(String actor);
}
