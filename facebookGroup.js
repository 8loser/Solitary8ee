const puppeteer = require('puppeteer');
const { facebook } = require('./config');

(async () => {
  const baseURL = 'https://www.facebook.com/groups/'
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
      if (postData.indexOf('fb_api_req_friendly_name=CometUFIReactionsDialogTabContentRefetchQuery')) {
        try {
          const respJSON = await interceptedResponse.json()
          if (respJSON.data && respJSON.data.node && respJSON.data.node.reactors && respJSON.data.node.reactors.edges) {
            const userList = respJSON.data.node.reactors.edges
            userList.forEach((user) => {
              const { id, name, url } = user.node
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
    await page.goto(facebook.loginURL, {
      // waitUntil: 'networkidle2'
    });
    const accountField = '#email'
    const passwordField = '#pass'
    await page.waitForSelector(accountField);
    await page.type(accountField, facebook.user);
    await page.waitForSelector(passwordField);
    await page.type(passwordField, facebook.pass);
    await page.click('button[name=login]');
    await page.waitForNavigation();
  }

  /**
   * 抓資料
   */
  let grab = async () => {
    await page.goto(`${baseURL}${facebook.groupId}`);
    await page.waitForSelector('span[role="toolbar"]');
    await page.click('span[role="toolbar"]');
  }

  await login()
  page.on('response', detected);
  await grab()

  // await browser.close();
})();