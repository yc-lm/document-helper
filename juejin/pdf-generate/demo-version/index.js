const Koa = require('koa')
const http = require('http')
const Router = require('koa-router')
const fs = require('fs')
const path = require('path');
const static = require('koa-static');
const puppeteer = require("puppeteer");
const cors = require('@koa/cors')

const app = new Koa()
const router = new Router();

router.get('/export/pdf', async (ctx) => {
	await createPdf({
    hostname: ctx.hostname,
    id: ctx.query.id,
    type: ctx.query.type,
    token: ctx.query.token
  });
  let filePath = './page.pdf'
  let file = fs.createReadStream(filePath)
  let fileName = filePath.split('\\').pop()
  ctx.set('Content-disposition', 'attachment;filename=' + encodeURIComponent(fileName))
  ctx.set('Content-type', 'application/pdf')
  ctx.body = file
});

async function createPdf(obj) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setBypassCSP(false);
  await page.setExtraHTTPHeaders({
    Authorization:
      "Bearer " + obj.token,
  });
  await page
    .mainFrame()
    .goto(`http://${obj.hostname}:3002/exportReport?id=${obj.id}&type=${obj.type}`, {
      waitUntil: ["networkidle2"],
    });
  // await page.reload({ timeout: 60000, waitUntil: ['networkidle2'] })
  await page.pdf({
    path: "page.pdf",
    displayHeaderFooter: false,
    footerTemplate: "<p>东信同邦</p>",
    format: "A4",
    preferCSSPageSize: false,
    printBackground: true,
    margin: {
      top: "20",
      bottom: "20",
    },
  });
  // page.close()
  browser.close();
}

app.use(cors());
app.use(static(path.join(__dirname)));
app.use(router.routes()).use(router.allowedMethods())

http.createServer(app.callback()).listen(9527);
