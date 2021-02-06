const puppeteer = require('puppeteer');
const { auth } = require('./config');
const { fan } = require('./config');

(async () => {
  const baseURL = 'https://www.facebook.com/'
  // const browser = await puppeteer.launch({ ignoreDefaultArgs: ["--enable-automation"] });
  const browser = await puppeteer.launch({
    headless: false,
    // slowMo: 0,
    // args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

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
            userList.forEach((user) => {
              const { id, name, url } = user.node.fan
              console.log(id, name, url)
            })
          }
        } catch (error) {
          // nothing
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
  }


  /**
   * 抓資料
   */
  let grab = async () => {
    await page.goto(`${baseURL}${fan.account}/community/?ref=page_internal`);

    await page.waitForSelector('div[role = button] > span[dir = auto]');
    await page.click('div[role = button] > span[dir = auto]');
  }

  await login()
  page.on('response', detected);
  await grab()

  // await browser.close();
})();