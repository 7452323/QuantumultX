// ⚡ Iwara 一键 Token 设置（含 access_token 用于点赞）
// 在 Scripting App 中打开此文件运行一次即可
// 之后打开 index.tsx 就能正常使用

import { Script } from "scripting"

// 从浏览器 localStorage 获取的有效 refresh_token（有效期 30 天）
const REFRESH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjQxYjUwMTM2LTBhZDctNGMyYy1iY2VkLTMyNzA1MDA2N2Q5MSIsInR5cGUiOiJyZWZyZXNoX3Rva2VuIiwiaXNzIjoiaXdhcmEiLCJpYXQiOjE3ODQ0MDY2NzYsImV4cCI6MTc4Njk5ODY3Nn0.yGUbgjrIARIC8-imR2udb6u7wgDzkwGKkT8Be1938so"

// 从浏览器中提取的 access_token（有效期 1 小时，用于点赞/取消操作）
const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjQxYjUwMTM2LTBhZDctNGMyYy1iY2VkLTMyNzA1MDA2N2Q5MSIsInR5cGUiOiJhY2Nlc3NfdG9rZW4iLCJyb2xlIjoibGltaXRlZCIsInByZW1pdW0iOmZhbHNlLCJpc3MiOiJpd2FyYSIsImlhdCI6MTc4NDQwODU3OSwiZXhwIjoxNzg0NDEyMTc5fQ.yIkcfB12oRViWh7X7ZR71jZNvSbAn6eM4nTcuWmt9QE"

// 保存到 Storage
Storage.set("iwara_auth", REFRESH_TOKEN)
Storage.set("iwara_access", ACCESS_TOKEN)

console.log("✅ Token 已保存！")
console.log("用户 ID: 41b50136-0ad7-4c2c-bced-327050067d91")
console.log("refresh_token 到期: " + new Date(1786998676 * 1000).toLocaleString())
console.log("access_token 到期: " + new Date(1784412179 * 1000).toLocaleString())
console.log("")
console.log("现在可以关闭此脚本，打开 index.tsx 使用了！")

Script.exit()
