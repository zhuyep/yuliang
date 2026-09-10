# 安全与隐私报告 / Security and privacy reporting

## 支持范围

当前支持范围是 `main` 分支上的最新公共预览版。余量是单用户、本机应用，不应直接暴露到公网或当作多用户服务部署。

The latest public preview on `main` is supported. Yuliang is a single-user local application and must not be exposed directly as a public or multi-user service.

## 请不要公开敏感材料

如果问题涉及凭证泄露、路径穿越、跨站访问、健康数据外发或私人文件暴露，请使用 GitHub 的[私密漏洞报告](https://github.com/zhuyep/yuliang/security/advisories/new)。不要把真实健康记录、GPS、账号信息、令牌、数据库内容或私人截图放进公开 Issue。

For credential exposure, path traversal, cross-site access, health-data egress, or private-file disclosure, use [GitHub private vulnerability reporting](https://github.com/zhuyep/yuliang/security/advisories/new). Do not attach real health records, GPS data, account details, tokens, databases, or private screenshots to public issues.

普通缺陷可以使用 Issue 模板，但请只用合成数据。报告应包含受影响版本、最小复现、预期边界和实际结果。

## 已知边界

- 本机 Host、Origin 与页面会话检查不是互联网级身份认证；
- 关键词过滤和模型输出校验不是医学或模型安全保证；
- 第三方数据库兼容层依赖用户自行维护的本机环境；
- 开源许可证不授予 Garmin 数据服务访问权。
