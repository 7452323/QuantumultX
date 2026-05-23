# 🎬 视频去水印

抖音/快手/小红书等短视频去水印下载。

## 一键安装

```bash
bash scripts/install.sh
```

运行后终端依次：
1. 输入你的去水印 API 地址
2. 选择接入平台（OpenClaw / AstrBot / TG / 微信 / 本地）
3. 自动保存配置
4. 验证 API 是否可达
5. 输出接入指引

## 手动使用

```bash
bash douyin_dl.sh 'https://v.douyin.com/xxxx/'
```

## 文件清单

| 文件 | 说明 |
|------|------|
| `install.sh` | 一键安装脚本（交互式） |
| `douyin_dl.sh` | 去水印下载脚本 |
| `config.sh` | 配置文件（安装时自动生成） |

> ⚠️ **本工具不内置任何 API**，接口由用户自行配置。
