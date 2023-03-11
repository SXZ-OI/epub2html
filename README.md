# epub2html 转换器

## 使用前
请自行安装nodejs库
```console
npm i minimist
npm i fs-extra
npm i jszip
npm i cheerio
```

## 使用方法

```console
node index.js target.epub
```

## 注意
target.epub应在index.js目录下。

将生成target.html和target文件夹（存放image/font)


__有bug请直接issues__


## 更新记录
- 2023.3.11 修复<a>链接的bug、加入夜间模式参数-d/-dark（用法i.g. node index.js epub -d）
