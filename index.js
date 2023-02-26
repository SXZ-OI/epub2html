const compressing = require("compressing");
const args = require("minimist")(process.argv.slice(2));
const fs = require("fs-extra");
const path = require("path");
const JSZip = require('jszip');
const cheerio = require('cheerio');
const config = {
    epub: String(args._.length ? args._[0] : "test.epub"),
    html: "",
    src: "",
}
config.html = config.epub.replace(/\.[^\.]+?$|$/, ".html"),
config.src = config.epub.replace(/\.[^\.]+?$|$/, "")
//console.log(config);


fs.readFile(config.epub, (err, data) => {
    JSZip.loadAsync(data).then(async (zip) => {
        const xml = await zip.file('META-INF/container.xml').async('string');
        let $ = cheerio.load(xml, {
            xmlMode: true
        });
        const opf = await zip.file($('rootfile').attr('full-path')).async("string");
        let suf=$('rootfile').attr('full-path').match(/^.+\//);
        if(!suf)suf="";

        let chapters = {},
            src = {},
            css = [],
            meta = {};
        $ = cheerio.load(opf, {
            xmlMode: true
        });

        //提取元元素
        $("metadata *").each(function () {
            attr = this.name.match(/(?<=^dc:).+/);
            if (attr)
                meta[attr[0]] = $(this).text();
        })
        //console.log(meta);

        //提取章节、css、资源
        $("item").each(function () {
            let href = this.attribs.href;
            if (href.match(/\.x?html$/))
                chapters[this.attribs.id] =href;
            else if (href.match(/\.css$/))
                css.push(href);
            else if (href.match(/\.(jpe?g|png|gif|svg|ttf|otf)$/))
                src[this.attribs.id] = href;
        })

        //初始化输出html
        let html = cheerio.load(`<!DOCTYPE html>
    <html lang="zh-cn">
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
            <link rel="shortcut icon" href="ico.png" />
            <style>${fs.readFileSync("index.css")}</style>
        </head>
        <body>
        </body>
    </html>`),
            ref = $("itemref");

        //元信息
        html("body").append(`<header id="title-block-header">
        <h1 class="head-title">${meta.title}</h1>
        <p class="head-creator">${meta.creator}</p>
        <p class="head-date">${meta.date}</p>
        </header>`)
        for (var i in meta) {
            let temp = html("<meta>"); //不知道为什么直接append字符串还有bug的。。。只好创建元素了
            temp.attr("name", i), temp.attr("content", meta[i])
            html("head").append(temp);
        }
        html("head").append(`<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes"><title>${meta.title}</title>`)

        for (var i in src)
            fs.outputFileSync(config.src + "/" + src[i],
                await zip.file(suf+src[i]).async('nodebuffer'));

        //加入css
        for (var i in css)
            html("head").append("<style>" + (await zip.file(suf+css[i]).async("string")).replace(/(?<=url\()(\.\.\/|)(.+?)(?=\))/g,`${config.src}/$2`) + "</style>")
        
        //加入各章节
        for (var i = 0; i < ref.length; i++) {
            let x = ref[i];
            let raw=await zip.file(suf+chapters[x.attribs.idref]).async("string");
            raw=raw.replace(/<\?.+?>|\r/,"")
            let chapter = cheerio.load(raw,{xmlMode: false});
            
            chapter("img").each(function(){
                this.attribs.src=this.attribs.src.replace(/^\.\.\/|/, config.src + "/")
            });
            chapter("image").each(function(){
                this.attribs.href=this.attribs.href.replace(/^\.\.\/|/, config.src + "/")
            });
            chapter("a").each(function(){
                if(this.attribs.href.match(/^#/))
                    return;
                this.attribs.href="#"+chapters[x.attribs.idref].replace(/(?<=\/).+?$/,"")+this.attribs.href.replace(/#.+/, "");
            });
            //修改各种URL

            chapter("link").remove();
            
            let content = chapter("body");
            content.children().attr("id", chapters[x.attribs.idref]);
            html("body").append(content.html());
        }

        //输出
        fs.writeFileSync(config.html, html.html());
        
    });
});