const puppeteer = require('puppeteer');
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
  
  // 是否有下一筆
  let hasNext = true

  const detecteReactors = async (interceptedResponse) => {
    if (interceptedResponse.url() === 'https://www.facebook.com/api/graphql/'
      && interceptedResponse.ok()) {
      const request = interceptedResponse.request()
      const postData = request.postData()
      if (postData.indexOf('fb_api_req_friendly_name=CometUFIReactionsDialogQuery')) {
        try {
          const respJSON = await interceptedResponse.json()
          if (respJSON.data && respJSON.data.node && respJSON.data.node.reactors && respJSON.data.node.reactors.edges) {
            const userList = respJSON.data.node.reactors.edges
            const memberDataList = []
            userList.forEach((user) => {
              const { id, name, url } = user.node
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
            if (respJSON.data.node.reactors.page_info.has_next_page === true) {
              hasNext = true
            } else{
                hasNext = false
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
    await page.goto('https://www.facebook.com/');
    await page.waitForNavigation();

    // Save cookie
    const cookies = await page.cookies();
    await fs.writeFile('cookies.json', JSON.stringify(cookies, null, 2), function (err) {
      if (err)
        console.log(err);
    });
  }

  /**
   * 抓資料
   */
  let grab = async () => {
    await page.goto(`${baseURL}${fan.account}`);
    let postCount = 0
    await page.waitForSelector('div>span[aria-label="看看誰對這個傳達了心情"] ~div');
    let postReactor = await page.$$('div>span[aria-label="看看誰對這個傳達了心情"] ~div')
    while (postReactor.length>postCount) {
        await postReactor[postCount].click()
        // 等待資料載入
        await page.waitForTimeout(1000)
        const pageView = page.viewport()
        await page.mouse.click(
          pageView.width / 2,
          pageView.height / 2
        );
        while (hasNext) {
          await page.mouse.wheel({ deltaY: 6 })
        }
        await page.click('div[aria-label="關閉"');
        await page.mouse.wheel({ deltaY: 6 })
        postReactor = await page.$$('div>span[aria-label="看看誰對這個傳達了心情"] ~div')
        postCount += 1
    }
  }

  // 有沒有 cookies 檔案或者檔案是否為空，如果有資料就載入，同時不跳登入畫面
  if (fs.existsSync('./cookies.json')) {
    // Load cookie
    const cookiesString = await fs.readFileSync('./cookies.json', 'utf8');
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
  } else {
    await login()
  }
  
  page.on('response', detecteReactors);
  await grab()
  // await browser.close();
})();