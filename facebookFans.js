const puppeteer = require('puppeteer');
const { auth } = require('./config');
const { fan } = require('./config');
const fs = require('fs');
const stringify = require('csv-stringify');

(async () => {
  const baseURL = 'https://www.facebook.com/'
  // const browser = await puppeteer.launch({ ignoreDefaultArgs: ["--enable-automation"] });
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--disable-notifications'],
    // args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  // TODO 判斷有沒有 cookies 檔案或者檔案是否為空，如果有資料就載入，同時不跳登入畫面
  // Load cookie
  const cookiesString = await fs.readFileSync('./cookies.json', 'utf8');
  const cookies = JSON.parse(cookiesString);
  await page.setCookie(...cookies);

  // 是否有下一筆
  let hasNext = true

  const detected = async (interceptedResponse) => {
    if (interceptedResponse.url() === 'https://www.facebook.com/api/graphql/'
      && interceptedResponse.ok()) {
      const request = interceptedResponse.request()
      const postData = request.postData()
      if (postData.indexOf('fb_api_req_friendly_name=CometPageCommunityTopFansDialogQuery')) {
        try {
          const respJSON = await interceptedResponse.json()
          if (respJSON.data && respJSON.data.node && respJSON.data.node.top_fans && respJSON.data.node.top_fans.edges) {
            const userList = respJSON.data.node.top_fans.edges
            const memberDataList = []
            userList.forEach((user) => {
              const { id, name, url } = user.node.fan
              memberDataList.push({id, name, url})
              console.log(id, name, url)
            })
            stringify(memberDataList, (err,output) => {
              if (err) {
                console.log(err)
              } else{
                fs.appendFile('./memberData.csv', output, (err,result)=>{
                  if (err) {
                    console.log(err);
                  }
                });
              }
            })
            // 判斷是否有下一筆
            if (respJSON.data.node.top_fans.page_info.has_next_page === true) {
              hasNext = true
            }
          }
        } catch (error) {
          hasNext = false
        }
      }
    }
  }

  /**
   * 登入
   */
  let login = async () => {
    await page.goto(auth.loginURL);
    const accountField = '#email'
    const passwordField = '#pass'
    await page.waitForSelector(accountField);
    await page.type(accountField, auth.user);
    await page.waitForSelector(passwordField);
    await page.type(passwordField, auth.pass);
    await page.click('button[name=login]');
    await page.waitForNavigation();

    // Save cookie
    // const cookies = await page.cookies();
    // await fs.writeFile('cookies.json', JSON.stringify(cookies, null, 2), function (err) {
    //   if (err)
    //     console.log(err);
    //   else
    //     console.log('Write operation complete.');
    // });
  }

  /**
   * 抓資料
   */
  let grab = async () => {
    await page.goto(`${baseURL}${fan.account}/community/?ref=page_internal`);

    await page.waitForSelector('div[role=button]>span[dir=auto]');
    await page.click('div[role=button]>span[dir=auto]');

    // 等待資料載入
    await page.waitForTimeout(1500)
    const pageView = page.viewport()
    await page.mouse.click(
      pageView.width / 2,
      pageView.height / 2
    );
    while (hasNext) {
      await page.mouse.wheel({ deltaY: 6 })
    }
  }

  // await login()
  page.on('response', detected);
  await grab()

  await browser.close();
})();